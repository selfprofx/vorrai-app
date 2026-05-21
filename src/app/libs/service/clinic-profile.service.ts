/**
 * Service for the public clinic-directory profile (A.9 backend).
 *
 * Backed by:
 *   GET  /dashboard/clinic/profile          — read (synthesises empty default if absent)
 *   PUT  /dashboard/clinic/profile          — upsert (doctor or manager only)
 *   POST /dashboard/clinic/profile/publish  — set published=true + directory_opt_in=true
 *
 * `verified` and `profile_views_count` are surfaced read-only — the editor
 * shows them as metadata but the server rejects them on PUT.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClinicProfile {
  tenant_id: string;
  slug: string;
  display_name: string;
  vertical: string;
  tagline: string | null;
  bio_md: string | null;
  primary_specialty: string | null;
  secondary_specialties: string[];
  services: string[];
  languages: string[];
  accepted_insurances: string[];
  city: string | null;
  state: string | null;
  country_code: string | null;
  jurisdiction: string | null;
  avatar_image_s3_key: string | null;
  hero_image_s3_key: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  patient_chat_path: string | null;
  booking_wa_me_url: string | null;
  directory_opt_in: boolean;
  published: boolean;
  verified: boolean;
  profile_views_count: number;
  created_at?: string;
  updated_at?: string;
}

/** Writable subset — `verified` + `published` + counters are read-only. */
export type ClinicProfileInput = Partial<Omit<ClinicProfile,
  'tenant_id' | 'vertical' | 'verified' | 'published'
  | 'profile_views_count' | 'created_at' | 'updated_at'>>;

@Injectable({ providedIn: 'root' })
export class ClinicProfileService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get(): Promise<ClinicProfile> {
    return firstValueFrom(this.http.get<ClinicProfile>(
      `${this.base}/dashboard/clinic/profile`,
    ));
  }

  /** Upsert profile fields. Doctor or manager only (enforced server-side). */
  save(data: ClinicProfileInput): Promise<ClinicProfile> {
    return firstValueFrom(this.http.put<ClinicProfile>(
      `${this.base}/dashboard/clinic/profile`, data,
    ));
  }

  /** Flip published + directory_opt_in to true.
   *  Refused server-side if required fields (display_name, slug,
   *  primary_specialty) are missing. */
  publish(): Promise<ClinicProfile> {
    return firstValueFrom(this.http.post<ClinicProfile>(
      `${this.base}/dashboard/clinic/profile/publish`, {},
    ));
  }

  /** "Unpublish" — flips directory_opt_in to false so the profile drops
   *  out of vorrai.co/clinics. The `published` flag stays True (no
   *  unpublish endpoint by design); flipping directory_opt_in is enough
   *  because the public list endpoint filters on BOTH flags. */
  hideFromDirectory(): Promise<ClinicProfile> {
    return this.save({ directory_opt_in: false });
  }

  /**
   * End-to-end image upload: get presigned URL → PUT to S3 → return s3_key.
   *
   * Caller is responsible for then calling `save({avatar_image_s3_key: ...})`
   * or `save({hero_image_s3_key: ...})` to persist the key on the profile.
   *
   * Why two steps and not one round-trip through the backend? The image
   * goes from the doctor's browser straight to S3 — Lambda's 6 MB payload
   * limit + the egress cost make the through-server path a non-starter.
   */
  async uploadImage(kind: 'avatar' | 'hero', file: File): Promise<string> {
    if (!file) throw new Error('file required');
    const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const contentType = (file.type || 'image/jpeg').toLowerCase();
    if (!allowed.has(contentType)) {
      throw new Error(`Unsupported image type: ${contentType}. Use JPEG, PNG, or WebP.`);
    }

    // 1. Ask the backend for a presigned PUT URL.
    const presigned = await firstValueFrom(this.http.post<{
      upload_url: string;
      s3_key: string;
      content_type: string;
    }>(
      `${this.base}/dashboard/clinic/profile/upload-image`,
      {
        kind,
        filename: file.name,
        content_type: contentType,
      },
    ));

    // 2. PUT the bytes directly to S3. No Authorization header here — the
    //    URL is the credential, and adding the API's Bearer token would
    //    confuse S3's signature verification.
    const put = await fetch(presigned.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!put.ok) {
      throw new Error(`S3 upload failed (${put.status}). Try again or pick another file.`);
    }
    return presigned.s3_key;
  }
}

/**
 * Clinic-profile editor — vorrai-app/clinic-profile.
 *
 * The doctor edits their directory-facing profile here. When published,
 * this profile is what appears at `vorrai.co/clinics/<slug>` and as the
 * "author card" footer on every post they write to vorrai.co/blog.
 *
 * Two distinct buttons:
 *   - "Save changes" → PUT the form fields, profile stays in its current
 *     publish state (a published clinic can keep editing without dropping
 *     out of the directory).
 *   - "Publish" / "Hide from directory" → toggle visibility. Publish is
 *     server-validated (refuses without display_name + slug + primary_specialty).
 *
 * For list fields (services, secondary_specialties, languages, accepted_insurances)
 * we use comma-separated text inputs. A proper tag-input UX comes in a
 * follow-up; comma-separated is the lowest-friction MVP and the server
 * accepts the JSON array shape either way.
 *
 * Image uploads (avatar, hero) are deferred — the doctor pastes an S3
 * key once one of the existing image-upload paths has stored it. The
 * presigned-upload flow specifically for profile images is its own
 * focused iteration.
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
  NbIconModule, NbBadgeModule, NbSelectModule, NbSpinnerModule,
  NbToastrService,
} from '@nebular/theme';
import {
  ClinicProfileService, ClinicProfile, ClinicProfileInput,
} from '../../libs/service/clinic-profile.service';

/** Same curated IANA-ish jurisdiction list the agent crews use. */
const JURISDICTIONS = ['BR', 'EU', 'UK', 'US'];

function joinList(arr: string[] | null | undefined): string {
  return (arr || []).join(', ');
}

function splitList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

@Component({
  selector: 'clinic-profile',
  templateUrl: './clinic-profile.html',
  styleUrl: './clinic-profile.scss',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
    NbIconModule, NbBadgeModule, NbSelectModule, NbSpinnerModule,
  ],
})
export class ClinicProfileEditor implements OnInit {
  private service = inject(ClinicProfileService);
  private toastr  = inject(NbToastrService);

  loading = signal(true);
  saving  = signal(false);
  error   = signal<string | null>(null);
  uploadingAvatar = signal(false);
  uploadingHero   = signal(false);

  /** The server-authoritative copy — only mutated after a successful save. */
  remote = signal<ClinicProfile | null>(null);

  // Form fields (flat for two-way binding). List fields are kept as
  // comma-separated strings to match the input UX, then split on save.
  slug              = signal('');
  display_name      = signal('');
  tagline           = signal('');
  bio_md            = signal('');
  primary_specialty = signal('');
  secondary_specialties_raw = signal('');
  services_raw       = signal('');
  languages_raw      = signal('');
  accepted_insurances_raw = signal('');
  city              = signal('');
  state             = signal('');
  country_code      = signal('');
  jurisdiction      = signal('');
  avatar_image_s3_key = signal('');
  hero_image_s3_key   = signal('');
  website_url       = signal('');
  instagram_handle  = signal('');
  patient_chat_path = signal('');
  booking_wa_me_url = signal('');
  directory_opt_in  = signal(false);

  jurisdictions = JURISDICTIONS;

  readonly publishable = computed(() =>
    this.display_name().trim().length > 0
    && this.slug().trim().length > 0
    && this.primary_specialty().trim().length > 0
  );

  readonly publicUrl = computed(() => {
    const r = this.remote();
    if (!r?.published || !r?.directory_opt_in) return null;
    return `https://vorrai.co/clinics/${r.slug}`;
  });

  async ngOnInit() {
    try {
      const data = await this.service.get();
      this.applyServer(data);
    } catch (e: any) {
      this.error.set(e?.error?.Message || e?.message || 'Failed to load profile');
    } finally {
      this.loading.set(false);
    }
  }

  /** Sync form signals from a fresh server payload. */
  private applyServer(data: ClinicProfile) {
    this.remote.set(data);
    this.slug.set(data.slug || '');
    this.display_name.set(data.display_name || '');
    this.tagline.set(data.tagline || '');
    this.bio_md.set(data.bio_md || '');
    this.primary_specialty.set(data.primary_specialty || '');
    this.secondary_specialties_raw.set(joinList(data.secondary_specialties));
    this.services_raw.set(joinList(data.services));
    this.languages_raw.set(joinList(data.languages));
    this.accepted_insurances_raw.set(joinList(data.accepted_insurances));
    this.city.set(data.city || '');
    this.state.set(data.state || '');
    this.country_code.set(data.country_code || '');
    this.jurisdiction.set(data.jurisdiction || '');
    this.avatar_image_s3_key.set(data.avatar_image_s3_key || '');
    this.hero_image_s3_key.set(data.hero_image_s3_key || '');
    this.website_url.set(data.website_url || '');
    this.instagram_handle.set(data.instagram_handle || '');
    this.patient_chat_path.set(data.patient_chat_path || '');
    this.booking_wa_me_url.set(data.booking_wa_me_url || '');
    this.directory_opt_in.set(data.directory_opt_in);
  }

  /** Build the PUT payload from form signals. */
  private buildPayload(): ClinicProfileInput {
    return {
      slug: this.slug().trim() || undefined,
      display_name: this.display_name().trim() || undefined,
      tagline: this.tagline().trim() || undefined,
      bio_md: this.bio_md(),                                  // allow empty string to clear
      primary_specialty: this.primary_specialty().trim() || undefined,
      secondary_specialties: splitList(this.secondary_specialties_raw()),
      services: splitList(this.services_raw()),
      languages: splitList(this.languages_raw()),
      accepted_insurances: splitList(this.accepted_insurances_raw()),
      city: this.city().trim() || undefined,
      state: this.state().trim() || undefined,
      country_code: (this.country_code().trim() || '').toUpperCase() || undefined,
      jurisdiction: this.jurisdiction() || undefined,
      avatar_image_s3_key: this.avatar_image_s3_key().trim() || undefined,
      hero_image_s3_key: this.hero_image_s3_key().trim() || undefined,
      website_url: this.website_url().trim() || undefined,
      instagram_handle: this.instagram_handle().trim() || undefined,
      patient_chat_path: this.patient_chat_path().trim() || undefined,
      booking_wa_me_url: this.booking_wa_me_url().trim() || undefined,
      directory_opt_in: this.directory_opt_in(),
    };
  }

  async save() {
    this.saving.set(true);
    try {
      const data = await this.service.save(this.buildPayload());
      this.applyServer(data);
      this.toastr.success('Profile saved', 'Saved', { duration: 2000 });
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to save profile', 'Error',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async publish() {
    if (!this.publishable()) {
      this.toastr.warning(
        'Display name, slug, and primary specialty are required to publish.',
        'Missing fields',
      );
      return;
    }
    this.saving.set(true);
    try {
      // Save current form state first, then publish — keeps PUT/POST atomic-ish
      // from the doctor's perspective ("I clicked publish, my latest edits went too").
      await this.service.save(this.buildPayload());
      const data = await this.service.publish();
      this.applyServer(data);
      this.toastr.success('Published to the directory.', 'Live', { duration: 2500 });
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to publish', 'Error',
      );
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Browser → S3 upload, then PUT the resulting key onto the profile.
   *
   * Uses the two-step flow inside `ClinicProfileService.uploadImage`: ask
   * the backend for a presigned URL, then PUT bytes directly to S3 (avoids
   * Lambda's 6 MB payload limit and the egress cost of double-hopping).
   * Once we have the key, save it onto the profile so a refresh shows the
   * preview from the S3 URL.
   */
  async pickAvatar(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingAvatar.set(true);
    try {
      const s3_key = await this.service.uploadImage('avatar', file);
      const data = await this.service.save({ avatar_image_s3_key: s3_key });
      this.applyServer(data);
      this.toastr.success('Avatar updated', 'Uploaded', { duration: 2000 });
    } catch (e: any) {
      this.toastr.danger(e?.message || 'Avatar upload failed', 'Error');
    } finally {
      this.uploadingAvatar.set(false);
      input.value = '';   // reset so the same file can be re-picked
    }
  }

  async pickHero(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingHero.set(true);
    try {
      const s3_key = await this.service.uploadImage('hero', file);
      const data = await this.service.save({ hero_image_s3_key: s3_key });
      this.applyServer(data);
      this.toastr.success('Hero image updated', 'Uploaded', { duration: 2000 });
    } catch (e: any) {
      this.toastr.danger(e?.message || 'Hero upload failed', 'Error');
    } finally {
      this.uploadingHero.set(false);
      input.value = '';
    }
  }

  /** Clear the key locally — doctor must hit Save to persist. */
  clearAvatar() { this.avatar_image_s3_key.set(''); }
  clearHero()   { this.hero_image_s3_key.set(''); }

  /** Build a display URL from an S3 key (assumes public-read bucket or
   *  CloudFront-fronted). Returns null when the key is empty. */
  imageUrl(s3Key: string | null | undefined): string | null {
    const k = (s3Key || '').trim();
    if (!k) return null;
    const base = (window as any).VORRAI_MEDIA_BASE
      || 'https://vendia-media.s3.amazonaws.com';
    return `${base}/${k.replace(/^\/+/, '')}`;
  }

  async hideFromDirectory() {
    const ok = window.confirm(
      'Hide this clinic from the public directory? Existing patient links ' +
      'and blog backlinks will keep working; only vorrai.co/clinics drops you.',
    );
    if (!ok) return;
    this.saving.set(true);
    try {
      const data = await this.service.hideFromDirectory();
      this.applyServer(data);
      this.toastr.success('Hidden from the directory.', 'Updated', { duration: 2000 });
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to update', 'Error',
      );
    } finally {
      this.saving.set(false);
    }
  }
}

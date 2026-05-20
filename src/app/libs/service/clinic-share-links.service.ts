/**
 * Service for GET /dashboard/clinic/share-links — wa.me deep-links the
 * clinic shares with patients (A.8 backend; this is the dashboard surface).
 *
 * Returns three independently shareable blocks:
 *   - clinic-generic (one link → "book anything at this clinic")
 *   - per-doctor (one link per active doctor, pre-scoped to that doctor)
 *   - per-location (one link per active location, pre-scoped to that location)
 *
 * Each link's `share_text` embeds the `Vorrai:book:clinic=…&doctor=…` payload
 * that FlowRouter parses server-side — the patient never sees the encoded
 * marker, they see the friendly prefix sentence and hit send.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ShareLinkClinic {
  slug: string;
  name: string;
  share_text: string;
  share_url: string;
}

export interface ShareLinkDoctor {
  doctor_id: string;
  name: string;
  specialty: string | null;
  share_text: string;
  share_url: string;
}

export interface ShareLinkLocation {
  location_id: string;
  name: string;
  city: string | null;
  is_default: boolean;
  share_text: string;
  share_url: string;
}

export interface ShareLinksResponse {
  vorrai_number_e164: string;
  vorrai_number_available: boolean;
  clinic: ShareLinkClinic;
  doctors: ShareLinkDoctor[];
  locations: ShareLinkLocation[];
}

@Injectable({ providedIn: 'root' })
export class ClinicShareLinksService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Fetch all three blocks for the authenticated tenant. */
  list(): Promise<ShareLinksResponse> {
    return firstValueFrom(
      this.http.get<ShareLinksResponse>(`${this.base}/dashboard/clinic/share-links`),
    );
  }
}

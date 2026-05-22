/**
 * Service for clinic-location CRUD — backs the vorrai-app Locations page.
 *
 * Wraps `/dashboard/clinic/locations[/<id>]` (the 5 endpoints added in
 * dashboard_api.py). Both doctor + receptionist can read; writes (POST/PUT/
 * DELETE) are doctor-or-manager only — enforced at the backend, the UI
 * just hides the action buttons for receptionists.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClinicWorkingHour {
  day_of_week: string | null;            // "mon" | "tue" | ... | "sun"
  start_time: string | null;             // "09:00"
  end_time: string | null;               // "18:00"
  timezone?: string | null;              // IANA (overrides location.timezone if set)
  slot_duration_minutes?: number | null; // default 60
  buffer_minutes?: number | null;        // default 0
}

export interface ClinicLocation {
  location_id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
  timezone: string | null;
  phone: string | null;
  working_hours: ClinicWorkingHour[];
  accepted_insurances: string[];
  services: string[];
  is_default: boolean;
  is_active: boolean;
  directory_opt_in: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Writable subset for POST/PUT — server ignores extraneous keys. */
export type ClinicLocationInput = Partial<Omit<ClinicLocation, 'location_id' | 'created_at' | 'updated_at'>>;

@Injectable({ providedIn: 'root' })
export class ClinicLocationsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Promise<{ items: ClinicLocation[]; count: number }> {
    return firstValueFrom(
      this.http.get<{ items: ClinicLocation[]; count: number }>(
        `${this.base}/dashboard/clinic/locations`,
      ),
    );
  }

  get(locationId: string): Promise<ClinicLocation> {
    return firstValueFrom(
      this.http.get<ClinicLocation>(
        `${this.base}/dashboard/clinic/locations/${encodeURIComponent(locationId)}`,
      ),
    );
  }

  create(data: ClinicLocationInput): Promise<ClinicLocation> {
    return firstValueFrom(
      this.http.post<ClinicLocation>(
        `${this.base}/dashboard/clinic/locations`, data,
      ),
    );
  }

  update(locationId: string, data: ClinicLocationInput): Promise<ClinicLocation> {
    return firstValueFrom(
      this.http.put<ClinicLocation>(
        `${this.base}/dashboard/clinic/locations/${encodeURIComponent(locationId)}`,
        data,
      ),
    );
  }

  remove(locationId: string): Promise<{ status: string; location_id: string }> {
    return firstValueFrom(
      this.http.delete<{ status: string; location_id: string }>(
        `${this.base}/dashboard/clinic/locations/${encodeURIComponent(locationId)}`,
      ),
    );
  }
}

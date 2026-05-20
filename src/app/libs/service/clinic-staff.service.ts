/**
 * Service for clinic-staff CRUD — backs the vorrai-app Staff page.
 *
 * Wraps `/dashboard/clinic/staff[/:staff_id]`. Both doctor + secretary
 * roles can read; writes are doctor-or-manager only (enforced server-side).
 * Soft-delete + Cognito role-group revocation happens behind the DELETE
 * verb — the row stays in DynamoDB so historical bookings keep their
 * foreign keys, but the staff member loses dashboard access.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type StaffRole = 'doctor' | 'secretary';

export interface ClinicStaff {
  staff_id: string;
  role: StaffRole;
  name: string;
  email: string | null;
  phone: string | null;
  phone_normalized_e164: string | null;
  specialty: string | null;
  crm_number: string | null;
  crm_jurisdiction: string | null;
  bio: string | null;
  photo_s3_key: string | null;
  location_ids: string[];
  is_active: boolean;
  directory_opt_in: boolean;
  cognito_user_created: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Writable subset — `staff_id`, `created_at`, `updated_at`,
 *  `cognito_user_created` are read-only on the server. */
export type ClinicStaffInput = Partial<Omit<ClinicStaff,
  'staff_id' | 'created_at' | 'updated_at' | 'cognito_user_created'>>;

/** Server-side response shape on create — adds `cognito_provisioned`. */
export interface ClinicStaffCreated extends ClinicStaff {
  cognito_provisioned: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClinicStaffService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(opts?: { role?: StaffRole; includeInactive?: boolean }): Promise<{
    items: ClinicStaff[]; count: number;
  }> {
    let params = new HttpParams();
    if (opts?.role) params = params.set('role', opts.role);
    if (opts?.includeInactive) params = params.set('include_inactive', '1');
    return firstValueFrom(this.http.get<{ items: ClinicStaff[]; count: number }>(
      `${this.base}/dashboard/clinic/staff`, { params },
    ));
  }

  get(staffId: string): Promise<ClinicStaff> {
    return firstValueFrom(this.http.get<ClinicStaff>(
      `${this.base}/dashboard/clinic/staff/${encodeURIComponent(staffId)}`,
    ));
  }

  /** Create a doctor or secretary. `role` is required. */
  create(data: ClinicStaffInput & { role: StaffRole; name: string }): Promise<ClinicStaffCreated> {
    return firstValueFrom(this.http.post<ClinicStaffCreated>(
      `${this.base}/dashboard/clinic/staff`, data,
    ));
  }

  /** Update; `role` cannot be changed (server rejects it). */
  update(staffId: string, data: ClinicStaffInput): Promise<ClinicStaff> {
    return firstValueFrom(this.http.put<ClinicStaff>(
      `${this.base}/dashboard/clinic/staff/${encodeURIComponent(staffId)}`, data,
    ));
  }

  /** Soft-delete: row stays in DynamoDB (is_active=False), Cognito role group revoked. */
  softDelete(staffId: string): Promise<ClinicStaff | { status: string; staff_id: string }> {
    return firstValueFrom(this.http.delete<ClinicStaff>(
      `${this.base}/dashboard/clinic/staff/${encodeURIComponent(staffId)}`,
    ));
  }

  /** Reactivate by flipping is_active back. Pure convenience wrapper over PUT. */
  reactivate(staffId: string): Promise<ClinicStaff> {
    return this.update(staffId, { is_active: true });
  }
}

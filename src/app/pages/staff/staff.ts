/**
 * Staff dashboard page — vorrai-app/staff.
 *
 * Doctor manages the clinic's people (doctors + receptionists) after onboarding:
 * adding a new doctor mints a Cognito user in `tenant:<id>:doctor` group;
 * adding a receptionist mints one in `tenant:<id>:receptionist`. The Cognito sync
 * happens server-side — the dashboard just calls POST + checks the
 * `cognito_provisioned` flag in the response.
 *
 * Two flat lists side by side (doctors + receptionists) so the doctor can
 * scan their team at a glance. Inactive rows are hidden by default;
 * "Show inactive" toggle surfaces them with a faded style.
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
  NbIconModule, NbBadgeModule, NbSelectModule, NbSpinnerModule, NbTabsetModule,
  NbToastrService, NbDialogService, NbDialogRef,
} from '@nebular/theme';
import {
  ClinicStaffService, ClinicStaff, ClinicStaffInput, StaffRole,
} from '../../libs/service/clinic-staff.service';
import {
  ClinicLocationsService, ClinicLocation,
} from '../../libs/service/clinic-locations.service';
import { AuthService } from '../../libs/service/auth.service';

@Component({
  selector: 'app-staff-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
    NbSelectModule,
  ],
  template: `
    <nb-card class="staff-dialog">
      <nb-card-header>
        {{ isEdit ? ('Edit ' + form.role) : ('Add ' + form.role) }}
      </nb-card-header>
      <nb-card-body>
        @if (!isEdit) {
          <label class="role-picker">
            <span>Role <em>*</em></span>
            <nb-select [(ngModel)]="form.role" fullWidth>
              <nb-option value="doctor">Doctor</nb-option>
              <nb-option value="receptionist">Receptionist</nb-option>
            </nb-select>
          </label>
        }

        <div class="grid">
          <label class="full">
            <span>Full name <em>*</em></span>
            <input nbInput type="text" [(ngModel)]="form.name" />
          </label>
          <label>
            <span>Email</span>
            <input nbInput type="email" [(ngModel)]="form.email" />
            <small>Required for dashboard access.</small>
          </label>
          <label>
            <span>Phone</span>
            <input nbInput type="tel" [(ngModel)]="form.phone"
                   placeholder="+55 11 ..." />
            @if (form.role === 'doctor') {
              <small>Doctor phones must be unique across all Vorrai clinics.</small>
            }
          </label>

          @if (form.role === 'doctor') {
            <label>
              <span>Specialty</span>
              <input nbInput type="text" [(ngModel)]="form.specialty"
                     placeholder="Dermatology" />
            </label>
            <label>
              <span>CRM number</span>
              <input nbInput type="text" [(ngModel)]="form.crm_number" />
            </label>
            <label>
              <span>CRM jurisdiction</span>
              <input nbInput type="text" [(ngModel)]="form.crm_jurisdiction"
                     placeholder="CRM-SP / GMC / NY-State" />
            </label>
            <label class="full">
              <span>Bio</span>
              <textarea nbInput [(ngModel)]="form.bio" rows="3"
                        placeholder="Short bio for the directory profile"></textarea>
            </label>
          }

          @if (locations && locations.length > 0) {
            <label class="full">
              <span>Locations</span>
              <nb-select multiple [(ngModel)]="form.location_ids" fullWidth
                         placeholder="All locations">
                @for (loc of locations; track loc.location_id) {
                  <nb-option [value]="loc.location_id">{{ loc.name }}</nb-option>
                }
              </nb-select>
              <small>Leave empty to assign all locations.</small>
            </label>
          }

          <div class="full toggles">
            <nb-checkbox [(ngModel)]="form.is_active">Active</nb-checkbox>
            @if (form.role === 'doctor') {
              <nb-checkbox [(ngModel)]="form.directory_opt_in">Show in directory</nb-checkbox>
            }
          </div>
        </div>
      </nb-card-body>
      <nb-card-footer class="dialog-footer">
        <button nbButton ghost status="basic" (click)="cancel()">Cancel</button>
        <button nbButton status="primary"
                [disabled]="!form.name?.trim() || !form.role || saving"
                (click)="save()">
          {{ saving ? 'Saving…' : (isEdit ? 'Save' : 'Add ' + form.role) }}
        </button>
      </nb-card-footer>
    </nb-card>
  `,
  styles: [`
    .staff-dialog { width: min(640px, 92vw); }
    .role-picker { display: block; margin-bottom: 1rem; }
    .role-picker span em { color: var(--color-danger-default, #ff3d71); font-style: normal; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem; }
    .grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: var(--text-hint-color, #8f9bb3); }
    .grid label.full { grid-column: 1 / -1; }
    .grid label small { font-size: 0.72rem; color: var(--text-hint-color, #8f9bb3); }
    .grid label span em { color: var(--color-danger-default, #ff3d71); font-style: normal; }
    .toggles { display: flex; gap: 1.25rem; flex-wrap: wrap; padding-top: 0.5rem; }
    .dialog-footer { display: flex; gap: 0.5rem; justify-content: flex-end; }
    textarea { resize: vertical; }
  `],
})
export class StaffDialog {
  protected ref = inject(NbDialogRef<StaffDialog>);
  isEdit = false;
  saving = false;
  locations: ClinicLocation[] = [];
  form: ClinicStaffInput & { role: StaffRole; name: string } = {
    role: 'doctor',
    name: '',
    is_active: true,
    directory_opt_in: false,
    location_ids: [],
  };

  setInitial(staff: ClinicStaff | null, locations: ClinicLocation[]) {
    this.locations = locations;
    if (staff) {
      this.isEdit = true;
      this.form = {
        role: staff.role,
        name: staff.name,
        email: staff.email ?? undefined,
        phone: staff.phone ?? undefined,
        specialty: staff.specialty ?? undefined,
        crm_number: staff.crm_number ?? undefined,
        crm_jurisdiction: staff.crm_jurisdiction ?? undefined,
        bio: staff.bio ?? undefined,
        location_ids: staff.location_ids ?? [],
        is_active: staff.is_active,
        directory_opt_in: staff.directory_opt_in,
      };
    }
  }

  cancel() { this.ref.close(null); }

  save() {
    if (!this.form.name?.trim() || !this.form.role) return;
    this.ref.close(this.form);
  }
}

@Component({
  selector: 'staff',
  templateUrl: './staff.html',
  styleUrl: './staff.scss',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbIconModule, NbBadgeModule, NbSpinnerModule,
    NbCheckboxModule, NbTabsetModule,
  ],
})
export class Staff implements OnInit {
  private staffSvc    = inject(ClinicStaffService);
  private locationSvc = inject(ClinicLocationsService);
  private dialog      = inject(NbDialogService);
  private toastr      = inject(NbToastrService);
  private auth        = inject(AuthService);

  /** Only admins (and managers) manage staff — mirrors the backend
   *  `_require_admin` guard on the staff endpoints. A plain doctor without
   *  the admin capability sees this page read-only. */
  readonly canWrite = this.auth.isAdmin;

  staff       = signal<ClinicStaff[]>([]);
  locations   = signal<ClinicLocation[]>([]);
  loading     = signal(true);
  error       = signal<string | null>(null);
  showInactive = signal(false);

  readonly doctors = computed(() =>
    this.staff().filter(s => s.role === 'doctor' && (this.showInactive() || s.is_active))
  );
  readonly receptionists = computed(() =>
    this.staff().filter(s => s.role === 'receptionist' && (this.showInactive() || s.is_active))
  );

  async ngOnInit() { await this.refresh(); }

  async refresh() {
    this.loading.set(true);
    try {
      const [staffRes, locRes] = await Promise.all([
        this.staffSvc.list({ includeInactive: true }),
        this.locationSvc.list().catch(() => ({ items: [], count: 0 })),
      ]);
      this.staff.set(staffRes.items);
      this.locations.set(locRes.items);
      this.error.set(null);
    } catch (e: any) {
      this.error.set(e?.error?.Message || e?.message || 'Failed to load staff');
    } finally {
      this.loading.set(false);
    }
  }

  add(role: StaffRole) {
    const ref = this.dialog.open(StaffDialog, { context: {} });
    const inst = ref.componentRef!.instance;
    inst.setInitial(null, this.locations());
    inst.form.role = role;
    ref.onClose.subscribe(async (data: (ClinicStaffInput & { role: StaffRole; name: string }) | null) => {
      if (!data) return;
      try {
        const created = await this.staffSvc.create(data);
        if (created.email && !created.cognito_provisioned) {
          this.toastr.warning(
            'Staff added but the Cognito invitation failed. They can be re-invited from this page.',
            'Partial success',
          );
        } else {
          this.toastr.success(
            created.email
              ? `${created.name} added and invited to the dashboard.`
              : `${created.name} added.`,
            'Saved',
            { duration: 2500 },
          );
        }
        await this.refresh();
      } catch (e: any) {
        this.toastr.danger(
          e?.error?.Message || e?.message || 'Failed to add staff',
          'Error',
        );
      }
    });
  }

  edit(member: ClinicStaff) {
    const ref = this.dialog.open(StaffDialog, { context: {} });
    ref.componentRef!.instance.setInitial(member, this.locations());
    ref.onClose.subscribe(async (data: ClinicStaffInput | null) => {
      if (!data) return;
      // Drop `role` from update body — the server refuses role changes.
      const { role: _drop, ...patch } = data as ClinicStaffInput & { role?: StaffRole };
      try {
        await this.staffSvc.update(member.staff_id, patch);
        this.toastr.success('Staff updated', 'Saved', { duration: 2000 });
        await this.refresh();
      } catch (e: any) {
        this.toastr.danger(
          e?.error?.Message || e?.message || 'Failed to update staff',
          'Error',
        );
      }
    });
  }

  async softDelete(member: ClinicStaff) {
    const ok = window.confirm(
      `Remove ${member.name}? Their historical bookings and audit logs are ` +
      `kept; only dashboard access is revoked. You can reactivate them later.`,
    );
    if (!ok) return;
    try {
      await this.staffSvc.softDelete(member.staff_id);
      this.toastr.success(`${member.name} deactivated`, 'Removed', { duration: 2000 });
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to deactivate staff',
        'Error',
      );
    }
  }

  async reactivate(member: ClinicStaff) {
    try {
      await this.staffSvc.reactivate(member.staff_id);
      this.toastr.success(`${member.name} reactivated`, 'Restored', { duration: 2000 });
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to reactivate',
        'Error',
      );
    }
  }

  /** Grant the admin capability — staff management + promoting other admins.
   *  Shows a deliberate trust warning before the irreversible-feeling grant. */
  async promoteAdmin(member: ClinicStaff) {
    const ok = window.confirm(
      `Make ${member.name} an admin?\n\n` +
      `Admins can register, edit and remove staff — and promote or revoke ` +
      `other admins. Only grant this to someone you trust with full control ` +
      `of who can access the clinic's dashboard.`,
    );
    if (!ok) return;
    try {
      await this.staffSvc.promoteAdmin(member.staff_id);
      this.toastr.success(`${member.name} is now an admin`, 'Admin granted', { duration: 2500 });
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to grant admin',
        'Error',
      );
    }
  }

  /** Revoke the admin capability. The server refuses to revoke the last admin. */
  async revokeAdmin(member: ClinicStaff) {
    if (!window.confirm(`Revoke ${member.name}'s admin access?`)) return;
    try {
      await this.staffSvc.revokeAdmin(member.staff_id);
      this.toastr.success(`${member.name} is no longer an admin`, 'Admin revoked', { duration: 2500 });
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to revoke admin',
        'Error',
      );
    }
  }

  /** Re-send the Cognito dashboard invitation (e.g. after a failed first send). */
  async resendInvite(member: ClinicStaff) {
    try {
      await this.staffSvc.resendInvite(member.staff_id);
      this.toastr.success(
        `Invitation re-sent to ${member.email}`, 'Sent', { duration: 2500 },
      );
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to resend the invitation',
        'Error',
      );
    }
  }

  /** Pretty-print location IDs as comma-separated names for the row meta-line. */
  locationNames(ids: string[]): string {
    if (!ids?.length) return 'All locations';
    const nameById = new Map(this.locations().map(l => [l.location_id, l.name]));
    return ids.map(id => nameById.get(id) || '?').join(' · ');
  }
}

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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ClinicStaffService, ClinicStaff, ClinicStaffInput, StaffRole,
} from '../../libs/service/clinic-staff.service';
import {
  ClinicLocationsService, ClinicLocation,
} from '../../libs/service/clinic-locations.service';
import { AuthService } from '../../libs/service/auth.service';
import { ConfirmDialogService } from '../../core/confirm-dialog.service';

@Component({
  selector: 'app-staff-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
    NbSelectModule,
  ],
  template: `
    <nb-card class="staff-dialog">
      <nb-card-header>
        {{ dialogTitleKey() | translate }}
      </nb-card-header>
      <nb-card-body>
        @if (!isEdit) {
          <label class="role-picker">
            <span>{{ 'staff.dialog.roleLabel' | translate }} <em>*</em></span>
            <nb-select [(ngModel)]="form.role" fullWidth>
              <nb-option value="doctor">{{ 'staff.dialog.roleDoctor' | translate }}</nb-option>
              <nb-option value="receptionist">{{ 'staff.dialog.roleReceptionist' | translate }}</nb-option>
            </nb-select>
          </label>
        }

        <div class="grid">
          <label class="full">
            <span>{{ 'staff.dialog.fullName' | translate }} <em>*</em></span>
            <input nbInput type="text" [(ngModel)]="form.name" />
          </label>
          <label>
            <span>{{ 'staff.dialog.email' | translate }}</span>
            <input nbInput type="email" [(ngModel)]="form.email" />
            <small>{{ 'staff.dialog.emailHint' | translate }}</small>
          </label>
          <label>
            <span>{{ 'staff.dialog.phone' | translate }}</span>
            <input nbInput type="tel" [(ngModel)]="form.phone"
                   [placeholder]="'staff.dialog.phonePlaceholder' | translate" />
            @if (form.role === 'doctor') {
              <small>{{ 'staff.dialog.phoneDoctorHint' | translate }}</small>
            }
          </label>

          @if (form.role === 'doctor') {
            <label>
              <span>{{ 'staff.dialog.specialty' | translate }}</span>
              <input nbInput type="text" [(ngModel)]="form.specialty"
                     [placeholder]="'staff.dialog.specialtyPlaceholder' | translate" />
            </label>
            <label>
              <span>{{ 'staff.dialog.crmNumber' | translate }}</span>
              <input nbInput type="text" [(ngModel)]="form.crm_number" />
            </label>
            <label>
              <span>{{ 'staff.dialog.crmJurisdiction' | translate }}</span>
              <input nbInput type="text" [(ngModel)]="form.crm_jurisdiction"
                     [placeholder]="'staff.dialog.crmJurisdictionPlaceholder' | translate" />
            </label>
            <label class="full">
              <span>{{ 'staff.dialog.bio' | translate }}</span>
              <textarea nbInput [(ngModel)]="form.bio" rows="3"
                        [placeholder]="'staff.dialog.bioPlaceholder' | translate"></textarea>
            </label>
          }

          @if (locations && locations.length > 0) {
            <label class="full">
              <span>{{ 'staff.dialog.locations' | translate }}</span>
              <nb-select multiple [(ngModel)]="form.location_ids" fullWidth
                         [placeholder]="'staff.dialog.locationsPlaceholder' | translate">
                @for (loc of locations; track loc.location_id) {
                  <nb-option [value]="loc.location_id">{{ loc.name }}</nb-option>
                }
              </nb-select>
              <small>{{ 'staff.dialog.locationsHint' | translate }}</small>
            </label>
          }

          <div class="full toggles">
            <nb-checkbox [(ngModel)]="form.is_active">{{ 'staff.dialog.active' | translate }}</nb-checkbox>
            @if (form.role === 'doctor') {
              <nb-checkbox [(ngModel)]="form.directory_opt_in">{{ 'staff.dialog.showInDirectory' | translate }}</nb-checkbox>
            }
          </div>
        </div>
      </nb-card-body>
      <nb-card-footer class="dialog-footer">
        <button nbButton ghost status="basic" (click)="cancel()">{{ 'staff.dialog.cancel' | translate }}</button>
        <button nbButton status="primary"
                [disabled]="!form.name?.trim() || !form.role || saving"
                (click)="save()">
          {{ (saving ? 'staff.dialog.saving' : (isEdit ? 'staff.dialog.save' : (form.role === 'doctor' ? 'staff.dialog.addDoctor' : 'staff.dialog.addReceptionist'))) | translate }}
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

  /** Computed translate key for the dialog header. */
  dialogTitleKey(): string {
    if (this.isEdit) {
      return this.form.role === 'doctor' ? 'staff.dialog.editDoctor' : 'staff.dialog.editReceptionist';
    }
    return this.form.role === 'doctor' ? 'staff.dialog.addDoctor' : 'staff.dialog.addReceptionist';
  }

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
    CommonModule, FormsModule, TranslatePipe,
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
  private translate   = inject(TranslateService);
  private confirm     = inject(ConfirmDialogService);

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
      this.error.set(e?.error?.Message || e?.message || this.translate.instant('staff.toast.loadFailed'));
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
            this.translate.instant('staff.toast.partialSuccess'),
            this.translate.instant('staff.toast.partialSuccessTitle'),
          );
        } else {
          this.toastr.success(
            this.translate.instant(
              created.email ? 'staff.toast.addedAndInvited' : 'staff.toast.added',
              { name: created.name },
            ),
            this.translate.instant('staff.toast.addedTitle'),
            { duration: 2500 },
          );
        }
        await this.refresh();
      } catch (e: any) {
        this.toastr.danger(
          e?.error?.Message || e?.message || this.translate.instant('staff.toast.addFailed'),
          this.translate.instant('staff.toast.errorTitle'),
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
        this.toastr.success(
          this.translate.instant('staff.toast.updated'),
          this.translate.instant('staff.toast.addedTitle'),
          { duration: 2000 },
        );
        await this.refresh();
      } catch (e: any) {
        this.toastr.danger(
          e?.error?.Message || e?.message || this.translate.instant('staff.toast.updateFailed'),
          this.translate.instant('staff.toast.errorTitle'),
        );
      }
    });
  }

  async softDelete(member: ClinicStaff) {
    const ok = await this.confirm.confirm({
      messageKey: 'staff.toast.confirmDeactivate',
      params: { name: member.name },
      confirmKey: 'staff.actions.deactivate',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.staffSvc.softDelete(member.staff_id);
      this.toastr.success(
        this.translate.instant('staff.toast.deactivated', { name: member.name }),
        this.translate.instant('staff.toast.deactivatedTitle'),
        { duration: 2000 },
      );
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('staff.toast.deactivateFailed'),
        this.translate.instant('staff.toast.errorTitle'),
      );
    }
  }

  async reactivate(member: ClinicStaff) {
    try {
      await this.staffSvc.reactivate(member.staff_id);
      this.toastr.success(
        this.translate.instant('staff.toast.reactivated', { name: member.name }),
        this.translate.instant('staff.toast.reactivatedTitle'),
        { duration: 2000 },
      );
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('staff.toast.reactivateFailed'),
        this.translate.instant('staff.toast.errorTitle'),
      );
    }
  }

  async promoteAdmin(member: ClinicStaff) {
    const ok = await this.confirm.confirm({
      messageKey: 'staff.toast.confirmPromoteAdmin',
      params: { name: member.name },
      confirmKey: 'staff.actions.makeAdmin',
    });
    if (!ok) return;
    try {
      await this.staffSvc.promoteAdmin(member.staff_id);
      this.toastr.success(
        this.translate.instant('staff.toast.adminGranted', { name: member.name }),
        this.translate.instant('staff.toast.adminGrantedTitle'),
        { duration: 2500 },
      );
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('staff.toast.adminGrantFailed'),
        this.translate.instant('staff.toast.errorTitle'),
      );
    }
  }

  async revokeAdmin(member: ClinicStaff) {
    const ok = await this.confirm.confirm({
      messageKey: 'staff.toast.confirmRevokeAdmin',
      params: { name: member.name },
      confirmKey: 'staff.actions.revokeAdmin',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.staffSvc.revokeAdmin(member.staff_id);
      this.toastr.success(
        this.translate.instant('staff.toast.adminRevoked', { name: member.name }),
        this.translate.instant('staff.toast.adminRevokedTitle'),
        { duration: 2500 },
      );
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('staff.toast.adminRevokeFailed'),
        this.translate.instant('staff.toast.errorTitle'),
      );
    }
  }

  async resendInvite(member: ClinicStaff) {
    try {
      await this.staffSvc.resendInvite(member.staff_id);
      this.toastr.success(
        this.translate.instant('staff.toast.inviteResent', { email: member.email }),
        this.translate.instant('staff.toast.inviteResentTitle'),
        { duration: 2500 },
      );
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('staff.toast.inviteResendFailed'),
        this.translate.instant('staff.toast.errorTitle'),
      );
    }
  }

  /** Pretty-print location IDs as comma-separated names for the row meta-line. */
  locationNames(ids: string[]): string {
    if (!ids?.length) return this.translate.instant('staff.toast.allLocations');
    const nameById = new Map(this.locations().map(l => [l.location_id, l.name]));
    return ids.map(id => nameById.get(id) || '?').join(' · ');
  }
}

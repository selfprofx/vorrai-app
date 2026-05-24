/**
 * Locations dashboard page — vorrai-app/locations.
 *
 * Doctor opens this to add/edit/delete clinic locations after onboarding.
 * Receptionist can view but the write actions are hidden — backend enforces
 * doctor-or-manager via `_require_doctor` on the POST/PUT/DELETE routes.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
  NbIconModule, NbBadgeModule, NbSelectModule, NbSpinnerModule,
  NbToastrService, NbDialogService, NbDialogRef,
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ClinicLocationsService, ClinicLocation, ClinicLocationInput,
} from '../../libs/service/clinic-locations.service';
import { AuthService } from '../../libs/service/auth.service';
import { ConfirmDialogService } from '../../core/confirm-dialog.service';

const COMMON_TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Recife',
  'America/Bogota', 'America/Mexico_City', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Rome',
  'UTC',
];

@Component({
  selector: 'app-location-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
    NbSelectModule,
  ],
  template: `
    <nb-card class="location-dialog">
      <nb-card-header>{{ (isEdit ? 'locations.edit' : 'locations.add') | translate }}</nb-card-header>
      <nb-card-body>
        <div class="grid">
          <label class="full">
            <span>{{ 'locations.dialog.nameLabel' | translate }} <em>*</em></span>
            <input nbInput type="text" [(ngModel)]="form.name" [placeholder]="'locations.dialog.namePlaceholder' | translate" />
          </label>
          <label class="full">
            <span>{{ 'locations.dialog.addr1' | translate }}</span>
            <input nbInput type="text" [(ngModel)]="form.address_line1" [placeholder]="'locations.dialog.addr1Placeholder' | translate" />
          </label>
          <label class="full">
            <span>{{ 'locations.dialog.addr2' | translate }}</span>
            <input nbInput type="text" [(ngModel)]="form.address_line2" [placeholder]="'locations.dialog.addr2Placeholder' | translate" />
          </label>
          <label>
            <span>{{ 'locations.dialog.city' | translate }}</span>
            <input nbInput type="text" [(ngModel)]="form.city" />
          </label>
          <label>
            <span>{{ 'locations.dialog.state' | translate }}</span>
            <input nbInput type="text" [(ngModel)]="form.state" />
          </label>
          <label>
            <span>{{ 'locations.dialog.postal' | translate }}</span>
            <input nbInput type="text" [(ngModel)]="form.postal_code" />
          </label>
          <label>
            <span>{{ 'locations.dialog.country' | translate }}</span>
            <input nbInput type="text" [(ngModel)]="form.country_code"
                   [placeholder]="'locations.dialog.countryPlaceholder' | translate" maxlength="3" style="text-transform:uppercase" />
          </label>
          <label class="full">
            <span>{{ 'locations.dialog.timezone' | translate }}</span>
            <nb-select [(ngModel)]="form.timezone" [placeholder]="'locations.dialog.timezonePlaceholder' | translate" fullWidth>
              @for (tz of timezones; track tz) {
                <nb-option [value]="tz">{{ tz }}</nb-option>
              }
            </nb-select>
          </label>
          <label class="full">
            <span>{{ 'locations.dialog.phone' | translate }}</span>
            <input nbInput type="tel" [(ngModel)]="form.phone" [placeholder]="'locations.dialog.phonePlaceholder' | translate" />
          </label>
          <div class="full toggles">
            <nb-checkbox [(ngModel)]="form.is_default">{{ 'locations.dialog.defaultToggle' | translate }}</nb-checkbox>
            <nb-checkbox [(ngModel)]="form.is_active">{{ 'locations.dialog.activeToggle' | translate }}</nb-checkbox>
            <nb-checkbox [(ngModel)]="form.directory_opt_in">{{ 'locations.dialog.directoryToggle' | translate }}</nb-checkbox>
          </div>
        </div>
      </nb-card-body>
      <nb-card-footer class="dialog-footer">
        <button nbButton ghost status="basic" (click)="cancel()">{{ 'locations.dialog.cancel' | translate }}</button>
        <button nbButton status="primary" [disabled]="!form.name?.trim() || saving"
                (click)="save()">
          {{ (saving ? 'locations.dialog.saving' : (isEdit ? 'locations.dialog.saveEdit' : 'locations.dialog.saveAdd')) | translate }}
        </button>
      </nb-card-footer>
    </nb-card>
  `,
  styles: [`
    .location-dialog { width: min(620px, 92vw); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem; }
    .grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: var(--text-hint-color, #8f9bb3); }
    .grid label.full { grid-column: 1 / -1; }
    .grid label span em { color: var(--color-danger-default, #ff3d71); font-style: normal; }
    .toggles { display: flex; gap: 1.25rem; flex-wrap: wrap; padding-top: 0.5rem; }
    .dialog-footer { display: flex; gap: 0.5rem; justify-content: flex-end; }
  `],
})
export class LocationDialog {
  protected ref = inject(NbDialogRef<LocationDialog>);
  isEdit = false;
  saving = false;
  form: ClinicLocationInput = {
    name: '',
    timezone: 'America/Sao_Paulo',
    country_code: 'BR',
    is_default: false,
    is_active: true,
    directory_opt_in: false,
  };
  timezones = COMMON_TIMEZONES;

  setInitial(loc: ClinicLocation | null) {
    if (loc) {
      this.isEdit = true;
      this.form = {
        name: loc.name,
        address_line1: loc.address_line1 ?? undefined,
        address_line2: loc.address_line2 ?? undefined,
        city: loc.city ?? undefined,
        state: loc.state ?? undefined,
        postal_code: loc.postal_code ?? undefined,
        country_code: loc.country_code ?? undefined,
        timezone: loc.timezone ?? undefined,
        phone: loc.phone ?? undefined,
        is_default: loc.is_default,
        is_active: loc.is_active,
        directory_opt_in: loc.directory_opt_in,
      };
    }
  }

  cancel() { this.ref.close(null); }

  save() {
    if (!this.form.name?.trim()) return;
    this.ref.close(this.form);
  }
}

@Component({
  selector: 'locations',
  templateUrl: './locations.html',
  styleUrl: './locations.scss',
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    NbCardModule, NbButtonModule, NbIconModule, NbBadgeModule, NbSpinnerModule,
  ],
})
export class Locations implements OnInit {
  private service  = inject(ClinicLocationsService);
  private dialog   = inject(NbDialogService);
  private toastr   = inject(NbToastrService);
  private auth     = inject(AuthService);
  private translate = inject(TranslateService);
  private confirm   = inject(ConfirmDialogService);

  locations = signal<ClinicLocation[]>([]);
  loading   = signal(true);
  error     = signal<string | null>(null);

  readonly canWrite = this.auth.canWriteAsDoctor;

  async ngOnInit() { await this.refresh(); }

  async refresh() {
    this.loading.set(true);
    try {
      const res = await this.service.list();
      this.locations.set(res.items);
      this.error.set(null);
    } catch (e: any) {
      this.error.set(e?.error?.Message || e?.message || this.translate.instant('locations.toast.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  add() {
    const ref = this.dialog.open(LocationDialog, { context: {} });
    ref.componentRef!.instance.setInitial(null);
    ref.onClose.subscribe(async (data: ClinicLocationInput | null) => {
      if (!data) return;
      try {
        await this.service.create(data);
        this.toastr.success(
          this.translate.instant('locations.toast.added'),
          this.translate.instant('locations.toast.addedTitle'),
          { duration: 2000 },
        );
        await this.refresh();
      } catch (e: any) {
        this.toastr.danger(
          e?.error?.Message || e?.message || this.translate.instant('locations.toast.addFailed'),
          this.translate.instant('locations.toast.errorTitle'),
        );
      }
    });
  }

  edit(loc: ClinicLocation) {
    const ref = this.dialog.open(LocationDialog, { context: {} });
    ref.componentRef!.instance.setInitial(loc);
    ref.onClose.subscribe(async (data: ClinicLocationInput | null) => {
      if (!data) return;
      try {
        await this.service.update(loc.location_id, data);
        this.toastr.success(
          this.translate.instant('locations.toast.updated'),
          this.translate.instant('locations.toast.addedTitle'),
          { duration: 2000 },
        );
        await this.refresh();
      } catch (e: any) {
        this.toastr.danger(
          e?.error?.Message || e?.message || this.translate.instant('locations.toast.updateFailed'),
          this.translate.instant('locations.toast.errorTitle'),
        );
      }
    });
  }

  /** Join the address parts into a single comma-separated line for display. */
  addressLine(loc: ClinicLocation): string {
    return [loc.address_line1, loc.city, loc.state, loc.country_code]
      .filter((p): p is string => !!p)
      .join(', ');
  }

  async remove(loc: ClinicLocation) {
    const ok = await this.confirm.confirm({
      titleKey: 'common.confirm.deleteTitle',
      messageKey: 'locations.toast.confirmDelete',
      params: { name: loc.name },
      confirmKey: 'common.action.delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.service.remove(loc.location_id);
      this.toastr.success(
        this.translate.instant('locations.toast.deleted'),
        this.translate.instant('locations.toast.deletedTitle'),
        { duration: 2000 },
      );
      await this.refresh();
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('locations.toast.deleteFailed'),
        this.translate.instant('locations.toast.errorTitle'),
      );
    }
  }
}

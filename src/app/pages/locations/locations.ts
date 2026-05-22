/**
 * Locations dashboard page — vorrai-app/locations.
 *
 * Doctor opens this to add/edit/delete clinic locations after onboarding
 * (e.g. opening a second branch, adding a satellite). Receptionist can view
 * but the write actions are hidden — backend enforces doctor-or-manager
 * via `_require_doctor` on the POST/PUT/DELETE routes.
 *
 * Form scope discipline: this iteration captures the essential fields
 * (name, full address, timezone, phone, is_default, directory_opt_in,
 * is_active). Working-hours / services / accepted-insurances get a
 * dedicated editor in a follow-up — they're the larger sub-forms and
 * day-one a doctor mostly cares about getting the basic location row in.
 *
 * Defaults policy: the first location a tenant creates is auto-defaulted
 * by the backend, so the UI doesn't need to gate the `is_default` toggle
 * on tenant state.
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
  NbIconModule, NbBadgeModule, NbSelectModule, NbSpinnerModule,
  NbToastrService, NbDialogService, NbDialogRef,
} from '@nebular/theme';
import {
  ClinicLocationsService, ClinicLocation, ClinicLocationInput,
} from '../../libs/service/clinic-locations.service';
import { AuthService } from '../../libs/service/auth.service';

// Curated IANA timezone list — covers the active markets without forcing
// the doctor to scroll through 400 entries. The text input accepts any
// IANA name; this is just the dropdown convenience.
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
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
    NbSelectModule,
  ],
  template: `
    <nb-card class="location-dialog">
      <nb-card-header>{{ isEdit ? 'Edit location' : 'Add location' }}</nb-card-header>
      <nb-card-body>
        <div class="grid">
          <label class="full">
            <span>Name <em>*</em></span>
            <input nbInput type="text" [(ngModel)]="form.name" placeholder="Av. Paulista" />
          </label>
          <label class="full">
            <span>Address line 1</span>
            <input nbInput type="text" [(ngModel)]="form.address_line1" placeholder="Av. Paulista 1234" />
          </label>
          <label class="full">
            <span>Address line 2</span>
            <input nbInput type="text" [(ngModel)]="form.address_line2" placeholder="Suite 502" />
          </label>
          <label>
            <span>City</span>
            <input nbInput type="text" [(ngModel)]="form.city" />
          </label>
          <label>
            <span>State / region</span>
            <input nbInput type="text" [(ngModel)]="form.state" />
          </label>
          <label>
            <span>Postal code</span>
            <input nbInput type="text" [(ngModel)]="form.postal_code" />
          </label>
          <label>
            <span>Country code</span>
            <input nbInput type="text" [(ngModel)]="form.country_code"
                   placeholder="BR / UK / US" maxlength="3" style="text-transform:uppercase" />
          </label>
          <label class="full">
            <span>Timezone (IANA)</span>
            <nb-select [(ngModel)]="form.timezone" placeholder="Select timezone" fullWidth>
              @for (tz of timezones; track tz) {
                <nb-option [value]="tz">{{ tz }}</nb-option>
              }
            </nb-select>
          </label>
          <label class="full">
            <span>Phone</span>
            <input nbInput type="tel" [(ngModel)]="form.phone" placeholder="+55 11 ..." />
          </label>
          <div class="full toggles">
            <nb-checkbox [(ngModel)]="form.is_default">Default location</nb-checkbox>
            <nb-checkbox [(ngModel)]="form.is_active">Active</nb-checkbox>
            <nb-checkbox [(ngModel)]="form.directory_opt_in">Show in directory</nb-checkbox>
          </div>
        </div>
      </nb-card-body>
      <nb-card-footer class="dialog-footer">
        <button nbButton ghost status="basic" (click)="cancel()">Cancel</button>
        <button nbButton status="primary" [disabled]="!form.name?.trim() || saving"
                (click)="save()">
          {{ saving ? 'Saving…' : (isEdit ? 'Save' : 'Add location') }}
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
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbIconModule, NbBadgeModule, NbSpinnerModule,
  ],
})
export class Locations implements OnInit {
  private service  = inject(ClinicLocationsService);
  private dialog   = inject(NbDialogService);
  private toastr   = inject(NbToastrService);
  private auth     = inject(AuthService);

  locations = signal<ClinicLocation[]>([]);
  loading   = signal(true);
  error     = signal<string | null>(null);

  /** Writable surfaces are doctor-or-manager only — receptionists see read-only.
   *  Wired to AuthService.canWriteAsDoctor which mirrors the backend
   *  `_require_doctor` guard. */
  readonly canWrite = this.auth.canWriteAsDoctor;

  async ngOnInit() { await this.refresh(); }

  async refresh() {
    this.loading.set(true);
    try {
      const res = await this.service.list();
      this.locations.set(res.items);
      this.error.set(null);
    } catch (e: any) {
      this.error.set(e?.error?.Message || e?.message || 'Failed to load locations');
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
        this.toastr.success('Location added', 'Saved', { duration: 2000 });
        await this.refresh();
      } catch (e: any) {
        this.toastr.danger(e?.error?.Message || e?.message || 'Failed to add location', 'Error');
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
        this.toastr.success('Location updated', 'Saved', { duration: 2000 });
        await this.refresh();
      } catch (e: any) {
        this.toastr.danger(e?.error?.Message || e?.message || 'Failed to update location', 'Error');
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
    const ok = window.confirm(
      `Delete location "${loc.name}"? Patients currently routed to this ` +
      `location will need to choose another at their next message.`
    );
    if (!ok) return;
    try {
      await this.service.remove(loc.location_id);
      this.toastr.success('Location deleted', 'Removed', { duration: 2000 });
      await this.refresh();
    } catch (e: any) {
      // The backend refuses to delete the only remaining location — surface
      // that as a friendlier toast.
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Failed to delete location',
        'Error',
      );
    }
  }
}

import { Injectable, computed, inject } from '@angular/core';
import { TenantSettingsService } from '../libs/service/tenant-settings.service';
import { DEFAULT_LABELS } from './label-dictionaries/default';
import { CLINICAL_LABELS } from './label-dictionaries/clinical';
import type { LabelDictionary, LabelKey, TenantVertical } from './label-dictionaries/types';

/**
 * LabelService — resolves user-visible labels based on the active tenant's
 * `vertical` field on TenantSettings.
 *
 * - `vertical === 'clinical'` → clinical dictionary (Patient / Appointment / Recall…)
 * - anything else (including missing field) → default dictionary (legacy Vorrai labels)
 *
 * Backend stays neutral; WebSocket event names on the wire are unchanged.
 * Page templates bind through `labelService.labels().<key>` or via the convenience
 * `labelService.get(key)` for one-off lookups.
 */
@Injectable({ providedIn: 'root' })
export class LabelService {
  private tenantSettings = inject(TenantSettingsService);

  /** Reactive dictionary — recomputes whenever TenantSettings changes. */
  readonly labels = computed<LabelDictionary>(() => {
    const vertical = (this.tenantSettings.settings()?.vertical ?? 'sales') as TenantVertical;
    return vertical === 'clinical' ? CLINICAL_LABELS : DEFAULT_LABELS;
  });

  /** Convenience accessor for templates that prefer a function call. */
  get(key: LabelKey): string {
    return this.labels()[key];
  }
}

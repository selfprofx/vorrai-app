import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TenantSettingsService } from '../libs/service/tenant-settings.service';
import { DEFAULT_LABELS } from './label-dictionaries/default';
import { LocaleService } from './locale.service';
import type { LabelDictionary, LabelKey, TenantVertical } from './label-dictionaries/types';

/**
 * LabelService — resolves user-visible labels by combining:
 *  - the tenant's `vertical` field (sales / clinical) → which dictionary
 *  - the active UI locale (en / pt-BR / es) → which translation file
 *
 * Translations live in `public/assets/i18n/<locale>.json` under
 * `vertical.<vertical>.<key>`. The `labels()` signal recomputes whenever
 * the tenant vertical, the active locale, or the loaded translations
 * change, so menus/headings flip live with the language switcher.
 *
 * Page templates bind through `labelService.labels().<key>` or via the
 * convenience `labelService.get(key)` for one-off lookups.
 */
@Injectable({ providedIn: 'root' })
export class LabelService {
  private tenantSettings = inject(TenantSettingsService);
  private translate      = inject(TranslateService);
  private locale         = inject(LocaleService);

  // Bumps whenever ngx-translate finishes loading a new language or
  // refreshes translations, so the `labels()` computed re-runs once the
  // strings are actually available (not just the lang code).
  private readonly _translationsTick = signal(0);

  // Keys to materialize per render — derived from the canonical default
  // dictionary so adding a key in one place propagates everywhere.
  private static readonly KEYS: readonly LabelKey[] =
    Object.keys(DEFAULT_LABELS) as LabelKey[];

  constructor() {
    this.translate.onLangChange.subscribe(() => this._translationsTick.update(v => v + 1));
    this.translate.onTranslationChange.subscribe(() => this._translationsTick.update(v => v + 1));
  }

  /** Reactive dictionary — recomputes on tenant vertical or locale change. */
  readonly labels = computed<LabelDictionary>(() => {
    this._translationsTick();
    this.locale.current();

    const vertical = (this.tenantSettings.settings()?.vertical ?? 'sales') as TenantVertical;
    return this._buildDictionary(vertical);
  });

  /** Convenience accessor for templates that prefer a function call. */
  get(key: LabelKey): string {
    return this.labels()[key];
  }

  private _buildDictionary(vertical: TenantVertical): LabelDictionary {
    const dict = {} as LabelDictionary;
    for (const key of LabelService.KEYS) {
      const value = this.translate.instant(`vertical.${vertical}.${key}`);
      // Fallback to the bundled English dictionary if the translation hasn't
      // loaded yet (prevents leaking raw `vertical.sales.dashboard` keys to
      // the UI on the very first render before HTTP loader returns).
      dict[key] = (value === `vertical.${vertical}.${key}`)
        ? DEFAULT_LABELS[key]
        : value;
    }
    return dict;
  }
}

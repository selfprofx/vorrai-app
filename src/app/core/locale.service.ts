import { Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { PrimeNG } from 'primeng/config';
import { PRIMENG_TRANSLATIONS } from './primeng-locales';

export type SupportedLocale = 'en' | 'pt-BR' | 'es';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'pt-BR', 'es'] as const;
export const DEFAULT_LOCALE: SupportedLocale = 'en';

const STORAGE_KEY = 'vorrai:locale';

export interface LocaleOption {
  code: SupportedLocale;
  label: string;
}

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { code: 'en',    label: 'English' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'es',    label: 'Español' },
];

/**
 * Application-wide locale source of truth.
 *
 * - Resolution order on boot: localStorage → navigator.language → 'en'.
 * - `init()` is awaited by an APP_INITIALIZER so the first paint is
 *   already in the user's language (no English flash).
 * - `setLocale()` swaps language at runtime; consumers should depend
 *   on the `current` signal for reactivity.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private translate = inject(TranslateService);
  private primeng   = inject(PrimeNG);

  readonly current = signal<SupportedLocale>(DEFAULT_LOCALE);

  /** FullCalendar uses lowercase region codes (`pt-br`). */
  fullCalendarCode(locale: SupportedLocale = this.current()): string {
    return locale.toLowerCase();
  }

  /**
   * Locale-aware date formatter. Use this in component code instead of
   * `Intl.DateTimeFormat('default', ...)` so the output flips with the
   * user's chosen language (signal access makes the caller reactive).
   */
  formatDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = {}): string {
    if (value == null || value === '') return '';
    const code = this.current();
    return new Intl.DateTimeFormat(code, options).format(new Date(value));
  }

  /** Locale-aware number formatter — same rationale as `formatDate`. */
  formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
    return new Intl.NumberFormat(this.current(), options).format(value);
  }

  async init(): Promise<void> {
    const stored = this._readStored();
    const fromBrowser = this._fromBrowser();
    const locale = stored ?? fromBrowser ?? DEFAULT_LOCALE;

    this.translate.addLangs([...SUPPORTED_LOCALES]);
    this.translate.setFallbackLang(DEFAULT_LOCALE);

    try {
      await firstValueFrom(this.translate.use(locale));
      this._applyPrimeng(locale);
      this.current.set(locale);
    } catch {
      // Locale file missing or HTTP error — fall back to default so the app
      // still boots in English rather than rendering raw translation keys.
      try { await firstValueFrom(this.translate.use(DEFAULT_LOCALE)); } catch { /* noop */ }
      this._applyPrimeng(DEFAULT_LOCALE);
      this.current.set(DEFAULT_LOCALE);
    }
  }

  async setLocale(locale: SupportedLocale): Promise<void> {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    if (locale === this.current()) return;
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* private mode / quota */ }
    try {
      await firstValueFrom(this.translate.use(locale));
      this._applyPrimeng(locale);
      this.current.set(locale);
    } catch {
      // Leave previous locale in place if the new one fails to load
    }
  }

  private _applyPrimeng(locale: SupportedLocale): void {
    const overrides = PRIMENG_TRANSLATIONS[locale];
    if (overrides && Object.keys(overrides).length) {
      this.primeng.setTranslation(overrides);
    }
  }

  private _readStored(): SupportedLocale | null {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v && (SUPPORTED_LOCALES as readonly string[]).includes(v)
        ? (v as SupportedLocale)
        : null;
    } catch {
      return null;
    }
  }

  private _fromBrowser(): SupportedLocale | null {
    const raw = (navigator.language || '').toLowerCase();
    if (raw.startsWith('pt')) return 'pt-BR';
    if (raw.startsWith('es')) return 'es';
    if (raw.startsWith('en')) return 'en';
    return null;
  }
}

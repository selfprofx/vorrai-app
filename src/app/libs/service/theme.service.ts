import { Injectable, signal, effect, inject, computed } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NbThemeService } from '@nebular/theme';
import { PrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { TenantSettingsService } from './tenant-settings.service';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'vendia-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);
  private nbTheme = inject(NbThemeService);
  private primeNG = inject(PrimeNG);
  private tenantSettings = inject(TenantSettingsService);

  readonly mode = signal<ThemeMode>(this.loadPreference());

  readonly isDark = computed(() => this.mode() === 'dark');

  /** Tracks whether the initial API load has been attempted. */
  private apiLoaded = false;

  constructor() {
    this.applyTheme(this.mode());

    effect(() => {
      this.applyTheme(this.mode());
    });

    // Load theme from API after auth is ready (non-blocking)
    this.loadFromApi();
  }

  toggle(): void {
    this.mode.update(m => (m === 'dark' ? 'light' : 'dark'));
    this.saveToApi(this.mode());
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    this.saveToApi(mode);
  }

  private applyTheme(mode: ThemeMode): void {
    // 1. CSS custom properties via data-theme attribute
    this.document.documentElement.setAttribute('data-theme', mode);

    // Also apply to CDK overlay container so context menus inherit theme vars
    const overlay = this.document.querySelector('.cdk-overlay-container');
    if (overlay) overlay.setAttribute('data-theme', mode);

    // 2. Nebular theme switch
    this.nbTheme.changeTheme(mode === 'dark' ? 'dark' : 'default');

    // 3. PrimeNG color scheme switch
    this.primeNG.theme.set({
      preset: Aura,
      options: {
        colorScheme: mode,
        darkModeSelector: '[data-theme="dark"]',
      },
    });

    // 4. Persist to localStorage (fast cache to prevent flash on reload)
    this.saveLocalPreference(mode);
  }

  private loadPreference(): ThemeMode {
    if (typeof localStorage === 'undefined') return 'dark';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  private saveLocalPreference(mode: ThemeMode): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }

  /** Load theme from tenant settings API (async, non-blocking). */
  private async loadFromApi(): Promise<void> {
    if (this.apiLoaded) return;
    try {
      await this.tenantSettings.load();
      const settings = this.tenantSettings.settings();
      if (settings?.theme && (settings.theme === 'dark' || settings.theme === 'light')) {
        const apiTheme = settings.theme;
        if (apiTheme !== this.mode()) {
          this.mode.set(apiTheme);
        }
      }
    } catch {
      // Silently fall back to localStorage preference
    } finally {
      this.apiLoaded = true;
    }
  }

  /** Persist theme to tenant settings API (fire-and-forget). */
  private saveToApi(mode: ThemeMode): void {
    this.tenantSettings.save({ theme: mode }).catch(() => {
      // Silently ignore API errors — localStorage is the fallback
    });
  }
}

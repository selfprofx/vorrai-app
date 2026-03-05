import { Injectable, signal, effect, inject, computed } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NbThemeService } from '@nebular/theme';
import { PrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'vendia-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);
  private nbTheme = inject(NbThemeService);
  private primeNG = inject(PrimeNG);

  readonly mode = signal<ThemeMode>(this.loadPreference());

  readonly isDark = computed(() => this.mode() === 'dark');

  constructor() {
    this.applyTheme(this.mode());

    effect(() => {
      this.applyTheme(this.mode());
    });
  }

  toggle(): void {
    this.mode.update(m => (m === 'dark' ? 'light' : 'dark'));
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private applyTheme(mode: ThemeMode): void {
    // 1. CSS custom properties via data-theme attribute
    this.document.documentElement.setAttribute('data-theme', mode);

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

    // 4. Persist
    this.savePreference(mode);
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

  private savePreference(mode: ThemeMode): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }
}

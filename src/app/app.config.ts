import { ApplicationConfig, importProvidersFrom, inject, LOCALE_ID, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withNavigationErrorHandler, NavigationError } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePtBr from '@angular/common/locales/pt';
import localeEs from '@angular/common/locales/es';
import { authInterceptor } from './libs/service/auth.interceptor';
import { routes } from './app.routes';
import { LocaleService, SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale } from './core/locale.service';

// Register non-default Angular locales so DatePipe/CurrencyPipe etc. can
// format with pt-BR and es. `en` is built in.
registerLocaleData(localePtBr, 'pt-BR');
registerLocaleData(localeEs, 'es');

/**
 * LOCALE_ID factory — captured once at bootstrap from localStorage /
 * navigator. Angular's locale-aware pipes (DatePipe, CurrencyPipe, ...)
 * read LOCALE_ID via DI at construction time and won't pick up runtime
 * changes; for those, pass `localeService.current()` explicitly as the
 * pipe's locale argument.
 */
function resolveBootstrapLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem('vorrai:locale');
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored as SupportedLocale;
    }
  } catch { /* private mode */ }
  const raw = (navigator.language || '').toLowerCase();
  if (raw.startsWith('pt')) return 'pt-BR';
  if (raw.startsWith('es')) return 'es';
  if (raw.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

// ngx-translate v17 — runtime i18n with ICU MessageFormat for pluralization
import {
  provideTranslateService,
  provideTranslateCompiler,
} from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateMessageFormatCompiler } from 'ngx-translate-messageformat-compiler';

// AWS Amplify
import { Amplify } from 'aws-amplify';

// Nebular imports
import { NbThemeModule, NbLayoutModule, NbCardModule, NbButtonModule,
         NbIconModule, NbSidebarModule, NbMenuModule, NbContextMenuModule,
         NbUserModule, NbInputModule, NbToastrModule, NbDialogModule } from '@nebular/theme';

import { NbEvaIconsModule } from '@nebular/eva-icons';

// Prime imports
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Vorrai brand preset — anchors PrimeNG's primary ramp on Imperial Green
// so buttons, focus rings and highlights never fall back to Aura's
// default institutional blue.
const VorraiPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#E6EEEB', 100: '#C0D5CE', 200: '#96BAAF',
      300: '#6B9E8F', 400: '#4A8676', 500: '#004B3C',
      600: '#004436', 700: '#003B2F', 800: '#003328',
      900: '#002E25', 950: '#00211B',
    },
  },
});

import { FullCalendarModule } from '@fullcalendar/angular';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';

// ---------------------------------------------------------------------------
// Cognito configuration — values injected at build time via angular.json define
// ---------------------------------------------------------------------------
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.COGNITO_CLIENT_ID,
    },
  },
});


export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),

    { provide: LOCALE_ID, useFactory: resolveBootstrapLocale },

    // Router — auto-recover from stale-deploy chunk errors. After a redeploy
    // every lazy chunk is re-hashed; a tab left open since before the deploy
    // then fails to load a route ("Failed to fetch dynamically imported
    // module"). Reload once to pull a fresh index.html with the new hashes.
    // The timestamp guard stops a reload loop if the chunk is genuinely gone.
    provideRouter(
      routes,
      withNavigationErrorHandler((event: NavigationError) => {
        const message = String((event.error as { message?: string } | undefined)?.message ?? event.error);
        const staleChunk = /dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(message);
        if (!staleChunk) return;

        const RELOAD_KEY = 'vorrai:chunk-reload-at';
        const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - lastReload < 10_000) return;  // already retried — let the error surface
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }),
    ),

    // HttpClient (needed for services + ngx-translate http loader)
    provideHttpClient(withInterceptors([authInterceptor])),

    // i18n — ngx-translate with ICU MessageFormat compiler and HTTP loader
    // pulling JSON from /assets/i18n/<locale>.json (the loader's defaults).
    // useHttpBackend bypasses the auth interceptor for translation fetches.
    provideTranslateService({
      defaultLanguage: 'en',
    }),
    provideTranslateHttpLoader({ useHttpBackend: true }),
    provideTranslateCompiler(TranslateMessageFormatCompiler),

    // App init — read stored/browser locale and switch ngx-translate before
    // the first component renders, so labels never flash English first.
    provideAppInitializer(() => inject(LocaleService).init()),

    providePrimeNG({
      theme: {
        preset: VorraiPreset,
        options: {
          colorScheme: 'light',
        },
      },
      ripple: true,
    }),

    // Nebular modules globally
    importProvidersFrom(
      NbThemeModule.forRoot({ name: 'corporate' }),
      NbLayoutModule,
      NbCardModule,
      NbButtonModule,
      NbIconModule,
      NbEvaIconsModule,
      NbInputModule,
      NbContextMenuModule,
      NbUserModule,
      NbSidebarModule.forRoot(),
      NbMenuModule.forRoot(),
      NbToastrModule.forRoot(),
      NbDialogModule.forRoot()
    ),

    FullCalendarModule,

    provideMonacoEditor({
      baseUrl: './assets/monaco',
      defaultOptions: { scrollBeyondLastLine: false, minimap: { enabled: false } },
    }),
  ]
};

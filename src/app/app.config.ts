import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withNavigationErrorHandler, NavigationError } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './libs/service/auth.interceptor';
import { routes } from './app.routes';

// AWS Amplify
import { Amplify } from 'aws-amplify';

// Nebular imports
import { NbThemeModule, NbLayoutModule, NbCardModule, NbButtonModule,
         NbIconModule, NbSidebarModule, NbMenuModule, NbContextMenuModule,
         NbUserModule, NbInputModule, NbToastrModule } from '@nebular/theme';

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

    // HttpClient (needed for services)
    provideHttpClient(withInterceptors([authInterceptor])),

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
      NbToastrModule.forRoot()
    ),

    FullCalendarModule,

    provideMonacoEditor({
      baseUrl: './assets/monaco',
      defaultOptions: { scrollBeyondLastLine: false, minimap: { enabled: false } },
    }),
  ]
};

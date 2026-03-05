import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
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
import Aura from '@primeuix/themes/aura';

import { FullCalendarModule } from '@fullcalendar/angular';

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

    // Router
    provideRouter(routes),

    // HttpClient (needed for services)
    provideHttpClient(withInterceptorsFromDi()),

    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          colorScheme: 'dark',
          darkModeSelector: '[data-theme="dark"]',
        },
      },
      ripple: true,
    }),

    // Nebular modules globally
    importProvidersFrom(
      NbThemeModule.forRoot({ name: 'dark' }),
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

    FullCalendarModule
  ]
};

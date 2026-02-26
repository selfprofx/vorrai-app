import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { routes } from './app.routes';

// AWS Amplify
import { Amplify } from 'aws-amplify';

// Nebular imports
import { NbThemeModule, NbLayoutModule, NbCardModule, NbButtonModule,
         NbIconModule, NbSidebarModule, NbMenuModule, NbContextMenuModule,
         NbUserModule, NbInputModule } from '@nebular/theme';

import { NbEvaIconsModule } from '@nebular/eva-icons';

// Prime imports
import { providePrimeNG } from 'primeng/config';
import AuraDark from '@primeuix/themes/aura';

import { FullCalendarModule } from '@fullcalendar/angular';

// ---------------------------------------------------------------------------
// Cognito configuration — replace placeholder values with your actual IDs
// after running scripts/setup_cognito.py
// ---------------------------------------------------------------------------
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: (window as any).__COGNITO_USER_POOL_ID__ ?? 'us-east-1_PLACEHOLDER',
      userPoolClientId: (window as any).__COGNITO_CLIENT_ID__ ?? 'PLACEHOLDER_CLIENT_ID',
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
        preset: AuraDark,
        options: {
          colorScheme: 'dark',
          autoDarkMode: false,
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
      NbMenuModule.forRoot()
    ),

    FullCalendarModule
  ]
};

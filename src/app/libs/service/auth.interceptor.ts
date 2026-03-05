import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Functional HTTP interceptor that ensures every outbound request carries
 * a fresh Cognito ID token.  Amplify's `fetchAuthSession()` automatically
 * uses the refresh token when the ID token has expired, so callers never
 * see a stale JWT.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (!auth.isAuthenticated()) return next(req);

  return from(auth.getFreshIdToken()).pipe(
    switchMap(token => {
      if (token) {
        req = req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        });
      }
      return next(req);
    }),
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

export const managerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;

  if (!auth.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  if (!auth.isManager()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};

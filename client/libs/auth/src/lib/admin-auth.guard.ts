import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Stricter guard for admin routes: requires a token issued via password login,
 * not a pin login. A valid pin token is rejected so admin access always demands
 * a fresh email/password sign-in even if the user is already signed into POS.
 */
export const adminAuthGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    await authService.loadStoredUser();
  }

  if (authService.isPasswordAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

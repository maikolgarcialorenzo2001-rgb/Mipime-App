import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { SetupService } from '../services/setup.service';
import { AuthService } from '../services/auth.service';

export const setupGuard: CanActivateFn = (route) => {
  const setup = inject(SetupService);
  const router = inject(Router);
  const auth = inject(AuthService);

  return setup.countUsers().then((count) => {
    const isSetupRoute = route.routeConfig?.path === 'setup';
    if (count === 0) {
      return isSetupRoute ? true : router.parseUrl('/setup');
    }
    if (isSetupRoute) {
      return auth.isLoggedIn() ? router.parseUrl('/pos') : router.parseUrl('/login');
    }
    return true;
  });
};
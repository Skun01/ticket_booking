import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const adminGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  await session.initialize();
  if (!session.user())
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (!session.isAdmin()) return router.createUrlTree(['/forbidden']);
  return true;
};

import { CurrentUser } from './session.service';

/** Trang đích mặc định sau khi đăng nhập, theo vai trò. */
export function homeRouteFor(user: CurrentUser | null): string {
  switch (user?.role) {
    case 'ADMIN':
      return '/admin';
    case 'ORGANIZER':
      return '/organizer';
    case 'CUSTOMER':
      return '/events';
    default:
      return '/';
  }
}

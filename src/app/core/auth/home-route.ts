import { CurrentUser } from './session.service';

/** Chỉ nhận các đích nội bộ đã biết và đúng vai trò. */
export function postLoginRoute(user: CurrentUser, returnUrl: string | null): string {
  if (returnUrl && /^\/events(?:\/[1-9]\d*)?$/.test(returnUrl)) return returnUrl;
  if (
    user.role === 'CUSTOMER' &&
    returnUrl &&
    (/^\/events\/[1-9]\d*\/book(?:\?ticketTypeId=[1-9]\d*)?$/.test(returnUrl) ||
      /^\/orders(?:\/[1-9]\d*)?$/.test(returnUrl) ||
      returnUrl === '/tickets')
  )
    return returnUrl;
  if (
    user.role === 'ORGANIZER' &&
    returnUrl &&
    /^\/organizer(?:\/checkin|\/events\/(?:new|[1-9]\d*(?:\/(?:edit|report))?))?$/.test(returnUrl)
  )
    return returnUrl;
  return homeRouteFor(user);
}

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

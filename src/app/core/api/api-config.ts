import { InjectionToken } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8080/api',
});

export function isApiUrl(url: string, baseUrl: string): boolean {
  try {
    const base = new URL(baseUrl, window.location.origin);
    const target = new URL(url, window.location.origin);
    const path = base.pathname.replace(/\/$/, '');
    return target.origin === base.origin &&
      (target.pathname === path || target.pathname.startsWith(`${path}/`));
  } catch {
    return false;
  }
}

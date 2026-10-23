import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { timeout } from 'rxjs';
import { API_BASE_URL, isApiUrl } from './api-config';

/** Giới hạn chờ để UI có thể thoát loading; không retry (nhất là thao tác ghi). */
export const requestTimeoutInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(API_BASE_URL).replace(/\/$/, '');
  return isApiUrl(request.url, base) ? next(request).pipe(timeout(30000)) : next(request);
};

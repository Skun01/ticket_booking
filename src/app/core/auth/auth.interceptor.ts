import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE_URL, isApiUrl } from '../api/api-config';
import { SessionService } from './session.service';

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return request.clone({
    withCredentials: false,
    headers: token
      ? request.headers.set('Authorization', `Bearer ${token}`)
      : request.headers.delete('Authorization'),
  });
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(API_BASE_URL).replace(/\/$/, '');
  if (!isApiUrl(request.url, base)) return next(request);
  const path = new URL(request.url, window.location.origin).pathname;
  const authPath = `${new URL(base, window.location.origin).pathname}/auth`;
  if (path === authPath || path.startsWith(`${authPath}/`)) {
    return next(
      request.clone({ withCredentials: true, headers: request.headers.delete('Authorization') }),
    );
  }

  const session = inject(SessionService);
  return from(session.initialize()).pipe(
    switchMap(() => {
      const token = session.accessToken();
      const revision = session.revision();
      return next(withToken(request, token)).pipe(
        catchError((error: unknown) => {
          if (
            !(error instanceof HttpErrorResponse) ||
            error.status !== 401 ||
            !token ||
            !['GET', 'HEAD'].includes(request.method) ||
            revision !== session.revision()
          ) {
            // Không replay POST tạo đơn/thanh toán khi 401; cho phép đăng nhập lại ở UI.
            if (
              error instanceof HttpErrorResponse &&
              error.status === 401 &&
              token &&
              revision === session.revision() &&
              !['GET', 'HEAD'].includes(request.method)
            ) {
              session.invalidate(token);
            }
            return throwError(() => error);
          }

          // Một phản hồi 401 đến muộn có thể vẫn dùng token cũ dù request khác đã refresh xong.
          const current = session.accessToken();
          if (!current) return throwError(() => error);
          const renewal =
            current !== token ? Promise.resolve(current) : session.refreshAccessToken();
          return from(renewal).pipe(
            switchMap((renewedToken) => {
              if (revision !== session.revision()) return throwError(() => error);
              return next(withToken(request, renewedToken)).pipe(
                catchError((retryError: unknown) => {
                  if (
                    retryError instanceof HttpErrorResponse &&
                    retryError.status === 401 &&
                    revision === session.revision()
                  ) {
                    session.invalidate(renewedToken);
                  }
                  return throwError(() => retryError);
                }),
              );
            }),
          );
        }),
      );
    }),
  );
};

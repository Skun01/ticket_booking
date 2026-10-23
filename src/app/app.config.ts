import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { requestTimeoutInterceptor } from './core/api/request-timeout.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // NavigationUxService hiển thị lỗi/tải lại; không tạo rejection thứ hai từ routerLink.
      withRouterConfig({ resolveNavigationPromiseOnError: true }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([requestTimeoutInterceptor, authInterceptor])),
  ],
};

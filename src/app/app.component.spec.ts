import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app.component';
import { routes } from './app.routes';
import { SessionService } from './core/auth/session.service';

const sessionMock = {
  user: signal(null),
  loading: signal(false),
  restoreFailed: signal(false),
  isAdmin: signal(false),
  isAuthenticated: signal(false),
  isCustomer: signal(false),
  isOrganizer: signal(false),
  initialize: () => Promise.resolve(),
};

describe('Application Shell', () => {
  beforeEach(() => {
    sessionMock.user.set(null);
    sessionMock.isAdmin.set(false);
    sessionMock.isAuthenticated.set(false);
    sessionMock.isCustomer.set(false);
    sessionMock.isOrganizer.set(false);
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: sessionMock },
      ],
    });
  });

  it('boots the application shell without throwing', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it.each(['success', 'cancel'])('preserves the PayOS %s callback while requesting login', async (result) => {
    const harness = await RouterTestingHarness.create();
    const returnUrl = `/payment/${result}?orderCode=42&id=payos-link&status=PAID`;
    await harness.navigateByUrl(returnUrl);
    const router = TestBed.inject(Router);
    expect(router.parseUrl(router.url).root.children['primary'].segments[0].path).toBe('login');
    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe(returnUrl);
  });

  it('loads the home page at /', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/');
    expect(component).toBeTruthy();
    expect(harness.routeNativeElement?.textContent).toContain('Gặp điều tuyệt vời.');
  });
});

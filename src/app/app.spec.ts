import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { SessionService } from './core/auth/session.service';

const sessionMock = {
  user: signal(null),
  loading: signal(false),
  restoreFailed: signal(false),
  isAdmin: signal(false),
  isAuthenticated: signal(false),
  initialize: () => Promise.resolve(),
};

describe('Application Shell', () => {
  beforeEach(() => {
    sessionMock.user.set(null);
    sessionMock.isAdmin.set(false);
    sessionMock.isAuthenticated.set(false);
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

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('creates the root component', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the home page at /', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.textContent).toContain('Fullstack Starter');
  });
});

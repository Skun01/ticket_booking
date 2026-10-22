import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { authInterceptor } from './auth.interceptor';
import { CurrentUser, SessionService } from './session.service';

const base = 'http://localhost:8080/api';
const admin: CurrentUser = { id: 1, email: 'admin@example.test', fullName: 'Quản trị', role: 'ADMIN' };
const token = (value: string) => ({ accessToken: value, tokenType: 'Bearer', expiresIn: 900 });
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Session and API authentication', () => {
  let session: SessionService;
  let http: HttpClient;
  let requests: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: base },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    session = TestBed.inject(SessionService);
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => requests.verify());

  async function anonymous(): Promise<void> {
    const initialization = session.initialize();
    await settle();
    requests.expectOne(`${base}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await initialization;
  }

  async function signIn(): Promise<void> {
    await anonymous();
    const login = session.login(admin.email, 'test-password');
    await settle();
    const request = requests.expectOne(`${base}/auth/login`);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(token('access-one'));
    await settle();
    const profile = requests.expectOne(`${base}/users/me`);
    expect(profile.request.headers.get('Authorization')).toBe('Bearer access-one');
    profile.flush(admin);
    await login;
  }

  it('restores the cookie session once and fetches the real profile', async () => {
    const first = session.initialize();
    expect(session.initialize()).toBe(first);
    await settle();
    const refresh = requests.expectOne(`${base}/auth/refresh`);
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush(token('restored'));
    await settle();
    requests.expectOne(`${base}/users/me`).flush(admin);
    await first;
    expect(session.user()).toEqual(admin);
    expect(session.isAdmin()).toBe(true);
    expect(session.loading()).toBe(false);
  });

  it('treats a missing refresh cookie as an anonymous session', async () => {
    await anonymous();
    expect(session.user()).toBeNull();
    expect(session.restoreFailed()).toBe(false);
    expect(session.loading()).toBe(false);
  });

  it('records connection failure separately from a missing cookie', async () => {
    const initialized = session.initialize();
    await settle();
    requests.expectOne(`${base}/auth/refresh`).error(new ProgressEvent('error'));
    await initialized;
    expect(session.restoreFailed()).toBe(true);
    expect(session.accessToken()).toBeNull();
  });

  it('logs in and clears the local session before logout completes', async () => {
    await signIn();
    const logout = session.logout();
    expect(session.accessToken()).toBeNull();
    expect(session.user()).toBeNull();
    await settle();
    const request = requests.expectOne(`${base}/auth/logout`);
    expect(request.request.withCredentials).toBe(true);
    request.flush(null, { status: 204, statusText: 'No Content' });
    await logout;
  });

  it('shares one refresh across concurrent 401s and retries with the new token', async () => {
    await signIn();
    const one = firstValueFrom(http.get(`${base}/one`));
    const two = firstValueFrom(http.get(`${base}/two`));
    await settle();
    requests.expectOne(`${base}/one`).flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne(`${base}/two`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    requests.expectOne(`${base}/auth/refresh`).flush(token('access-two'));
    await settle();
    for (const path of ['one', 'two']) {
      const retry = requests.expectOne(`${base}/${path}`);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-two');
      retry.flush({ ok: true });
    }
    expect(await one).toEqual({ ok: true });
    expect(await two).toEqual({ ok: true });
  });

  it('reuses a completed refresh for a late 401 from the previous token', async () => {
    await signIn();
    const one = firstValueFrom(http.get(`${base}/one`));
    const two = firstValueFrom(http.get(`${base}/two`));
    await settle();
    const late = requests.expectOne(`${base}/two`);
    requests.expectOne(`${base}/one`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    requests.expectOne(`${base}/auth/refresh`).flush(token('access-two'));
    await settle();
    requests.expectOne(`${base}/one`).flush({});
    await one;
    late.flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    requests.expectNone(`${base}/auth/refresh`);
    const retry = requests.expectOne(`${base}/two`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-two');
    retry.flush({});
    await two;
  });

  it('clears the session when refresh fails without retrying the original request', async () => {
    await signIn();
    const result = firstValueFrom(http.get(`${base}/one`)).catch((error) => error);
    await settle();
    requests.expectOne(`${base}/one`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    requests.expectOne(`${base}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect((await result).status).toBe(401);
    expect(session.user()).toBeNull();
    requests.expectNone(`${base}/one`);
  });

  it('does not enter a refresh loop if the retried request also returns 401', async () => {
    await signIn();
    const result = firstValueFrom(http.get(`${base}/one`)).catch((error) => error);
    await settle();
    requests.expectOne(`${base}/one`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    requests.expectOne(`${base}/auth/refresh`).flush(token('access-two'));
    await settle();
    requests.expectOne(`${base}/one`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect((await result).status).toBe(401);
    expect(session.user()).toBeNull();
    requests.expectNone(`${base}/auth/refresh`);
  });

  it('never refreshes on 403', async () => {
    await signIn();
    const result = firstValueFrom(http.get(`${base}/one`)).catch((error) => error);
    await settle();
    requests.expectOne(`${base}/one`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect((await result).status).toBe(403);
    expect(session.user()).toEqual(admin);
    requests.expectNone(`${base}/auth/refresh`);
  });

  it('does not attach credentials or tokens to other origins or lookalike paths', async () => {
    await signIn();
    for (const url of [
      'https://example.test/api/one',
      'http://localhost:8080/api-other/one',
      'http://localhost.evil.test:8080/api/one',
    ]) {
      const result = firstValueFrom(http.get(url));
      const request = requests.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.withCredentials).toBe(false);
      request.flush({});
      await result;
    }
  });

  it('excludes auth endpoints from bearer headers and automatic refresh', async () => {
    await signIn();
    const result = firstValueFrom(
      http.post(`${base}/auth/login`, {}, {
        headers: { Authorization: 'Bearer ignored' },
      }),
    ).catch((error) => error);
    const request = requests.expectOne(`${base}/auth/login`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.withCredentials).toBe(true);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    await result;
    requests.expectNone(`${base}/auth/refresh`);
  });

  it('waits for a rotating cookie before logout and never restores the old session', async () => {
    await signIn();
    const refresh = session.refreshAccessToken().catch((error) => error);
    await settle();
    const pending = requests.expectOne(`${base}/auth/refresh`);
    const logout = session.logout();
    expect(session.user()).toBeNull();
    requests.expectNone(`${base}/auth/logout`);
    pending.flush(token('too-late'));
    await refresh;
    await settle();
    requests.expectOne(`${base}/auth/logout`).flush(null);
    await logout;
    expect(session.accessToken()).toBeNull();
    expect(session.user()).toBeNull();
  });
});

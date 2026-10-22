import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';

export interface CurrentUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'ADMIN' | 'ORGANIZER' | 'CUSTOMER';
  status: 'ACTIVE' | 'LOCKED';
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly base = inject(API_BASE_URL).replace(/\/$/, '');
  private readonly userState = signal<CurrentUser | null>(null);
  private readonly tokenState = signal<string | null>(null);
  private readonly loadingState = signal(true);
  private readonly restoreErrorState = signal(false);
  private initialization?: Promise<void>;
  private refreshRequest?: { generation: number; promise: Promise<string> };
  private cookieQueue: Promise<unknown> = Promise.resolve();
  private generation = 0;

  readonly user = this.userState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly restoreFailed = this.restoreErrorState.asReadonly();
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly isOrganizer = computed(() => this.user()?.role === 'ORGANIZER');
  readonly isCustomer = computed(() => this.user()?.role === 'CUSTOMER');
  readonly isAuthenticated = computed(() => !!this.user());

  accessToken(): string | null {
    return this.tokenState();
  }

  revision(): number {
    return this.generation;
  }

  initialize(): Promise<void> {
    if (!this.initialization) {
      const generation = this.generation;
      this.initialization = this.restore(generation);
    }
    return this.initialization;
  }

  async login(email: string, password: string): Promise<CurrentUser> {
    await this.initialize();
    return this.establishSession('login', { email, password });
  }

  async register(email: string, password: string, fullName: string): Promise<CurrentUser> {
    await this.initialize();
    return this.establishSession('register', { email, password, fullName });
  }

  async logout(): Promise<void> {
    ++this.generation;
    this.userState.set(null);
    this.tokenState.set(null);
    this.loadingState.set(false);
    this.restoreErrorState.set(false);
    // Chờ yêu cầu xoay cookie trước đó kết thúc để logout thu hồi đúng token mới nhất.
    await this.authPost<void>('logout', {});
  }

  refreshAccessToken(): Promise<string> {
    const generation = this.generation;
    if (this.refreshRequest?.generation === generation) return this.refreshRequest.promise;

    const promise = this.authPost<TokenResponse>('refresh', {}).then((response) => {
      this.assertCurrent(generation);
      this.tokenState.set(response.accessToken);
      return response.accessToken;
    }).catch((error: unknown) => {
      if (generation === this.generation) this.invalidate(this.tokenState());
      throw error;
    }).finally(() => {
      if (this.refreshRequest?.promise === promise) this.refreshRequest = undefined;
    });
    this.refreshRequest = { generation, promise };
    return promise;
  }

  invalidate(expectedToken: string | null): void {
    if (this.tokenState() !== expectedToken) return;
    this.tokenState.set(null);
    this.userState.set(null);
  }

  private async establishSession(action: string, body: unknown): Promise<CurrentUser> {
    const generation = ++this.generation;
    this.userState.set(null);
    this.tokenState.set(null);
    this.restoreErrorState.set(false);
    const response = await this.authPost<TokenResponse>(action, body);
    this.assertCurrent(generation);
    this.tokenState.set(response.accessToken);
    try {
      const user = await this.loadUser(response.accessToken);
      this.assertCurrent(generation);
      this.userState.set(user);
      return user;
    } catch (error) {
      if (generation === this.generation) this.invalidate(response.accessToken);
      throw error;
    }
  }

  private async restore(generation: number): Promise<void> {
    try {
      const token = await this.refreshAccessToken();
      const user = await this.loadUser(token);
      this.assertCurrent(generation);
      this.userState.set(user);
    } catch (error) {
      if (generation === this.generation) {
        this.userState.set(null);
        this.tokenState.set(null);
        this.restoreErrorState.set(!(error instanceof HttpErrorResponse && error.status === 401));
      }
    } finally {
      if (generation === this.generation) this.loadingState.set(false);
    }
  }

  private loadUser(token: string): Promise<CurrentUser> {
    return firstValueFrom(this.http.get<CurrentUser>(`${this.base}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(timeout(10000)));
  }

  private authPost<T>(action: string, body: unknown): Promise<T> {
    const request = this.cookieQueue.catch(() => undefined).then(() => firstValueFrom(
      this.http.post<T>(`${this.base}/auth/${action}`, body, { withCredentials: true })
        .pipe(timeout(10000)),
    ));
    this.cookieQueue = request;
    return request;
  }

  private assertCurrent(generation: number): void {
    if (generation !== this.generation) throw new Error('Session changed');
  }
}

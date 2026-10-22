import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { apiError } from '../../core/api/api-error';
import { homeRouteFor } from '../../core/auth/home-route';
import { SessionService } from '../../core/auth/session.service';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    Icon,
  ],
  template: `
    <section class="login-card" aria-labelledby="login-title">
      <p class="eyebrow">XÁC THỰC TÀI KHOẢN</p>
      <h1 id="login-title">Đăng nhập</h1>
      <p class="muted">Nhập email và mật khẩu của bạn để tiếp tục.</p>

      @if (session.loading()) {
        <p role="status">Đang kiểm tra phiên đăng nhập…</p>
      }
      @if (session.restoreFailed()) {
        <p class="form-notice warning" role="status">
          Chưa khôi phục được phiên đăng nhập. Vui lòng kiểm tra kết nối máy chủ.
        </p>
      }
      @if (error()) {
        <p class="form-notice error" role="alert">{{ error() }}</p>
      }

      @if (session.isAuthenticated()) {
        <p>
          Bạn đã đăng nhập với tài khoản <strong>{{ session.user()?.email }}</strong
          >.
        </p>
        <div class="form-actions">
          @if (session.isAdmin()) {
            <a mat-flat-button routerLink="/admin">Vào khu vực quản trị</a>
          } @else {
            <a mat-flat-button routerLink="/">Về trang chủ</a>
          }
          <button mat-stroked-button type="button" (click)="logout()">Đăng xuất</button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Email</mat-label>
            <input
              matInput
              id="email"
              type="email"
              formControlName="email"
              autocomplete="username"
              [errorStateMatcher]="emailMatcher"
            />
            @if (emailError()) {
              <mat-error>{{ emailError() }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Mật khẩu</mat-label>
            <input
              matInput
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              [errorStateMatcher]="passwordMatcher"
            />
            @if (passwordError()) {
              <mat-error>{{ passwordError() }}</mat-error>
            }
          </mat-form-field>

          <button
            mat-flat-button
            type="submit"
            [disabled]="busy() || session.loading()"
            [attr.aria-busy]="busy()"
          >
            <app-icon name="login" /> {{ busy() ? 'Đang xử lý…' : 'Đăng nhập' }}
          </button>
        </form>
        <p class="login-footnote">
          Chưa có tài khoản? <a routerLink="/register">Đăng ký tài khoản mới</a>
        </p>
      }
    </section>
  `,
})
export class LoginPage {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly emailMatcher: ErrorStateMatcher = { isErrorState: () => !!this.emailError() };
  protected readonly passwordMatcher: ErrorStateMatcher = {
    isErrorState: () => !!this.passwordError(),
  };

  protected emailError(): string {
    const field = this.form.controls.email;
    return field.touched && field.invalid
      ? 'Vui lòng nhập email hợp lệ.'
      : this.fieldErrors()['email'] || '';
  }

  protected passwordError(): string {
    const field = this.form.controls.password;
    return field.touched && field.invalid
      ? 'Vui lòng nhập mật khẩu.'
      : this.fieldErrors()['password'] || '';
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.session.loading()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    this.fieldErrors.set({});
    if (this.form.invalid) return;

    this.busy.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      const user = await this.session.login(email.trim(), password);
      this.form.controls.password.reset();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      // Chỉ nhận route sự kiện nội bộ, không nhận URL bên ngoài hay route tùy ý.
      const destination =
        returnUrl && /^\/events(?:\/[1-9]\d*)?$/.test(returnUrl) ? returnUrl : homeRouteFor(user);
      await this.router.navigateByUrl(destination);
    } catch (err) {
      const problem = apiError(err);
      this.error.set(problem.message);
      this.fieldErrors.set(problem.fields);
    } finally {
      this.busy.set(false);
    }
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
  }
}

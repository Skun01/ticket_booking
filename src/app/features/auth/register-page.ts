import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { apiError } from '../../core/api/api-error';
import { postLoginRoute } from '../../core/auth/home-route';
import { SessionService } from '../../core/auth/session.service';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-register-page',
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
    <section class="login-card" aria-labelledby="register-title">
      <p class="eyebrow">TẠO TÀI KHOẢN</p>
      <h1 id="register-title">Đăng ký</h1>
      <p class="muted">Đăng ký tài khoản mới để trải nghiệm đầy đủ tính năng.</p>

      @if (error()) {
        <p class="form-notice error" role="alert">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field appearance="outline" class="form-field">
          <mat-label>Họ và tên</mat-label>
          <input
            matInput
            id="fullName"
            type="text"
            formControlName="fullName"
            autocomplete="name"
            [errorStateMatcher]="fullNameMatcher"
          />
          @if (fullNameError()) {
            <mat-error>{{ fullNameError() }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="form-field">
          <mat-label>Email</mat-label>
          <input
            matInput
            id="email"
            type="email"
            formControlName="email"
            autocomplete="email"
            [errorStateMatcher]="emailMatcher"
          />
          @if (emailError()) {
            <mat-error>{{ emailError() }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="form-field">
          <mat-label>Mật khẩu (tối thiểu 8 ký tự)</mat-label>
          <input
            matInput
            id="password"
            type="password"
            formControlName="password"
            autocomplete="new-password"
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
          <app-icon name="user" /> {{ busy() ? 'Đang tạo tài khoản…' : 'Đăng ký' }}
        </button>
      </form>

      <p class="login-footnote">
        Đã có tài khoản?
        <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl }">Đăng nhập tại đây</a>
      </p>
    </section>
  `,
})
export class RegisterPage {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  protected readonly fullNameMatcher: ErrorStateMatcher = {
    isErrorState: () => !!this.fullNameError(),
  };
  protected readonly emailMatcher: ErrorStateMatcher = { isErrorState: () => !!this.emailError() };
  protected readonly passwordMatcher: ErrorStateMatcher = {
    isErrorState: () => !!this.passwordError(),
  };

  protected fullNameError(): string {
    const field = this.form.controls.fullName;
    return field.touched && field.invalid
      ? 'Vui lòng nhập họ và tên.'
      : this.fieldErrors()['fullName'] || '';
  }

  protected emailError(): string {
    const field = this.form.controls.email;
    return field.touched && field.invalid
      ? 'Vui lòng nhập email hợp lệ.'
      : this.fieldErrors()['email'] || '';
  }

  protected passwordError(): string {
    const field = this.form.controls.password;
    if (field.touched && field.invalid) {
      if (field.hasError('minlength')) return 'Mật khẩu phải có tối thiểu 8 ký tự.';
      return 'Vui lòng nhập mật khẩu.';
    }
    return this.fieldErrors()['password'] || '';
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.session.loading()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    this.fieldErrors.set({});
    if (this.form.invalid) return;

    this.busy.set(true);
    try {
      const { email, password, fullName } = this.form.getRawValue();
      const user = await this.session.register(email.trim(), password, fullName.trim());
      await this.router.navigateByUrl(postLoginRoute(user, this.returnUrl));
    } catch (err) {
      const problem = apiError(err);
      this.error.set(problem.message);
      this.fieldErrors.set(problem.fields);
    } finally {
      this.busy.set(false);
    }
  }
}

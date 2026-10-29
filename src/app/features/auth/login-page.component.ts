import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FeedbackService } from '../../shared/feedback.service';
import { homeRouteFor, postLoginRoute } from '../../core/auth/home-route';
import { SessionService } from '../../core/auth/session.service';
import { Icon } from '../../shared/icon.component';

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
  templateUrl: './login-page.component.html',
  
})
export class LoginPage {
  private readonly feedback = inject(FeedbackService);
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  protected readonly busy = signal(false);
  protected readonly signingOut = signal(false);
  protected homeRoute(): UrlTree {
    const user = this.session.user();
    return this.router.parseUrl(user ? postLoginRoute(user, this.returnUrl) : homeRouteFor(user));
  }
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
    if (this.busy() || this.signingOut() || this.session.loading()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    this.fieldErrors.set({});
    if (this.form.invalid) {
      document.querySelector<HTMLElement>('form .ng-invalid input, form input.ng-invalid')?.focus();
      return;
    }

    this.busy.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      const user = await this.session.login(email.trim(), password);
      this.form.controls.password.reset();
      this.feedback.success('Đã đăng nhập.');
      await this.router.navigateByUrl(postLoginRoute(user, this.returnUrl));
    } catch (err) {
      const problem = this.feedback.problem(err);
      this.error.set(problem.message);
      this.fieldErrors.set(problem.fields);
    } finally {
      this.busy.set(false);
    }
  }

  protected async logout(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.session.logout();
      this.feedback.success('Đã đăng xuất.');
    } catch {
      this.feedback.error(
        'Đã xóa phiên trên thiết bị nhưng chưa xác nhận đăng xuất trên máy chủ. Kiểm tra kết nối trước khi tiếp tục.',
        true,
      );
    } finally {
      this.signingOut.set(false);
    }
  }
}

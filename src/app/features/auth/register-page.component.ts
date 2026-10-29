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
  templateUrl: './register-page.component.html',
  
})
export class RegisterPage {
  private readonly feedback = inject(FeedbackService);
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  protected readonly busy = signal(false);
  protected homeRoute(): UrlTree {
    const user = this.session.user();
    return this.router.parseUrl(user ? postLoginRoute(user, this.returnUrl) : homeRouteFor(user));
  }
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
    if (this.busy() || this.session.loading() || this.session.isAuthenticated()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    this.fieldErrors.set({});
    if (this.form.invalid) {
      document.querySelector<HTMLElement>('form input.ng-invalid')?.focus();
      return;
    }

    this.busy.set(true);
    try {
      const { email, password, fullName } = this.form.getRawValue();
      const user = await this.session.register(email.trim(), password, fullName.trim());
      this.form.controls.password.reset();
      this.feedback.success('Đã tạo tài khoản và đăng nhập.');
      await this.router.navigateByUrl(postLoginRoute(user, this.returnUrl));
    } catch (err) {
      const problem = this.feedback.problem(err);
      this.error.set(problem.message);
      this.fieldErrors.set(problem.fields);
    } finally {
      this.busy.set(false);
    }
  }
}

import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { SessionService } from '../core/auth/session.service';
import { Icon } from '../shared/icon.component';
import { SkipLink } from '../shared/skip-link';
import { FeedbackService } from '../shared/feedback.service';

@Component({
  selector: 'app-public-layout',
  imports: [SkipLink, RouterLink, RouterLinkActive, RouterOutlet, MatButton, Icon],
  templateUrl: './public-layout.component.html',
  
  styles: `
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .user-menu {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class PublicLayout {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  protected readonly loggingOut = signal(false);

  constructor() {
    effect(() => {
      if (this.session.loading() || this.loggingOut() || this.session.isAuthenticated()) return;
      if (
        /^\/(?:orders(?:\/[1-9]\d*)?|payment(?:\/(?:success|cancel))?|tickets|events\/[1-9]\d*\/book)(?:\?|$)/.test(this.router.url)
      ) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      }
    });
  }

  protected async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.session.logout();
      this.feedback.success('Đã đăng xuất.');
    } catch {
      this.feedback.error(
        'Đã xóa phiên trên thiết bị nhưng chưa xác nhận đăng xuất trên máy chủ. Kiểm tra kết nối trước khi tiếp tục.',
        true,
      );
    } finally {
      await this.router.navigate(['/login']);
      this.loggingOut.set(false);
    }
  }
}

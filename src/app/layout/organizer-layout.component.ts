import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { SessionService } from '../core/auth/session.service';
import { Icon } from '../shared/icon.component';
import { SkipLink } from '../shared/skip-link';
import { FeedbackService } from '../shared/feedback.service';

@Component({
  selector: 'app-organizer-layout',
  imports: [SkipLink, RouterLink, RouterLinkActive, RouterOutlet, MatButton, Icon],
  templateUrl: './organizer-layout.component.html',
  
  styles: `
    .admin-main {
      min-width: 0;
    }
  `,
})
export class OrganizerLayout {
  protected readonly session = inject(SessionService);
  protected readonly signingOut = signal(false);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  constructor() {
    effect(() => {
      if (!this.session.loading() && !this.session.isOrganizer() && !this.signingOut()) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      }
    });
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
      await this.router.navigate(['/login']);
      this.signingOut.set(false);
    }
  }
}

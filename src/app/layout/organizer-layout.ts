import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { SessionService } from '../core/auth/session.service';
import { Icon } from '../shared/icon';
import { SkipLink } from '../shared/skip-link';
import { FeedbackService } from '../shared/feedback.service';

@Component({
  selector: 'app-organizer-layout',
  imports: [SkipLink, RouterLink, RouterLinkActive, RouterOutlet, MatButton, Icon],
  template: `
    <a appSkipLink class="skip-link" href="#organizer-content">Đến nội dung tổ chức</a>
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <a class="brand" routerLink="/"
          ><span class="brand-icon"><app-icon name="calendar" /></span> Kênh tổ chức</a
        >
        <p class="eyebrow">QUẢN LÝ SỰ KIỆN</p>
        <nav aria-label="Điều hướng tổ chức">
          <a
            routerLink="/organizer"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <app-icon name="list" /> Sự kiện của tôi
          </a>
          <a routerLink="/organizer/checkin" routerLinkActive="active" ariaCurrentWhenActive="page">
            <app-icon name="check" /> Check-in vé
          </a>
          <a
            routerLink="/organizer/events/new"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
          >
            <app-icon name="calendar" /> Tạo sự kiện
          </a>
          <a routerLink="/"><app-icon name="left" /> Về trang chủ</a>
        </nav>
        <p class="sidebar-note">Tạo sự kiện, cấu hình hạng vé, phát hành và theo dõi doanh thu.</p>
      </aside>
      <div class="admin-main">
        <header class="admin-header">
          <div>
            <span class="eyebrow">TÀI KHOẢN TỔ CHỨC</span
            ><strong>{{ session.user()?.fullName }}</strong>
          </div>
          <button mat-stroked-button type="button" [disabled]="signingOut()" (click)="logout()">
            <app-icon name="logout" /> {{ signingOut() ? 'Đang đăng xuất…' : 'Đăng xuất' }}
          </button>
        </header>
        <main id="organizer-content" class="admin-content" tabindex="-1">
          @if (session.isOrganizer()) {
            <router-outlet />
          }
        </main>
      </div>
    </div>
  `,
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

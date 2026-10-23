import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { SessionService } from '../core/auth/session.service';
import { Icon } from '../shared/icon';
import { SkipLink } from '../shared/skip-link';
import { FeedbackService } from '../shared/feedback.service';

@Component({
  selector: 'app-admin-layout',
  imports: [SkipLink, RouterLink, RouterLinkActive, RouterOutlet, MatButton, Icon],
  template: `
    <a appSkipLink class="skip-link" href="#admin-content">Đến nội dung quản trị</a>
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <a class="brand" routerLink="/"
          ><span class="brand-icon"><app-icon name="grid" /></span> Quản trị</a
        >
        <p class="eyebrow">KHU VỰC HỆ THỐNG</p>
        <nav aria-label="Điều hướng quản trị">
          <a
            routerLink="/admin"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <app-icon name="home" /> Tổng quan
          </a>
          <a routerLink="/admin/categories" routerLinkActive="active" ariaCurrentWhenActive="page"
            ><app-icon name="grid" /> Danh mục</a
          >
          <a routerLink="/admin/venues" routerLinkActive="active" ariaCurrentWhenActive="page"
            ><app-icon name="compass" /> Địa điểm</a
          >
          <a routerLink="/admin/reports" routerLinkActive="active" ariaCurrentWhenActive="page"
            ><app-icon name="list" /> Báo cáo doanh thu</a
          >
          <a routerLink="/"><app-icon name="left" /> Về trang chủ</a>
        </nav>
        <p class="sidebar-note">Quản lý và thiết lập chức năng nghiệp vụ của ứng dụng.</p>
      </aside>
      <div class="admin-main">
        <header class="admin-header">
          <div>
            <span class="eyebrow">TÀI KHOẢN ADMIN</span
            ><strong>{{ session.user()?.fullName }}</strong>
          </div>
          <button mat-stroked-button type="button" [disabled]="signingOut()" (click)="logout()">
            <app-icon name="logout" /> {{ signingOut() ? 'Đang đăng xuất…' : 'Đăng xuất' }}
          </button>
        </header>
        <main id="admin-content" class="admin-content" tabindex="-1">
          @if (session.isAdmin()) {
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
export class AdminLayout {
  protected readonly session = inject(SessionService);
  protected readonly signingOut = signal(false);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  constructor() {
    effect(() => {
      if (!this.session.loading() && !this.session.isAdmin() && !this.signingOut()) {
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

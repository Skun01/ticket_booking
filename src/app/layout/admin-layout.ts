import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { SessionService } from '../core/auth/session.service';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatButton, Icon],
  template: `
    <a class="skip-link" href="#admin-content">Đến nội dung quản trị</a>
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <a class="brand" routerLink="/"><span class="brand-icon"><app-icon name="grid" /></span> Quản trị</a>
        <p class="eyebrow">KHU VỰC HỆ THỐNG</p>
        <nav aria-label="Điều hướng quản trị">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
            <app-icon name="home" /> Tổng quan
          </a>
          <a routerLink="/"><app-icon name="left" /> Về trang chủ</a>
        </nav>
        <p class="sidebar-note">Quản lý và thiết lập chức năng nghiệp vụ của ứng dụng.</p>
      </aside>
      <div class="admin-main">
        <header class="admin-header">
          <div><span class="eyebrow">TÀI KHOẢN ADMIN</span><strong>{{ session.user()?.fullName }}</strong></div>
          <button mat-stroked-button type="button" [disabled]="signingOut()" (click)="logout()">
            <app-icon name="logout" /> {{ signingOut() ? 'Đang đăng xuất…' : 'Đăng xuất' }}
          </button>
        </header>
        <main id="admin-content" class="admin-content" tabindex="-1">
          @if (session.isAdmin()) { <router-outlet /> }
        </main>
      </div>
    </div>
  `,
})
export class AdminLayout {
  protected readonly session = inject(SessionService);
  protected readonly signingOut = signal(false);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (!this.session.loading() && !this.session.isAdmin() && !this.signingOut()) {
        void this.router.navigate(['/login']);
      }
    });
  }

  protected async logout(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.session.logout();
    } finally {
      this.signingOut.set(false);
      await this.router.navigate(['/login']);
    }
  }
}

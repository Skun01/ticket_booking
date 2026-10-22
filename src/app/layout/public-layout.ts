import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { SessionService } from '../core/auth/session.service';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatButton, Icon],
  template: `
    <a class="skip-link" href="#main-content">Đến nội dung chính</a>
    <header class="site-header">
      <a class="brand" routerLink="/" aria-label="Trang chủ">
        <span class="brand-icon"><app-icon name="grid" /></span> Fullstack App
      </a>
      <nav aria-label="Điều hướng chính">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Trang chủ</a>
        <a routerLink="/events" routerLinkActive="active">Sự kiện</a>
        @if (session.isCustomer()) {
          <a routerLink="/orders" routerLinkActive="active">Đơn của tôi</a>
          <a routerLink="/tickets" routerLinkActive="active">Vé của tôi</a>
        }
        @if (session.isOrganizer()) {
          <a routerLink="/organizer" routerLinkActive="active">Kênh tổ chức</a>
        }
        @if (session.isAdmin()) {
          <a routerLink="/admin" routerLinkActive="active">Khu vực quản trị</a>
        }
      </nav>
      <div class="header-actions">
        @if (session.loading()) {
          <span class="muted">Đang tải…</span>
        } @else if (session.user(); as user) {
          <div class="user-menu">
            <span class="header-action">
              <app-icon name="user" /> {{ user.fullName }}
            </span>
            <button mat-button type="button" (click)="logout()" [disabled]="loggingOut()">
              <app-icon name="logout" /> {{ loggingOut() ? 'Đang thoát…' : 'Đăng xuất' }}
            </button>
          </div>
        } @else {
          <a class="header-action" routerLink="/login">
            <app-icon name="login" /> Đăng nhập
          </a>
        }
      </div>
    </header>
    <main id="main-content" class="page-container" tabindex="-1"><router-outlet /></main>
    <footer class="site-footer">
      <span>Fullstack Starter</span>
      <span>Spring Boot 4.1 · Angular 22</span>
    </footer>
  `,
  styles: `
    .header-actions { display: flex; align-items: center; gap: .75rem; }
    .user-menu { display: flex; align-items: center; gap: .5rem; }
  `,
})
export class PublicLayout {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly loggingOut = signal(false);

  protected async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.session.logout();
    } finally {
      this.loggingOut.set(false);
      await this.router.navigate(['/login']);
    }
  }
}

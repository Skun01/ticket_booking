import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { SessionService } from '../core/auth/session.service';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-organizer-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatButton, Icon],
  template: `
    <a class="skip-link" href="#organizer-content">Đến nội dung tổ chức</a>
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <a class="brand" routerLink="/"><span class="brand-icon"><app-icon name="calendar" /></span> Kênh tổ chức</a>
        <p class="eyebrow">QUẢN LÝ SỰ KIỆN</p>
        <nav aria-label="Điều hướng tổ chức">
          <a routerLink="/organizer" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
            <app-icon name="list" /> Sự kiện của tôi
          </a>
          <a routerLink="/organizer/checkin" routerLinkActive="active">
            <app-icon name="check" /> Check-in vé
          </a>
          <a routerLink="/"><app-icon name="left" /> Về trang chủ</a>
        </nav>
        <p class="sidebar-note">Tạo sự kiện, cấu hình hạng vé, phát hành và theo dõi doanh thu.</p>
      </aside>
      <div class="admin-main">
        <header class="admin-header">
          <div><span class="eyebrow">TÀI KHOẢN TỔ CHỨC</span><strong>{{ session.user()?.fullName }}</strong></div>
          <button mat-stroked-button type="button" [disabled]="signingOut()" (click)="logout()">
            <app-icon name="logout" /> {{ signingOut() ? 'Đang đăng xuất…' : 'Đăng xuất' }}
          </button>
        </header>
        <main id="organizer-content" class="admin-content" tabindex="-1">
          @if (session.isOrganizer()) { <router-outlet /> }
        </main>
      </div>
    </div>
  `,
})
export class OrganizerLayout {
  protected readonly session = inject(SessionService);
  protected readonly signingOut = signal(false);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (!this.session.loading() && !this.session.isOrganizer() && !this.signingOut()) {
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

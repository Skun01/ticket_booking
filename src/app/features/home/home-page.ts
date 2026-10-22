import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { SessionService } from '../../core/auth/session.service';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, MatButtonModule, Icon],
  template: `
    <section class="intro-section">
      <p class="eyebrow">FULLSTACK STARTER TEMPLATE</p>
      <h1>Spring Boot 4.1 & Angular 22<br />Nền tảng sẵn sàng phát triển</h1>
      <p class="lead">
        Template base sạch, giữ nguyên cấu trúc chuẩn, xác thực JWT HS256 với Refresh Token HttpOnly cookie,
        phân quyền ADMIN/USER, xử lý lỗi RFC 9457 và sẵn sàng để xây dựng mọi module nghiệp vụ từ đầu.
      </p>
      <div class="hero-actions">
        @if (session.isAuthenticated()) {
          @if (session.isAdmin()) {
            <a mat-flat-button routerLink="/admin">
              <app-icon name="home" /> Khu vực quản trị
            </a>
          }
        } @else {
          <a mat-flat-button routerLink="/login">
            <app-icon name="login" /> Đăng nhập
          </a>
          <a mat-stroked-button routerLink="/register">
            <app-icon name="user" /> Đăng ký
          </a>
        }
      </div>
    </section>

    <section aria-labelledby="features-title">
      <div class="section-heading">
        <h2 id="features-title">Hạ tầng cốt lõi đã tích hợp</h2>
        <span class="muted">Kiến trúc sạch theo layer</span>
      </div>
      <div class="feature-grid">
        <div class="feature-card">
          <app-icon name="lock" />
          <h3>Xác thực & Bảo mật</h3>
          <p>JWT HS256, Refresh Token rotation với HttpOnly cookie, mã hóa SHA-256 DB và BCrypt mật khẩu.</p>
          <span>Bảo mật chuẩn Spring Security</span>
        </div>
        <div class="feature-card">
          <app-icon name="grid" />
          <h3>Kiến trúc Layered</h3>
          <p>Tổ chức phân tầng số ít: controller, service/impl, domain, repository, dto, exception, config.</p>
          <span>Quy ước chuẩn AGENTS.md</span>
        </div>
        <div class="feature-card">
          <app-icon name="check" />
          <h3>Database & Migration</h3>
          <p>MySQL 8 kết hợp Liquibase versioning, ddl-auto: validate, mapping entity kế thừa BaseEntity.</p>
          <span>Quản lý schema an toàn</span>
        </div>
      </div>
    </section>
  `,
})
export class HomePage {
  protected readonly session = inject(SessionService);
}

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { Subscription, finalize, forkJoin, timeout } from 'rxjs';
import { AdminApi } from '../../core/api/catalog.api';
import { apiError } from '../../core/api/api-error';
import { RevenueReport } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { recentRevenueRange } from '../../shared/vietnam-time';

interface AdminSummary {
  categories: number;
  venues: number;
  report: RevenueReport;
}

@Component({
  selector: 'app-admin-home',
  imports: [RouterLink, MatButton, DateTimePipe, MoneyPipe, PageHeader],
  template: `
    <app-page-header
      title="Tổng quan quản trị"
      subtitle="Quản lý danh mục, địa điểm và doanh thu toàn hệ thống."
    >
      <button mat-stroked-button type="button" (click)="load()" [disabled]="loading()">
        Cập nhật tổng quan
      </button>
    </app-page-header>
    <nav class="quick-links" aria-label="Các mục quản trị">
      <a routerLink="/admin/categories"
        ><strong>Danh mục</strong><span>Thêm, sửa danh mục phân loại sự kiện.</span></a
      >
      <a routerLink="/admin/venues"
        ><strong>Địa điểm</strong><span>Thông tin địa chỉ, thành phố và sức chứa.</span></a
      >
      <a routerLink="/admin/reports"
        ><strong>Báo cáo doanh thu</strong><span>Chọn khoảng thời gian và xem top sự kiện.</span></a
      >
    </nav>
    @if (loading()) {
      <p role="status">Đang tải số liệu tổng quan…</p>
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      <p class="muted">
        Chưa có số liệu mới để hiển thị; bạn vẫn có thể mở các mục quản trị bên trên.
      </p>
    } @else if (summary(); as summary) {
      <section class="panel" aria-labelledby="catalog-counts-title">
        <h2 id="catalog-counts-title">Dữ liệu hệ thống</h2>
        <dl class="metrics">
          <div>
            <dt>Danh mục</dt>
            <dd>{{ summary.categories }}</dd>
          </div>
          <div>
            <dt>Địa điểm</dt>
            <dd>{{ summary.venues }}</dd>
          </div>
        </dl>
      </section>
      <section class="panel" aria-labelledby="revenue-summary-title">
        <h2 id="revenue-summary-title">Doanh thu 30 ngày gần nhất</h2>
        <p class="muted">
          Từ {{ summary.report.from | dateTime }} đến trước {{ summary.report.to | dateTime }} (giờ
          Việt Nam). Chỉ tính các đơn đã thanh toán.
        </p>
        <dl class="metrics">
          <div>
            <dt>Đơn đã thanh toán</dt>
            <dd>{{ summary.report.paidOrders }}</dd>
          </div>
          <div>
            <dt>Doanh thu</dt>
            <dd>{{ summary.report.revenue | money }}</dd>
          </div>
        </dl>
        <a mat-stroked-button routerLink="/admin/reports">Xem báo cáo chi tiết</a>
      </section>
    }
  `,
  styles: `
    .quick-links {
      display: grid;
      gap: 0;
      border-top: 1px solid var(--app-line);
      margin-bottom: 24px;
    }
    .quick-links a {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
      gap: 16px;
      padding: 20px 0;
      border-bottom: 1px solid var(--app-line);
      text-decoration: none;
    }
    .quick-links a:hover strong {
      text-decoration: underline;
    }
    .quick-links span,
    dt {
      color: var(--app-muted);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }
    dd {
      font-size: 1.6rem;
      font-weight: 700;
      margin: 0;
      overflow-wrap: anywhere;
    }
    @media (max-width: 768px) {
      .quick-links a,
      .metrics {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }
  `,
})
export class AdminHome {
  private readonly api = inject(AdminApi);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly summary = signal<AdminSummary | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.summary.set(null);
    const range = recentRevenueRange();
    this.request = forkJoin({
      categories: this.api.listCategories({ size: 1 }),
      venues: this.api.listVenues({ size: 1 }),
      report: this.api.revenueReport(range.from, range.to),
    })
      .pipe(
        timeout(30000),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) =>
          this.summary.set({
            categories: result.categories.totalElements,
            venues: result.venues.totalElements,
            report: result.report,
          }),
        error: (error) =>
          this.error.set(
            apiError(error, 'Không tải được số liệu tổng quan. Vui lòng cập nhật lại.').message,
          ),
      });
  }
}

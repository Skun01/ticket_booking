import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { Subscription } from 'rxjs';
import { OrderApi } from '../../core/api/catalog.api';
import { apiError } from '../../core/api/api-error';
import { OrderStatus, OrderSummary } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { EmptyState } from '../../shared/empty-state';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Paginator } from '../../shared/paginator';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'app-orders-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    DateTimePipe,
    EmptyState,
    MoneyPipe,
    PageHeader,
    Paginator,
    StatusBadge,
  ],
  template: `
    <app-page-header
      title="Đơn của tôi"
      subtitle="Theo dõi giữ chỗ, thanh toán và các đơn vé đã đặt."
    >
      <a mat-stroked-button routerLink="/events">Khám phá sự kiện</a>
    </app-page-header>
    <mat-form-field appearance="outline">
      <mat-label>Lọc trạng thái trên trang này</mat-label>
      <mat-select [formControl]="status" (selectionChange)="filter.set(status.value)">
        <mat-option value="">Tất cả</mat-option>
        <mat-option value="PENDING">Chờ thanh toán</mat-option>
        <mat-option value="PAID">Đã thanh toán</mat-option>
        <mat-option value="CANCELLED">Đã hủy</mat-option>
        <mat-option value="EXPIRED">Hết hạn</mat-option>
      </mat-select>
    </mat-form-field>
    <p class="muted">Bộ lọc áp dụng cho các đơn trên trang hiện tại, không phải toàn bộ lịch sử.</p>
    @if (loading()) {
      <p role="status">Đang tải đơn vé…</p>
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      <button mat-stroked-button (click)="load(page())" type="button">Thử lại</button>
    } @else {
      <p class="muted">Tổng cộng {{ total() }} đơn</p>
      @if (visible().length === 0) {
        <app-empty-state
          icon="list"
          title="Không có đơn vé phù hợp"
          description="Nếu bạn đã đặt vé, thử bỏ bộ lọc hoặc xem trang khác."
        />
      } @else {
        <div class="order-list">
          @for (order of visible(); track order.id) {
            <article class="order-row">
              <div>
                <h2>
                  <a [routerLink]="['/orders', order.id]">{{ order.orderCode }}</a>
                </h2>
                <p class="muted">Đặt lúc {{ order.createdAt | dateTime }}</p>
                @if (order.status === 'PENDING' && order.expiresAt) {
                  <p class="muted">Giữ chỗ đến {{ order.expiresAt | dateTime }}</p>
                }
              </div>
              <div class="order-summary">
                <app-status-badge [status]="order.status" />
                <strong>{{ order.totalAmount | money }}</strong>
                <a mat-stroked-button [routerLink]="['/orders', order.id]">Xem đơn</a>
              </div>
            </article>
          }
        </div>
      }
      <app-paginator [page]="page()" [totalPages]="totalPages()" (pageChange)="load($event)" />
    }
  `,
  styles: `
    :host {
      display: block;
      padding-top: 32px;
    }
    .order-list {
      border-top: 1px solid var(--app-line);
    }
    .order-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      padding: 24px 0;
      border-bottom: 1px solid var(--app-line);
    }
    .order-row h2 {
      font-size: 1rem;
      overflow-wrap: anywhere;
    }
    .order-row p {
      margin-bottom: 0.35rem;
    }
    .order-summary {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    @media (max-width: 768px) {
      .order-row {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
  `,
})
export class OrdersPage {
  private readonly api = inject(OrderApi);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly orders = signal<OrderSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly page = signal(0);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly status = new FormControl<OrderStatus | ''>('', { nonNullable: true });
  protected readonly filter = signal<OrderStatus | ''>('');
  protected readonly visible = computed(() =>
    this.orders().filter((order) => !this.filter() || order.status === this.filter()),
  );

  constructor() {
    this.load(0);
  }

  protected load(page: number): void {
    this.request?.unsubscribe();
    this.page.set(page);
    this.loading.set(true);
    this.error.set('');
    this.request = this.api
      .listOwn({ page, size: 12 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.orders.set(result.content);
          this.page.set(result.page);
          this.total.set(result.totalElements);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error, 'Không thể tải đơn vé của bạn.').message);
          this.loading.set(false);
        },
      });
  }
}

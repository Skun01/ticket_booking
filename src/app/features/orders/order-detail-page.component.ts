import { FocusOnShow } from '../../shared/focus-on-show';
import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { Subscription, distinctUntilChanged, finalize, interval, map } from 'rxjs';
import { OrderApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { Order } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header.component';
import { StatusBadge } from '../../shared/status-badge.component';

@Component({
  selector: 'app-order-detail-page',
  imports: [
    FocusOnShow,
    LoadingState,
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    MatCheckbox,
    DateTimePipe,
    MoneyPipe,
    PageHeader,
    StatusBadge,
  ],
  templateUrl: './order-detail-page.component.html',
  
  styles: `
    :host {
      display: block;
      padding-top: 32px;
    }
    .panel {
      overflow-wrap: anywhere;
    }
    .order-heading {
      display: flex;
      gap: 16px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .order-heading h2 {
      font-size: 1.1rem;
    }
    .countdown {
      padding: 12px 16px;
      border: 1px solid var(--app-warning-line);
      border-radius: 0.4rem;
      background: var(--app-warning-soft);
      color: var(--app-warning);
      font-size: 1.1rem;
      font-variant-numeric: tabular-nums;
    }
    .payment-success {
      border-top: 4px solid var(--app-success);
      background: linear-gradient(var(--app-success-soft), var(--app-panel) 180px);
    }
    .payment-success h2 {
      color: var(--app-success);
    }
    .items {
      border-top: 1px solid var(--app-line);
    }
    .item-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 24px;
      padding: 20px 0;
      border-bottom: 1px solid var(--app-line);
    }
    .totals {
      max-width: 440px;
      margin: 24px 0 0 auto;
    }
    .totals > div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 0;
    }
    .totals dd {
      margin: 0;
    }
    .grand-total {
      font-weight: 700;
      font-size: 1.2rem;
    }
    @media (max-width: 768px) {
      .item-row {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }
  `,
})
export class OrderDetailPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(OrderApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionService);
  private readRequest?: Subscription;
  private actionRequest?: Subscription;
  private deadlineChecked = '';
  protected readonly id = signal<number | null>(null);
  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly busy = signal(false);
  protected readonly actionName = signal<'pay' | 'cancel' | null>(null);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly authRequired = signal(false);
  protected readonly needsRefresh = signal(false);
  protected readonly confirmCancel = signal(false);
  protected readonly simulateFailure = new FormControl(false, { nonNullable: true });
  private readonly now = signal(Date.now());
  private readonly serverExpired = signal(false);
  protected readonly remaining = computed(() => {
    const expires = this.order()?.expiresAt;
    return expires ? Math.max(0, Math.ceil((Date.parse(expires) - this.now()) / 1000)) : 0;
  });
  protected readonly expired = computed(() => this.serverExpired() || this.remaining() <= 0);
  protected readonly countdown = computed(() => {
    const seconds = this.remaining();
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  });
  protected readonly canPay = computed(
    () =>
      this.session.isCustomer() &&
      this.order()?.status === 'PENDING' &&
      !this.expired() &&
      !this.busy() &&
      !this.refreshing() &&
      !this.needsRefresh() &&
      !this.authRequired(),
  );

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.actionRequest?.unsubscribe();
        this.readRequest?.unsubscribe();
        this.order.set(null);
        this.error.set('');
        this.notice.set('');
        this.serverExpired.set(false);
        this.authRequired.set(false);
        this.confirmCancel.set(false);
        this.needsRefresh.set(false);
        this.deadlineChecked = '';
        this.simulateFailure.setValue(false);
        if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
          this.id.set(null);
          this.loading.set(false);
          this.error.set('Đường dẫn đơn vé không hợp lệ.');
          return;
        }
        this.id.set(Number(id));
        this.load();
      });
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.now.set(Date.now());
        const order = this.order();
        if (
          !order ||
          order.status !== 'PENDING' ||
          !this.expired() ||
          this.busy() ||
          this.refreshing()
        )
          return;
        const key = `${order.id}:${order.expiresAt}`;
        if (this.deadlineChecked === key) return;
        this.deadlineChecked = key;
        this.load(true);
      });
  }

  protected load(preserveError = false): void {
    const id = this.id();
    if (!id || this.busy()) return;
    this.readRequest?.unsubscribe();
    if (!preserveError) this.error.set('');
    this.loading.set(!this.order());
    this.refreshing.set(true);
    this.readRequest = this.api
      .getOwn(id)
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.refreshing.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.now.set(Date.now());
          this.needsRefresh.set(false);
          this.authRequired.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            this.feedback.problem(
              error,
              'Không thể xác nhận trạng thái đơn. Vui lòng cập nhật lại.',
            ).message,
          );
          this.needsRefresh.set(true);
          this.authRequired.set(error instanceof HttpErrorResponse && error.status === 401);
        },
      });
  }

  protected pay(): void {
    this.act('pay');
  }
  protected cancel(): void {
    if (this.confirmCancel()) this.act('cancel');
  }

  private act(action: 'pay' | 'cancel'): void {
    const order = this.order();
    if (!order || !this.canPay()) return;
    this.busy.set(true);
    this.actionName.set(action);
    this.error.set('');
    this.notice.set('');
    this.confirmCancel.set(false);
    // Chỉ gửi một POST. Nếu lỗi, đọc lại trạng thái bằng GET, không tự replay thao tác ghi.
    const request =
      action === 'pay'
        ? this.api.pay(order.id, { method: 'MOCK', simulateFailure: this.simulateFailure.value })
        : this.api.cancel(order.id);
    this.actionRequest = request
      .pipe(
        finalize(() => {
          this.busy.set(false);
          this.actionName.set(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.order.set(result);
          this.now.set(Date.now());
          this.notice.set(
            result.status === 'PAID'
              ? 'Thanh toán thành công.'
              : result.status === 'CANCELLED'
                ? 'Đã hủy đơn và trả lại vé giữ chỗ.'
                : 'Đơn đã hết hạn giữ chỗ.',
          );
          if (result.status === 'PAID' || result.status === 'CANCELLED')
            this.feedback.success(this.notice());
          else this.feedback.info(this.notice());
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.error.set(
            this.feedback.problem(
              error,
              'Chưa xác nhận được kết quả thao tác. Vui lòng cập nhật đơn trước khi thử lại.',
            ).message,
          );
          this.needsRefresh.set(true);
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.authRequired.set(true);
            return;
          }
          if (error instanceof HttpErrorResponse && error.error?.code === 'ORDER_EXPIRED')
            this.serverExpired.set(true);
          // Với lỗi mạng/5xx, để người dùng chủ động đối soát, tránh tự khuyến khích thanh toán lại.
          if (error instanceof HttpErrorResponse && error.status > 0 && error.status < 500)
            this.load(true);
        },
      });
  }
}

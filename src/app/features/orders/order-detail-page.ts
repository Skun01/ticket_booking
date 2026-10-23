import { FocusOnShow } from '../../shared/focus-on-show';
import { LoadingState } from '../../shared/loading-state';
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
import { PageHeader } from '../../shared/page-header';
import { StatusBadge } from '../../shared/status-badge';

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
  template: `
    <app-page-header
      title="Chi tiết đơn vé"
      subtitle="Kiểm tra đơn và hoàn tất thanh toán trong thời gian giữ chỗ."
    >
      <a mat-stroked-button routerLink="/orders">Đơn của tôi</a>
    </app-page-header>
    @if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      @if (authRequired()) {
        <a mat-stroked-button routerLink="/login" [queryParams]="{ returnUrl: '/orders/' + id() }"
          >Đăng nhập lại</a
        >
      }
    }
    @if (notice()) {
      <p class="form-notice success" role="status">{{ notice() }}</p>
    }
    @if (loading()) {
      <app-loading-state label="Đang tải đơn vé…" />
    } @else if (order(); as order) {
      <section class="panel">
        <div class="order-heading">
          <h2>{{ order.orderCode }}</h2>
          <app-status-badge [status]="order.status" />
        </div>
        <p class="muted">Đặt lúc {{ order.createdAt | dateTime }}</p>
        @if (order.status === 'PENDING') {
          @if (expired()) {
            <p class="form-notice warning" role="status">
              Đã hết thời gian giữ chỗ. Không thể tiếp tục thanh toán. Trạng thái được xác nhận từ
              máy chủ khi cập nhật đơn.
            </p>
          } @else {
            <p class="countdown">
              Thời gian giữ chỗ còn lại: <strong>{{ countdown() }}</strong>
            </p>
          }
          <p class="muted">Hạn thanh toán: {{ order.expiresAt | dateTime }} (giờ Việt Nam)</p>
        }
        <div class="items">
          @for (item of order.items; track item.id) {
            <div class="item-row">
              <div>
                <strong>{{ item.ticketTypeName }}</strong
                ><br />
                <a [routerLink]="['/events', item.eventId]">Xem sự kiện</a>
              </div>
              <span>{{ item.quantity }} × {{ item.unitPrice | money }}</span>
              <strong>{{ item.quantity * item.unitPrice | money }}</strong>
            </div>
          }
        </div>
        <dl class="totals">
          <div>
            <dt>Giảm giá</dt>
            <dd>{{ order.discountAmount | money }}</dd>
          </div>
          <div class="grand-total">
            <dt>Tổng thanh toán</dt>
            <dd>{{ order.totalAmount | money }}</dd>
          </div>
        </dl>
      </section>
      @if (order.status === 'PENDING') {
        <section class="panel" aria-labelledby="payment-title">
          <h2 id="payment-title">Thanh toán giả lập</h2>
          <p class="muted">
            Phương thức MOCK chỉ mô phỏng giao dịch, không trừ tiền thật và không yêu cầu thông tin
            thẻ.
          </p>
          <mat-checkbox [formControl]="simulateFailure" [disabled]="busy() || refreshing()"
            >Mô phỏng thanh toán thất bại</mat-checkbox
          >
          @if (needsRefresh()) {
            <p class="form-notice warning" role="status">
              Chưa xác nhận được trạng thái mới nhất. Hãy cập nhật đơn trước khi thao tác lại; không
              gửi thanh toán liên tục.
            </p>
          }
          <div class="form-actions">
            <button
              mat-flat-button
              type="button"
              data-action="pay"
              (click)="pay()"
              [disabled]="!canPay()"
              [attr.aria-busy]="busy()"
            >
              {{ actionName() === 'pay' ? 'Đang thanh toán…' : 'Thanh toán' }}
            </button>
            <button
              mat-stroked-button
              type="button"
              (click)="confirmCancel.set(true)"
              [disabled]="!canPay()"
            >
              Hủy đơn
            </button>
          </div>
          @if (confirmCancel()) {
            <div class="form-notice" role="group" appFocusOnShow aria-label="Xác nhận hủy đơn">
              <p>Hủy đơn này và trả lại số vé đang giữ chỗ?</p>
              <div class="form-actions">
                <button
                  mat-flat-button
                  type="button"
                  data-action="cancel"
                  (click)="cancel()"
                  [disabled]="!canPay()"
                >
                  Xác nhận hủy
                </button>
                <button
                  mat-stroked-button
                  type="button"
                  (click)="confirmCancel.set(false)"
                  [disabled]="busy()"
                >
                  Giữ đơn
                </button>
              </div>
            </div>
          }
        </section>
      } @else if (order.status === 'PAID') {
        <section class="panel">
          <h2>Thanh toán thành công</h2>
          <p>Vé điện tử của đơn đã được phát hành. Bạn có thể tải từng vé PDF có mã QR.</p>
          <a mat-flat-button routerLink="/tickets">Vé của tôi</a>
        </section>
      } @else {
        <section class="panel">
          <p>
            Đơn đã {{ order.status === 'EXPIRED' ? 'hết hạn' : 'bị hủy' }}. Không thể thanh toán lại
            đơn này.
          </p>
          <a mat-stroked-button routerLink="/events">Chọn sự kiện khác</a>
        </section>
      }
      <div class="form-actions">
        <button
          mat-stroked-button
          type="button"
          (click)="load()"
          [disabled]="busy() || refreshing()"
        >
          {{ refreshing() ? 'Đang cập nhật…' : 'Cập nhật đơn' }}
        </button>
      </div>
    } @else if (id()) {
      <button mat-stroked-button type="button" (click)="load()">Thử lại</button>
    }
  `,
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
      font-size: 1.1rem;
      font-variant-numeric: tabular-nums;
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

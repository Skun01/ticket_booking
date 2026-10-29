import { FocusOnShow } from '../../shared/focus-on-show';
import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { PaymentNavigation } from '../../core/api/payment-navigation.service';
import {
  Subscription,
  combineLatest,
  distinctUntilChanged,
  finalize,
  interval,
  map,
  of,
  switchMap,
} from 'rxjs';
import { OrderApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { Order, PayOSCheckout } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { OrderSummaryCard } from './order-summary.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon.component';

@Component({
  selector: 'app-order-detail-page',
  host: { '(window:pageshow)': 'resumeAfterBack()' },
  imports: [FocusOnShow, LoadingState, RouterLink, MatButton, MoneyPipe, Icon, OrderSummaryCard],
  templateUrl: './order-detail-page.component.html',

  styleUrl: './order-detail-page.component.scss',
})
export class OrderDetailPage {
  private readonly paymentNavigation = inject(PaymentNavigation);
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
  protected readonly checkout = signal<PayOSCheckout | null>(null);
  protected readonly redirecting = signal(false);
  protected readonly paymentPage = signal(false);
  protected readonly noOrderSelected = signal(false);
  protected readonly paymentReturn = signal(false);
  protected readonly paymentCancelled = signal(false);
  protected readonly checkingPayment = signal(false);
  protected readonly loginReturnUrl = computed(() =>
    this.paymentReturn()
      ? `/payment/${this.paymentCancelled() ? 'cancel' : 'success'}?orderCode=${this.id()}`
      : this.paymentPage()
        ? `/payment?orderCode=${this.id()}`
        : `/orders/${this.id()}`,
  );
  private syncAttempts = 0;
  private nextSyncAt = 0;
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
      !this.redirecting() &&
      !this.checkingPayment() &&
      !this.needsRefresh() &&
      !this.authRequired(),
  );

  protected readonly ticketCount = computed(
    () => this.order()?.items.reduce((total, item) => total + item.quantity, 0) ?? 0,
  );
  protected readonly canRefresh = computed(
    () => !this.busy() && !this.refreshing() && !this.redirecting() && !this.checkingPayment(),
  );
  protected readonly payLabel = computed(() =>
    this.redirecting()
      ? 'Đang chuyển đến PayOS…'
      : this.actionName() === 'pay'
        ? 'Đang tạo liên kết…'
        : this.checkout()
          ? 'Mở lại trang PayOS'
          : this.paymentCancelled()
            ? 'Tiếp tục thanh toán'
            : 'Thanh toán qua PayOS',
  );

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap, this.route.data])
      .pipe(
        map(([params, query, data]) => ({
          id:
            data['paymentReturn'] || data['paymentPage']
              ? query.get('orderCode')
              : params.get('id'),
          paymentPage: !!data['paymentPage'],
          paymentReturn: !!data['paymentReturn'],
          paymentCancelled: !!data['paymentCancelled'],
        })),
        distinctUntilChanged(
          (a, b) =>
            a.id === b.id &&
            a.paymentPage === b.paymentPage &&
            a.paymentReturn === b.paymentReturn &&
            a.paymentCancelled === b.paymentCancelled,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ id, paymentPage, paymentReturn, paymentCancelled }) => {
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
        this.checkout.set(null);
        this.redirecting.set(false);
        this.paymentPage.set(paymentPage);
        this.noOrderSelected.set(false);
        this.paymentReturn.set(paymentReturn);
        this.paymentCancelled.set(paymentCancelled);
        this.checkingPayment.set(false);
        this.syncAttempts = 0;
        this.nextSyncAt = 0;
        if (id === null && paymentPage) {
          this.id.set(null);
          this.loading.set(false);
          this.noOrderSelected.set(true);
          return;
        }
        if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
          this.id.set(null);
          this.loading.set(false);
          this.error.set('Đường dẫn đơn vé không hợp lệ.');
          return;
        }
        this.id.set(Number(id));
        this.checkingPayment.set(paymentReturn);
        this.load(false, paymentReturn);
      });
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.now.set(Date.now());
        const order = this.order();
        if (
          this.checkingPayment() &&
          order?.status === 'PENDING' &&
          !this.busy() &&
          !this.refreshing() &&
          this.now() >= this.nextSyncAt
        ) {
          this.load(true, true);
          return;
        }
        if (
          !order ||
          order.status !== 'PENDING' ||
          !this.expired() ||
          this.busy() ||
          this.refreshing() ||
          this.redirecting() ||
          this.authRequired() ||
          this.needsRefresh()
        )
          return;
        const key = `${order.id}:${order.expiresAt}`;
        if (this.deadlineChecked === key) return;
        this.deadlineChecked = key;
        this.load(true);
      });
  }

  protected load(
    preserveError = false,
    reconcile = this.paymentReturn() || this.order()?.status === 'PENDING',
  ): void {
    const id = this.id();
    if (!id || this.busy()) return;
    this.readRequest?.unsubscribe();
    if (!preserveError) this.error.set('');
    this.loading.set(!this.order());
    this.refreshing.set(true);
    const request = reconcile ? this.api.syncPayOS(id) : this.api.getOwn(id);
    this.readRequest = request
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
          if (reconcile) {
            this.syncAttempts++;
            this.nextSyncAt = Date.now() + 3000;
            this.checkingPayment.set(
              this.paymentReturn() &&
                !this.paymentCancelled() &&
                order.status === 'PENDING' &&
                !this.expired() &&
                this.syncAttempts < 10,
            );
          }
          if (order.status !== 'PENDING') this.checkingPayment.set(false);
        },
        error: (error: unknown) => {
          this.checkingPayment.set(false);
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
    const order = this.order();
    if (!order || !this.canPay()) return;
    const checkout = this.checkout();
    if (checkout) {
      this.openCheckout(checkout);
      return;
    }
    this.busy.set(true);
    this.actionName.set('pay');
    this.error.set('');
    this.notice.set('');
    this.confirmCancel.set(false);
    // Không retry POST: backend có thể hủy liên kết cũ khi tạo lại checkout.
    this.actionRequest = this.api
      .createPayOSCheckout(order.id)
      .pipe(
        finalize(() => {
          this.busy.set(false);
          this.actionName.set(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (checkout) => {
          if (checkout.orderId !== order.id || checkout.orderCode !== order.id) {
            this.actionError(new Error('Checkout order mismatch'));
            return;
          }
          if (['PAID', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(checkout.status)) {
            this.busy.set(false);
            this.notice.set(
              'Liên kết PayOS không còn chờ thanh toán. Đang cập nhật trạng thái đơn.',
            );
            this.load();
            return;
          }
          this.checkout.set(checkout);
          this.openCheckout(checkout);
        },
        error: (error: unknown) => this.actionError(error),
      });
  }

  private openCheckout(checkout: PayOSCheckout): void {
    try {
      this.error.set('');
      this.redirecting.set(true);
      this.paymentNavigation.openCheckout(checkout.checkoutUrl);
    } catch {
      this.redirecting.set(false);
      this.error.set('Không thể mở trang PayOS. Vui lòng thử mở lại liên kết thanh toán.');
    }
  }

  protected resumeAfterBack(): void {
    if (!this.redirecting()) return;
    this.redirecting.set(false);
    this.load();
  }
  protected cancel(): void {
    const order = this.order();
    if (!order || !this.canPay() || !this.confirmCancel()) return;
    this.busy.set(true);
    this.actionName.set('cancel');
    this.error.set('');
    this.notice.set('');
    this.confirmCancel.set(false);
    // Đối soát trước khi hủy, tránh hủy đơn đã thanh toán nhưng webhook chưa về.
    this.actionRequest = this.api
      .syncPayOS(order.id)
      .pipe(
        switchMap((current) =>
          current.status === 'PENDING' ? this.api.cancel(order.id) : of(current),
        ),
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
        error: (error: unknown) => this.actionError(error),
      });
  }

  private actionError(error: unknown): void {
    this.busy.set(false);
    this.checkingPayment.set(false);
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
    // Không tự tạo lại checkout sau lỗi mạng/5xx hoặc timeout.
    if (error instanceof HttpErrorResponse && error.status > 0 && error.status < 500)
      this.load(true);
  }
}

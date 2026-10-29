import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { EMPTY, catchError, combineLatest, finalize, interval, switchMap } from 'rxjs';
import { CatalogApi, OrderApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { EventDetail, TicketType } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { Icon } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header.component';
  import { ticketUnavailableReason } from './ticket-availability';
  import { EventSalesStatus } from './event-sales-status.component';

@Component({
  selector: 'app-booking-page',
  imports: [
    LoadingState,
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    DateTimePipe,
    Icon,
    MoneyPipe,
    PageHeader,
    EventSalesStatus,
  ],
  templateUrl: './booking-page.component.html',
  
  styles: `
    :host {
      display: block;
      padding-top: 32px;
    }
    .booking-dates {
      display: grid;
      gap: 8px;
      margin: 16px 0 0;
      font-size: 0.9rem;
    }
    .booking-dates > div {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .booking-dates dt {
      min-width: 64px;
      color: var(--app-muted);
    }
    .booking-dates dd {
      margin: 0;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .schedule-note {
      color: var(--app-muted);
      font-size: 0.8rem;
    }
    .booking-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }
    .panel {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    /* ---- Ticket option cards (Ticketbox-style) ---- */
    .ticket-options {
      border: none;
      margin: 1.25rem 0 0;
      padding: 0;
      min-width: 0;
    }
    .ticket-options legend {
      padding: 0;
      font-size: 0.78rem;
      font-weight: 750;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--app-muted);
      margin-bottom: 0.75rem;
    }
    .ticket-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ticket-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      width: 100%;
      text-align: left;
      padding: 16px 18px;
      border: 1px solid var(--app-line);
      border-radius: 0.4rem;
      background: var(--app-panel);
      color: var(--app-ink);
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.12s ease;
    }
    .ticket-option:hover:not(:disabled) {
      border-color: var(--app-accent);
    }
    .ticket-option:active:not(:disabled) {
      transform: translateY(1px);
    }
    .ticket-option.selected {
      border-color: var(--app-accent);
      box-shadow: inset 0 0 0 1px var(--app-accent);
      background: var(--app-accent-soft);
    }
    .ticket-option:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .to-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
    }
    .to-name {
      font-size: 1.02rem;
    }
    .to-reason {
      font-size: 0.82rem;
      font-weight: 600;
    }
    .to-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .to-price {
      font-weight: 700;
      white-space: nowrap;
    }
    .to-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      color: var(--app-inverse);
      background: transparent;
    }
    .ticket-option.selected .to-mark {
      background: var(--app-accent);
    }

    /* ---- Quantity stepper ---- */
    .qty-block {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin: 1.5rem 0 0.5rem;
    }
    .qty-head {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .qty-label {
      font-weight: 650;
    }
    .qty-hint {
      font-size: 0.82rem;
    }
    .stepper {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--app-ink);
      border-radius: 0.4rem;
      overflow: hidden;
    }
    .step-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.9rem;
      height: 2.9rem;
      border: none;
      background: var(--app-panel);
      color: var(--app-ink);
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .step-btn:hover:not(:disabled) {
      background: var(--app-ink);
      color: var(--app-inverse);
    }
    .step-btn:active:not(:disabled) {
      background: #303030;
      color: var(--app-inverse);
    }
    .step-btn:disabled {
      color: var(--app-muted);
      opacity: 0.5;
      cursor: not-allowed;
    }
    .step-value {
      min-width: 3rem;
      text-align: center;
      font-size: 1.1rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      border-left: 1px solid var(--app-line);
      border-right: 1px solid var(--app-line);
      padding: 0 0.5rem;
      align-self: stretch;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .submit-btn {
      margin-top: 1rem;
    }

    /* ---- Summary ---- */
    .summary {
      border-top: 4px solid var(--app-accent);
      background: linear-gradient(var(--app-accent-soft), var(--app-panel) 160px);
    }
    .summary-line {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin: 0.4rem 0;
    }
    .total {
      color: var(--app-accent-strong);
      font-size: 1.2rem;
      font-weight: 700;
      border-top: 1px solid var(--app-line);
      padding-top: 16px;
      margin-top: 0.75rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .ticket-option {
        transition: none;
      }
      .ticket-option:active:not(:disabled) {
        transform: none;
      }
    }
    @media (max-width: 768px) {
      .booking-grid {
        grid-template-columns: 1fr;
        gap: 0;
      }
    }
  `,
})
export class BookingPage {
  private readonly feedback = inject(FeedbackService);
  private readonly catalog = inject(CatalogApi);
  private readonly orders = inject(OrderApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionService);
  protected readonly event = signal<EventDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly uncertain = signal(false);
  protected readonly now = signal(Date.now());

  protected readonly form = new FormGroup({
    ticketTypeId: new FormControl<number | null>(null),
    quantity: new FormControl<number>(1, { nonNullable: true }),
  });
  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly quantity = computed(() => this.values().quantity ?? 0);
  protected readonly selected = computed(() =>
    this.event()?.ticketTypes.find((tt) => tt.id === this.values().ticketTypeId),
  );
  protected readonly limit = computed(() => {
    const tt = this.selected();
    return tt ? Math.max(0, Math.min(100, tt.maxPerOrder, tt.availableQuantity)) : 0;
  });
  protected readonly validationError = computed(() => {
    const tt = this.selected();
    if (!tt) return 'Vui lòng chọn hạng vé còn mở bán.';
    const reason = this.unavailableReason(tt);
    if (reason) return reason;
    if (
      !Number.isInteger(this.quantity()) ||
      this.quantity() < 1 ||
      this.quantity() > this.limit()
    ) {
      return `Số lượng phải là số nguyên từ 1 đến ${this.limit()}.`;
    }
    return '';
  });
  protected readonly estimate = computed(() =>
    this.validationError() ? 0 : (this.selected()?.price ?? 0) * this.quantity(),
  );

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([params, query]) => {
          this.loading.set(true);
          this.loadError.set('');
          this.error.set('');
          this.event.set(null);
          this.uncertain.set(false);
          const id = params.get('id');
          if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
            this.loading.set(false);
            this.loadError.set('Đường dẫn sự kiện không hợp lệ.');
            return EMPTY;
          }
          return this.catalog.getEvent(Number(id)).pipe(
            switchMap((ev) => {
              this.event.set(ev);
              const requested = Number(query.get('ticketTypeId'));
              const now = Date.now();
              const requestedType = ev.ticketTypes.find((t) => t.id === requested);
              const tt =
                (requestedType && !ticketUnavailableReason(ev, requestedType, now)
                  ? requestedType
                  : undefined) ??
                ev.ticketTypes.find((t) => !ticketUnavailableReason(ev, t, now));
              this.form.reset({ ticketTypeId: tt?.id ?? null, quantity: 1 });
              this.loading.set(false);
              return EMPTY;
            }),
            catchError((error) => {
              this.loadError.set(
                this.feedback.problem(
                  error,
                  'Không thể tải sự kiện để đặt vé. Vui lòng quay lại danh sách.',
                ).message,
              );
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected unavailableReason(tt: TicketType, now = this.now()): string {
    const ev = this.event();
    return ev ? ticketUnavailableReason(ev, tt, now) : 'Không tải được lịch bán vé.';
  }

  /** Chọn hạng vé; reset số lượng về 1 trong giới hạn hợp lệ của hạng vừa chọn. */
  protected select(tt: TicketType): void {
    if (this.busy() || this.uncertain() || this.unavailableReason(tt, Date.now())) return;
    this.form.controls.ticketTypeId.setValue(tt.id);
    const max = Math.max(0, Math.min(100, tt.maxPerOrder, tt.availableQuantity));
    this.form.controls.quantity.setValue(max > 0 ? 1 : 0);
  }

  /** Tăng số lượng, chặn vượt giới hạn (validate ngay tại nút). */
  protected increment(): void {
    if (this.busy() || this.uncertain()) return;
    const next = Math.min(this.limit(), this.quantity() + 1);
    this.form.controls.quantity.setValue(next);
  }

  /** Giảm số lượng, không xuống dưới 1. */
  protected decrement(): void {
    if (this.busy() || this.uncertain()) return;
    const next = Math.max(1, this.quantity() - 1);
    this.form.controls.quantity.setValue(next);
  }

  protected submit(): void {
    if (this.busy() || this.uncertain() || !this.session.isCustomer()) return;
    const tt = this.selected();
    if (!tt || this.unavailableReason(tt, Date.now())) return;
    const quantity = this.quantity();
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > this.limit()) return;
    this.error.set('');
    this.busy.set(true);
    this.orders
      .create({ ticketTypeId: tt.id, quantity: this.quantity() })
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => {
          this.feedback.success('Đã tạo đơn và giữ chỗ. Vui lòng thanh toán trước thời hạn.');
          this.uncertain.set(true); // Không tạo lại đơn kể cả khi điều hướng chưa kết thúc.
          void this.router.navigate(['/payment'], { queryParams: { orderCode: order.id } });
        },
        error: (error: unknown) => {
          this.error.set(
            this.feedback.problem(error, 'Không thể tạo đơn. Vui lòng kiểm tra lại thông tin.')
              .message,
          );
          if (!(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500)
            this.uncertain.set(true);
          if (error instanceof HttpErrorResponse && error.status === 401) {
            void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
          }
        },
      });
  }
}

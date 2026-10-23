import { LoadingState } from '../../shared/loading-state';
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
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';

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
  ],
  template: `
    <app-page-header title="Đặt vé" subtitle="Chọn một hạng vé và số lượng cho đơn của bạn." />
    @if (loading()) {
      <app-loading-state label="Đang tải thông tin đặt vé…" />
    } @else if (loadError()) {
      <p class="form-notice error" role="alert">{{ loadError() }}</p>
      <a mat-stroked-button routerLink="/events">Khám phá sự kiện</a>
    } @else if (event(); as ev) {
      <a class="text-link" [routerLink]="['/events', ev.id]">Về chi tiết sự kiện</a>
      <div class="booking-grid">
        <section class="panel">
          <h2>{{ ev.title }}</h2>
          <p class="muted">{{ ev.startTime | dateTime }}</p>
          <p class="muted">{{ ev.venue.name }}, {{ ev.venue.city }}</p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <fieldset class="ticket-options" [disabled]="busy() || uncertain()">
              <legend>Chọn hạng vé</legend>
              <div class="ticket-list" role="radiogroup" aria-label="Hạng vé">
                @for (tt of ev.ticketTypes; track tt.id) {
                  <button
                    type="button"
                    class="ticket-option"
                    role="radio"
                    [class.selected]="values().ticketTypeId === tt.id"
                    [attr.aria-checked]="values().ticketTypeId === tt.id"
                    [disabled]="!!unavailableReason(tt) || busy() || uncertain()"
                    (click)="select(tt)"
                  >
                    <span class="to-info">
                      <strong class="to-name">{{ tt.name }}</strong>
                      @if (unavailableReason(tt)) {
                        <span class="to-reason">{{ unavailableReason(tt) }}</span>
                      } @else if (tt.saleEnd) {
                        <span class="to-note muted">Ngừng bán: {{ tt.saleEnd | dateTime }}</span>
                      }
                    </span>
                    <span class="to-right">
                      <span class="to-price">{{ tt.price | money }}</span>
                      <span class="to-mark" aria-hidden="true">
                        @if (values().ticketTypeId === tt.id) {
                          <app-icon name="check" />
                        }
                      </span>
                    </span>
                  </button>
                }
              </div>
            </fieldset>

            @if (selected(); as tt) {
              <div class="qty-block">
                <div class="qty-head">
                  <span class="qty-label">Số lượng</span>
                  <span class="muted qty-hint">Tối đa {{ limit() }} vé/đơn</span>
                </div>
                <div class="stepper" role="group" aria-label="Số lượng vé">
                  <button
                    type="button"
                    class="step-btn"
                    (click)="decrement()"
                    [disabled]="busy() || uncertain() || quantity() <= 1"
                    aria-label="Giảm số lượng"
                  >
                    −
                  </button>
                  <span class="step-value" aria-live="polite" aria-atomic="true">
                    {{ quantity() }}
                  </span>
                  <button
                    type="button"
                    class="step-btn"
                    (click)="increment()"
                    [disabled]="busy() || uncertain() || quantity() >= limit()"
                    aria-label="Tăng số lượng"
                  >
                    +
                  </button>
                </div>
              </div>
            }

            @if (validationError()) {
              <p class="form-notice warning" role="status">{{ validationError() }}</p>
            }
            @if (error()) {
              <p class="form-notice error" role="alert">{{ error() }}</p>
            }
            @if (uncertain()) {
              <p class="muted">
                Chưa xác nhận được kết quả tạo đơn. Kiểm tra đơn của tôi trước khi đặt lại để tránh
                giữ chỗ trùng.
              </p>
              <a mat-flat-button routerLink="/orders">Kiểm tra đơn của tôi</a>
            } @else {
              <button
                mat-flat-button
                type="submit"
                class="submit-btn"
                [disabled]="busy() || !!validationError() || !session.isCustomer()"
                [attr.aria-busy]="busy()"
              >
                {{ busy() ? 'Đang tạo đơn…' : 'Tạo đơn và giữ chỗ' }}
              </button>
            }
          </form>
        </section>

        <aside class="panel summary" aria-label="Tóm tắt đặt vé">
          <h2>Tóm tắt</h2>
          @if (selected(); as tt) {
            <div class="summary-line">
              <span>{{ tt.name }}</span>
              <span>{{ tt.price | money }}</span>
            </div>
            <div class="summary-line muted">
              <span>Số lượng</span>
              <span>× {{ quantity() || 0 }}</span>
            </div>
            <p class="total">Tạm tính: {{ estimate() | money }}</p>
          } @else {
            <p class="muted">Chọn một hạng vé để xem tạm tính.</p>
          }
          <p class="muted">
            Đơn chỉ giữ chỗ sau khi tạo thành công. Giá và số lượng cuối cùng được backend xác nhận.
          </p>
          <p class="muted">Bạn sẽ xem thời hạn giữ chỗ và thanh toán giả lập ở bước tiếp theo.</p>
        </aside>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      padding-top: 32px;
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
      border-color: var(--app-ink);
    }
    .ticket-option:active:not(:disabled) {
      transform: translateY(1px);
    }
    .ticket-option.selected {
      border-color: var(--app-ink);
      box-shadow: inset 0 0 0 1px var(--app-ink);
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
    .to-note {
      font-size: 0.82rem;
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
      background: var(--app-ink);
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
    .summary-line {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin: 0.4rem 0;
    }
    .total {
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
  private readonly now = signal(Date.now());

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
              const tt =
                ev.ticketTypes.find((t) => t.id === requested) ??
                ev.ticketTypes.find((t) => !this.unavailableReason(t));
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

  protected unavailableReason(tt: TicketType): string {
    const now = this.now();
    const ev = this.event();
    if (ev && Date.parse(ev.startTime) <= now) return 'Sự kiện đã bắt đầu, không thể đặt thêm vé.';
    if (tt.saleStart && now < Date.parse(tt.saleStart)) return 'Hạng vé chưa đến giờ mở bán.';
    if (tt.saleEnd && now >= Date.parse(tt.saleEnd)) return 'Hạng vé đã ngừng bán.';
    if (tt.availableQuantity <= 0) return 'Hạng vé đã hết vé.';
    return '';
  }

  /** Chọn hạng vé; reset số lượng về 1 trong giới hạn hợp lệ của hạng vừa chọn. */
  protected select(tt: TicketType): void {
    if (this.busy() || this.uncertain() || this.unavailableReason(tt)) return;
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
    if (this.busy() || this.uncertain() || this.validationError() || !this.session.isCustomer())
      return;
    const tt = this.selected();
    if (!tt) return;
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
          void this.router.navigate(['/orders', order.id]);
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

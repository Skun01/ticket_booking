import { LoadingState } from '../../shared/loading-state';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { EMPTY, catchError, combineLatest, finalize, interval, switchMap } from 'rxjs';
import { CatalogApi, OrderApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { EventDetail, TicketType } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-booking-page',
  imports: [
    LoadingState,
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    DateTimePipe,
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
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Hạng vé</mat-label>
              <mat-select formControlName="ticketTypeId" [disabled]="busy() || uncertain()">
                @for (tt of ev.ticketTypes; track tt.id) {
                  <mat-option [value]="tt.id" [disabled]="!!unavailableReason(tt)">
                    {{ tt.name }} - {{ tt.price | money }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (selected(); as tt) {
              <p class="muted">
                Còn {{ tt.availableQuantity }} vé. Tối đa {{ limit() }} vé cho đơn này.
              </p>
              <mat-form-field appearance="outline" class="form-field">
                <mat-label>Số lượng</mat-label>
                <input
                  matInput
                  type="number"
                  formControlName="quantity"
                  min="1"
                  [max]="limit()"
                  step="1"
                  [readonly]="busy() || uncertain()"
                  aria-describedby="quantity-help"
                />
              </mat-form-field>
              <p id="quantity-help" class="muted">Nhập số nguyên từ 1 đến {{ limit() }}.</p>
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
            <p>{{ tt.name }}</p>
            <p>{{ quantity() || 0 }} vé × {{ tt.price | money }}</p>
            <p class="total">Tạm tính: {{ estimate() | money }}</p>
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
    .total {
      font-size: 1.2rem;
      font-weight: 700;
      border-top: 1px solid var(--app-line);
      padding-top: 16px;
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
    quantity: new FormControl<number | null>(1),
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

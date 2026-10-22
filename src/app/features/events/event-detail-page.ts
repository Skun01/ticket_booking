import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, catchError, distinctUntilChanged, interval, map, switchMap } from 'rxjs';
import { MatButton } from '@angular/material/button';
import { CatalogApi } from '../../core/api/catalog.api';
import { EventDetail, TicketType } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-event-detail-page',
  imports: [RouterLink, MatButton, DateTimePipe, Icon, MoneyPipe],
  template: `
    @if (loading()) {
      <p role="status" class="muted">Đang tải chi tiết sự kiện…</p>
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      <a routerLink="/events" class="text-link"><app-icon name="left" /> Về danh sách sự kiện</a>
    } @else if (event(); as ev) {
      <a routerLink="/events" class="text-link back"><app-icon name="left" /> Tất cả sự kiện</a>

      <div class="detail-banner" [style.background-image]="bannerStyle(ev)">
        @if (!ev.bannerUrl) {
          <app-icon name="calendar" />
        }
      </div>

      <div class="detail-grid">
        <div class="detail-main">
          <span class="event-cat">{{ ev.category.name }}</span>
          <h1>{{ ev.title }}</h1>
          <p class="detail-meta">
            <app-icon name="calendar" /> {{ ev.startTime | dateTime }} đến
            {{ ev.endTime | dateTime }}
          </p>
          <p class="detail-meta">
            <app-icon name="compass" /> {{ ev.venue.name }} · {{ ev.venue.address }},
            {{ ev.venue.city }}
          </p>
          @if (ev.description) {
            <div class="detail-desc">{{ ev.description }}</div>
          }
        </div>

        <aside class="detail-tickets">
          <h2>Hạng vé</h2>
          <p class="muted">Thời gian hiển thị theo giờ Việt Nam (UTC+7).</p>
          @if (ev.ticketTypes.length === 0) {
            <p class="muted">Chưa có hạng vé nào được mở bán.</p>
          } @else {
            @for (tt of ev.ticketTypes; track tt.id) {
              <div class="ticket-row">
                <div>
                  <strong>{{ tt.name }}</strong>
                  <p class="ticket-sub">{{ tt.price | money }}</p>
                  <p class="ticket-sub muted">
                    Còn {{ tt.availableQuantity }} vé · tối đa {{ tt.maxPerOrder }}/đơn
                  </p>
                  @if (tt.saleStart) {
                    <p class="ticket-sub muted">Mở bán: {{ tt.saleStart | dateTime }}</p>
                  }
                  @if (tt.saleEnd) {
                    <p class="ticket-sub muted">Ngừng bán: {{ tt.saleEnd | dateTime }}</p>
                  }
                  @if (unavailableReason(tt)) {
                    <p class="ticket-sub">{{ unavailableReason(tt) }}</p>
                  }
                </div>
                <button
                  mat-flat-button
                  type="button"
                  [disabled]="
                    !!unavailableReason(tt) ||
                    session.loading() ||
                    (session.isAuthenticated() && !session.isCustomer())
                  "
                  (click)="book(tt)"
                >
                  <app-icon name="right" /> Đặt vé
                </button>
              </div>
            }
          }
          @if (session.isAuthenticated() && !session.isCustomer()) {
            <p class="muted">Chỉ tài khoản khách hàng (CUSTOMER) được đặt vé.</p>
          }
        </aside>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      padding-top: 24px;
    }
    .detail-main,
    .ticket-row > div {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .ticket-row button {
      flex-shrink: 0;
      white-space: nowrap;
    }
    .ticket-row {
      flex-wrap: wrap;
    }
    .back {
      margin: 0.5rem 0 1rem;
    }
    .detail-banner {
      aspect-ratio: 21 / 9;
      border-radius: 0.5rem;
      background: var(--app-soft);
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--app-muted);
      font-size: 3rem;
      margin-bottom: 1.5rem;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 32px;
      align-items: start;
    }
    .event-cat {
      font-size: 0.72rem;
      font-weight: 750;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--app-muted);
    }
    .detail-main h1 {
      font-size: clamp(1.8rem, 3.5vw, 2.6rem);
      margin: 0.4rem 0 1rem;
    }
    .detail-meta {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin: 0.3rem 0;
      color: var(--app-muted);
    }
    .detail-desc {
      margin-top: 1.5rem;
      white-space: pre-line;
      line-height: 1.7;
    }
    .detail-tickets {
      padding: 24px;
      border: 1px solid var(--app-line);
      border-radius: 0.4rem;
      background: var(--app-panel);
      position: sticky;
      top: 24px;
    }
    .detail-tickets h2 {
      margin-bottom: 1rem;
    }
    .ticket-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 16px 0;
      border-top: 1px solid var(--app-line);
    }
    .ticket-sub {
      margin: 0.2rem 0 0;
      font-size: 0.9rem;
    }
    @media (max-width: 900px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }
      .detail-tickets {
        position: static;
      }
    }
  `,
})
export class EventDetailPage {
  private readonly api = inject(CatalogApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly session = inject(SessionService);
  private readonly now = signal(Date.now());
  private readonly router = inject(Router);

  protected readonly event = signal<EventDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        switchMap((id) => {
          this.loading.set(true);
          this.error.set('');
          this.event.set(null);
          const eventId = Number(id);
          if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(eventId)) {
            this.error.set('Đường dẫn sự kiện không hợp lệ.');
            this.loading.set(false);
            return EMPTY;
          }
          return this.api.getEvent(eventId).pipe(
            catchError((error: unknown) => {
              this.error.set(
                error instanceof HttpErrorResponse && error.status === 404
                  ? 'Sự kiện không tồn tại hoặc chưa được công bố.'
                  : 'Không thể tải chi tiết sự kiện. Vui lòng tải lại trang để thử lại.',
              );
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((ev) => {
        this.event.set(ev);
        this.loading.set(false);
      });
  }

  protected unavailableReason(tt: TicketType): string {
    const now = this.now();
    if (this.event() && Date.parse(this.event()!.startTime) <= now) return 'Sự kiện đã bắt đầu';
    if (tt.saleStart && now < Date.parse(tt.saleStart)) return 'Chưa đến giờ mở bán';
    if (tt.saleEnd && now >= Date.parse(tt.saleEnd)) return 'Đã ngừng bán';
    if (tt.availableQuantity <= 0) return 'Đã hết vé';
    return '';
  }

  protected bannerStyle(ev: EventDetail): string | null {
    return ev.bannerUrl ? `url('${ev.bannerUrl}')` : null;
  }

  protected book(tt: TicketType): void {
    const ev = this.event();
    if (!ev || this.session.loading() || this.unavailableReason(tt)) return;
    // customerGuard giữ cả sự kiện và hạng vé đã chọn qua bước đăng nhập.
    void this.router.navigate(['/events', ev.id, 'book'], { queryParams: { ticketTypeId: tt.id } });
  }
}

import { LoadingState } from '../../shared/loading-state.component';
import { FeedbackService } from '../../shared/feedback.service';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, catchError, distinctUntilChanged, interval, map, switchMap } from 'rxjs';
import { MatButton } from '@angular/material/button';
import { CatalogApi } from '../../core/api/catalog.api';
import { EventDetail } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { Icon } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { EventSalesStatus } from './event-sales-status.component';
import { getEventSalesState, ticketUnavailableReason } from './ticket-availability';

@Component({
  selector: 'app-event-detail-page',
  imports: [LoadingState, RouterLink, MatButton, DateTimePipe, Icon, MoneyPipe, EventSalesStatus],
  templateUrl: './event-detail-page.component.html',
  
  styles: `
    :host {
      display: block;
      padding-top: 24px;
    }
    .back {
      margin: 0.5rem 0 1rem;
    }
    .detail-banner {
      aspect-ratio: 21 / 9;
      border-radius: 0.5rem;
      background: linear-gradient(135deg, var(--app-accent-soft), var(--app-info-soft));
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--app-accent);
      font-size: 3rem;
      margin-bottom: 1.5rem;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      grid-template-areas: 'main purchase' 'description purchase';
      gap: 28px 32px;
      align-items: start;
    }
    .detail-main,
    .purchase-panel,
    .detail-description {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .detail-main {
      grid-area: main;
    }
    h1 {
      font-size: clamp(1.8rem, 3.5vw, 2.6rem);
      margin: 0.4rem 0 1.5rem;
    }
    .event-schedule {
      display: grid;
      gap: 16px;
    }
    .schedule-block {
      border-left: 3px solid var(--app-accent);
      padding: 12px 16px;
      border-radius: 0 0.4rem 0.4rem 0;
      background: var(--app-accent-soft);
    }
    .schedule-block + .schedule-block {
      border-left-color: var(--app-info);
      background: var(--app-info-soft);
    }
    .schedule-block app-icon {
      color: var(--app-accent);
    }
    .schedule-block + .schedule-block app-icon {
      color: var(--app-info);
    }
    .schedule-block h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1rem;
      margin: 0 0 8px;
    }
    dl,
    dd {
      margin: 0;
    }
    dl > div {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin-top: 4px;
    }
    dt {
      color: var(--app-muted);
      min-width: 64px;
      font-size: 0.9rem;
    }
    dd {
      font-weight: 700;
    }
    .schedule-note,
    .timezone,
    .purchase-help {
      color: var(--app-muted);
      font-size: 0.82rem;
      margin: 8px 0 0;
    }
    .timezone {
      margin-top: 16px;
    }
    .detail-meta {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      margin: 16px 0 0;
    }
    .detail-meta app-icon {
      flex-shrink: 0;
    }
    .detail-description {
      grid-area: description;
    }
    .detail-description h2 {
      font-size: 1.25rem;
      margin: 0 0 12px;
    }
    .detail-desc {
      white-space: pre-line;
      line-height: 1.7;
    }
    .purchase-panel {
      grid-area: purchase;
      padding: 24px;
      border: 1px solid var(--app-line);
      border-top: 4px solid var(--app-accent);
      border-radius: 0.4rem;
      background: linear-gradient(var(--app-accent-soft), var(--app-panel) 180px);
      position: sticky;
      top: 24px;
    }
    .purchase-panel h2 {
      font-size: 1.15rem;
      margin: 0 0 16px;
    }
    .purchase-price {
      margin-top: 24px;
    }
    .purchase-price span,
    .purchase-date span {
      display: block;
      color: var(--app-muted);
      font-size: 0.85rem;
    }
    .purchase-price strong {
      font-size: 1.8rem;
      letter-spacing: -0.04em;
      color: var(--app-accent-strong);
    }
    .purchase-date {
      margin: 20px 0;
      padding-top: 16px;
      border-top: 1px solid var(--app-line);
    }
    .buy-button {
      width: 100%;
      min-height: 48px;
    }
    .stock-notice {
      font-weight: 700;
      color: var(--app-danger);
      margin: 12px 0 0;
    }
    @media (max-width: 900px) {
      .detail-grid {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: 'main' 'purchase' 'description';
      }
      .purchase-panel {
        position: static;
      }
    }
  `,
})
export class EventDetailPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(CatalogApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly session = inject(SessionService);
  protected readonly now = signal(Date.now());
  private readonly router = inject(Router);

  protected readonly event = signal<EventDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly salesState = computed(() => {
    const ev = this.event();
    return ev ? getEventSalesState(ev, this.now()) : null;
  });
  protected readonly minimumPrice = computed(() => {
    const prices = this.event()?.ticketTypes.map((tt) => tt.price).filter(
      (price) => Number.isFinite(price) && price >= 0,
    );
    return prices?.length ? Math.min(...prices) : null;
  });
  protected readonly soldOut = computed(() => {
    const ev = this.event();
    return (
      this.salesState()?.phase === 'on-sale' &&
      !!ev?.ticketTypes.length &&
      ev.ticketTypes.every((tt) => !!ticketUnavailableReason(ev, tt, this.now()))
    );
  });
  protected readonly purchaseReason = computed(() => {
    const ev = this.event();
    if (!ev) return 'Không tải được lịch bán vé.';
    if (!ev.ticketTypes.length) return 'Chưa có hạng vé nào được mở bán.';
    if (this.salesState()?.phase === 'upcoming') return 'Vé sẽ được mở bán theo lịch ở trên.';
    if (this.salesState()?.phase === 'ongoing') return 'Sự kiện đang diễn ra, đã kết thúc bán vé.';
    if (this.salesState()?.phase === 'ended') return 'Sự kiện đã kết thúc.';
    if (this.salesState()?.phase === 'invalid') return 'Lịch bán vé chưa khả dụng.';
    return this.soldOut() ? 'Các hạng vé hiện đã hết. Vui lòng quay lại sau.' : '';
  });

  constructor() {
    const sub = interval(1000).subscribe(() => this.now.set(Date.now()));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
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
                  : this.feedback.problem(
                      error,
                      'Không thể tải chi tiết sự kiện. Vui lòng tải lại trang để thử lại.',
                    ).message,
              );
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((ev) => {
        this.event.set(ev);
        this.loading.set(false);
      });
  }

  protected bannerStyle(ev: EventDetail): string | null {
    return ev.bannerUrl ? `url('${ev.bannerUrl}')` : null;
  }

  protected book(): void {
    const ev = this.event();
    if (
      !ev ||
      this.session.loading() ||
      (this.session.isAuthenticated() && !this.session.isCustomer()) ||
      !ev.ticketTypes.some((tt) => !ticketUnavailableReason(ev, tt, Date.now()))
    ) return;
    // customerGuard giữ đường dẫn mua vé qua bước đăng nhập.
    void this.router.navigate(['/events', ev.id, 'book']);
  }
}

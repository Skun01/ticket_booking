import { LoadingState } from '../../shared/loading-state';
import { FeedbackService } from '../../shared/feedback.service';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { CatalogApi } from '../../core/api/catalog.api';
import { EventSummary } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-home-page',
  imports: [LoadingState, RouterLink, MatButtonModule, Icon, DateTimePipe],
  template: `
    <section class="intro-section">
      <p class="eyebrow">NỀN TẢNG BÁN VÉ SỰ KIỆN</p>
      <h1>Khám phá & đặt vé<br />cho những sự kiện đáng nhớ</h1>
      <p class="lead">
        Tìm sự kiện theo sở thích, xem hạng vé và lên lịch cho trải nghiệm tiếp theo.
      </p>
      <div class="hero-actions">
        <a mat-flat-button routerLink="/events"><app-icon name="search" /> Khám phá sự kiện</a>
        @if (!session.isAuthenticated()) {
          <a mat-stroked-button routerLink="/register"><app-icon name="user" /> Tạo tài khoản</a>
        } @else if (session.isCustomer()) {
          <a mat-stroked-button routerLink="/tickets">Vé của tôi</a>
        } @else if (session.isOrganizer()) {
          <a mat-stroked-button routerLink="/organizer">Quản lý sự kiện của tôi</a>
        } @else if (session.isAdmin()) {
          <a mat-stroked-button routerLink="/admin">Tổng quan quản trị</a>
        }
      </div>
    </section>

    <section aria-labelledby="featured-title">
      <div class="section-heading">
        <h2 id="featured-title">Sự kiện sắp diễn ra</h2>
        <a routerLink="/events" class="muted">Xem tất cả →</a>
      </div>
      @if (loading()) {
        <app-loading-state label="Đang tải sự kiện…" />
      } @else if (error()) {
        <p class="form-notice error" role="alert">{{ error() }}</p>
        <button mat-stroked-button type="button" (click)="load()">Thử lại</button>
      } @else if (featured().length === 0) {
        <p class="muted">Hiện chưa có sự kiện nào được công bố.</p>
      } @else {
        <div class="event-grid">
          @for (ev of featured(); track ev.id) {
            <a class="event-card" [routerLink]="['/events', ev.id]">
              <div class="event-banner" [style.background-image]="bannerStyle(ev)">
                @if (!ev.bannerUrl) {
                  <app-icon name="calendar" />
                }
              </div>
              <div class="event-body">
                <span class="event-cat">{{ ev.category.name }}</span>
                <h3>{{ ev.title }}</h3>
                <p class="event-meta"><app-icon name="calendar" /> {{ ev.startTime | dateTime }}</p>
                <p class="event-meta">
                  <app-icon name="compass" /> {{ ev.venue.name }}, {{ ev.venue.city }}
                </p>
              </div>
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .event-body {
      overflow-wrap: anywhere;
    }
    .intro-section h1 {
      font-size: clamp(2rem, 4vw, 3.2rem);
    }
    @media (prefers-reduced-motion: reduce) {
      .event-card {
        transition: none;
      }
      .event-card:hover {
        transform: none;
      }
    }
    .event-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    .event-card {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--app-line);
      border-radius: 0.4rem;
      overflow: hidden;
      background: var(--app-panel);
      text-decoration: none;
      color: var(--app-ink);
      transition:
        border-color 0.15s ease,
        transform 0.15s ease;
    }
    .event-card:hover {
      border-color: var(--app-ink);
      transform: translateY(-2px);
    }
    .event-banner {
      aspect-ratio: 16 / 9;
      background: var(--app-soft);
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--app-muted);
      font-size: 2rem;
    }
    .event-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .event-cat {
      font-size: 0.72rem;
      font-weight: 750;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--app-muted);
    }
    .event-body h3 {
      margin: 0.1rem 0 0.4rem;
    }
    .event-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 0.85rem;
      color: var(--app-muted);
    }
    .event-meta app-icon {
      font-size: 1rem;
    }
    @media (max-width: 900px) {
      .event-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .event-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class HomePage {
  private readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionService);
  private readonly api = inject(CatalogApi);

  protected readonly featured = signal<EventSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    this.load();
  }

  protected load(): void {
    if (this.loading() && this.featured().length) return;
    this.loading.set(true);
    this.error.set('');
    this.api
      .listEvents({ from: new Date().toISOString() }, { page: 0, size: 6 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.featured.set(res.content);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            this.feedback.problem(error, 'Không thể tải sự kiện. Vui lòng thử lại.').message,
          );
          this.loading.set(false);
        },
      });
  }

  protected bannerStyle(ev: EventSummary): string | null {
    return ev.bannerUrl ? `url('${ev.bannerUrl}')` : null;
  }
}

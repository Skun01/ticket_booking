import { LoadingState } from '../../shared/loading-state.component';
import { FeedbackService } from '../../shared/feedback.service';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { interval } from 'rxjs';
import { EventSalesStatus } from '../events/event-sales-status.component';
import { CatalogApi } from '../../core/api/catalog.api';
import { EventSummary } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { Icon } from '../../shared/icon.component';

@Component({
  selector: 'app-home-page',
  imports: [LoadingState, RouterLink, MatButtonModule, Icon, DateTimePipe, EventSalesStatus],
  templateUrl: './home-page.component.html',
  
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
      border-color: var(--app-accent);
      transform: translateY(-2px);
    }
    .event-banner {
      aspect-ratio: 16 / 9;
      background: linear-gradient(135deg, var(--app-accent-soft), var(--app-info-soft));
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--app-accent);
      font-size: 2rem;
    }
    .event-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .event-body h3 {
      margin: 0.1rem 0 0.4rem;
    }
    .card-dates {
      margin: 10px 0;
      font-size: 0.85rem;
    }
    .card-dates > div {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 10px;
      margin-top: 5px;
    }
    .card-dates dt {
      color: var(--app-muted);
      min-width: 56px;
    }
    .card-dates dd {
      margin: 0;
      font-weight: 700;
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

  protected readonly now = signal(Date.now());
  protected readonly featured = signal<EventSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
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

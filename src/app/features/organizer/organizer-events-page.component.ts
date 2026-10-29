import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { OrganizerApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { EventItem } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { EmptyState } from '../../shared/empty-state.component';
import { PageHeader } from '../../shared/page-header.component';
import { Paginator } from '../../shared/paginator.component';
import { StatusBadge } from '../../shared/status-badge.component';

@Component({
  selector: 'app-organizer-events-page',
  imports: [
    LoadingState,
    RouterLink,
    MatButton,
    DateTimePipe,
    EmptyState,
    PageHeader,
    Paginator,
    StatusBadge,
  ],
  templateUrl: './organizer-events-page.component.html',
  
  styles: `
    .event {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      border-top: 1px solid var(--app-line);
      padding: 24px 0;
      overflow-wrap: anywhere;
    }
    .event h2 {
      font-size: 1.2rem;
      margin: 12px 0;
    }
    .event p {
      margin-bottom: 0.5rem;
    }
    .actions {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    @media (max-width: 768px) {
      .event {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .actions {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
      }
    }
  `,
})
export class OrganizerEventsPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(OrganizerApi);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly events = signal<EventItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);

  constructor() {
    this.load(0);
  }

  protected load(page: number): void {
    this.request?.unsubscribe();
    this.page.set(page);
    this.loading.set(true);
    this.error.set('');
    this.request = this.api
      .listEvents({ page, size: 12 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.events.set(result.content);
          this.page.set(result.page);
          this.totalPages.set(result.totalPages);
          this.total.set(result.totalElements);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(this.feedback.problem(error, 'Không tải được sự kiện của bạn.').message);
          this.loading.set(false);
        },
      });
  }
}

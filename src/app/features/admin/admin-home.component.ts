import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { Subscription, finalize, forkJoin, timeout } from 'rxjs';
import { AdminApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { RevenueReport } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header.component';
import { recentRevenueRange } from '../../shared/vietnam-time';

interface AdminSummary {
  categories: number;
  venues: number;
  report: RevenueReport;
}

@Component({
  selector: 'app-admin-home',
  imports: [LoadingState, RouterLink, MatButton, DateTimePipe, MoneyPipe, PageHeader],
  templateUrl: './admin-home.component.html',
  
  styles: `
    .quick-links {
      display: grid;
      gap: 0;
      border-top: 1px solid var(--app-line);
      margin-bottom: 24px;
    }
    .quick-links a {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
      gap: 16px;
      padding: 20px 0;
      border-bottom: 1px solid var(--app-line);
      text-decoration: none;
    }
    .quick-links a:hover strong {
      text-decoration: underline;
    }
    .quick-links span,
    dt {
      color: var(--app-muted);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }
    dd {
      font-size: 1.6rem;
      font-weight: 700;
      margin: 0;
      overflow-wrap: anywhere;
    }
    @media (max-width: 768px) {
      .quick-links a,
      .metrics {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }
  `,
})
export class AdminHome {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(AdminApi);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly summary = signal<AdminSummary | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.summary.set(null);
    const range = recentRevenueRange();
    this.request = forkJoin({
      categories: this.api.listCategories({ size: 1 }),
      venues: this.api.listVenues({ size: 1 }),
      report: this.api.revenueReport(range.from, range.to),
    })
      .pipe(
        timeout(30000),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) =>
          this.summary.set({
            categories: result.categories.totalElements,
            venues: result.venues.totalElements,
            report: result.report,
          }),
        error: (error) =>
          this.error.set(
            this.feedback.problem(error, 'Không tải được số liệu tổng quan. Vui lòng cập nhật lại.')
              .message,
          ),
      });
  }
}

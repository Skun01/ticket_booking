import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { OrganizerApi } from '../../core/api/catalog.api';
import { apiError } from '../../core/api/api-error';
import { EventItem } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { EmptyState } from '../../shared/empty-state';
import { PageHeader } from '../../shared/page-header';
import { Paginator } from '../../shared/paginator';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'app-organizer-events-page',
  imports: [RouterLink, MatButton, DateTimePipe, EmptyState, PageHeader, Paginator, StatusBadge],
  template: `
    <app-page-header
      title="Sự kiện của tôi"
      subtitle="Quản lý bản nháp, hạng vé và theo dõi doanh thu sự kiện."
    >
      <a mat-flat-button routerLink="/organizer/events/new">Tạo sự kiện</a>
    </app-page-header>
    @if (loading()) {
      <p role="status">Đang tải sự kiện…</p>
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      <button mat-stroked-button type="button" (click)="load(page())">Thử lại</button>
    } @else {
      <p class="muted">
        {{ total() }} sự kiện. Chỉ bản nháp mới được chỉnh sửa thông tin và hạng vé.
      </p>
      @if (events().length === 0) {
        <app-empty-state
          icon="calendar"
          title="Chưa có sự kiện"
          description="Tạo bản nháp, thêm hạng vé, sau đó phát hành sự kiện của bạn."
        />
      } @else {
        <div class="events">
          @for (ev of events(); track ev.id) {
            <article class="event">
              <div>
                <app-status-badge [status]="ev.status" />
                <h2>
                  <a [routerLink]="['/organizer/events', ev.id]">{{ ev.title }}</a>
                </h2>
                <p>{{ ev.startTime | dateTime }} đến {{ ev.endTime | dateTime }}</p>
                <p class="muted">
                  {{ ev.category.name }} · {{ ev.venue.name }}, {{ ev.venue.city }}
                </p>
              </div>
              <div class="actions">
                <a mat-stroked-button [routerLink]="['/organizer/events', ev.id]">Quản lý</a>
                @if (ev.status === 'DRAFT') {
                  <a [routerLink]="['/organizer/events', ev.id, 'edit']">Sửa thông tin</a>
                }
                <a [routerLink]="['/organizer/events', ev.id, 'report']">Báo cáo</a>
              </div>
            </article>
          }
        </div>
      }
      <app-paginator [page]="page()" [totalPages]="totalPages()" (pageChange)="load($event)" />
    }
  `,
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
          this.error.set(apiError(error, 'Không tải được sự kiện của bạn.').message);
          this.loading.set(false);
        },
      });
  }
}

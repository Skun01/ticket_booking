import { LoadingState } from '../../shared/loading-state';
import { FeedbackService } from '../../shared/feedback.service';
import { vietnamInstant } from '../../shared/vietnam-time';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, expand, reduce, Subscription } from 'rxjs';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { CatalogApi } from '../../core/api/catalog.api';
import { Category, EventFilter, EventSummary, PageResponse } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { Paginator } from '../../shared/paginator';

@Component({
  selector: 'app-events-page',
  imports: [
    LoadingState,
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    DateTimePipe,
    EmptyState,
    Icon,
    PageHeader,
    Paginator,
  ],
  template: `
    <app-page-header
      eyebrow="KHÁM PHÁ"
      title="Sự kiện"
      subtitle="Tìm và đặt vé cho các sự kiện sắp diễn ra."
    />

    @if (categoryError()) {
      <p class="form-notice warning" role="status">{{ categoryError() }}</p>
    }
    <p id="event-filter-time-help" class="muted">Thời gian lọc nhập theo giờ Việt Nam (UTC+7).</p>
    <form class="filter-bar" [formGroup]="filterForm" (ngSubmit)="applyFilter()">
      <mat-form-field appearance="outline">
        <mat-label>Danh mục</mat-label>
        <mat-select formControlName="categoryId">
          <mat-option [value]="null">Tất cả danh mục</mat-option>
          @for (c of categories(); track c.id) {
            <mat-option [value]="c.id">{{ c.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Thành phố</mat-label>
        <input matInput formControlName="city" maxlength="100" placeholder="VD: Hà Nội" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Từ ngày</mat-label>
        <input
          matInput
          type="datetime-local"
          formControlName="from"
          aria-describedby="event-filter-time-help"
        />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Đến ngày</mat-label>
        <input
          matInput
          type="datetime-local"
          formControlName="to"
          aria-describedby="event-filter-time-help"
        />
      </mat-form-field>
      <div class="filter-actions">
        <button mat-flat-button type="submit"><app-icon name="search" /> Lọc</button>
        <button mat-stroked-button type="button" (click)="resetFilter()">Xóa lọc</button>
      </div>
    </form>

    @if (filterError()) {
      <p class="form-notice error" role="alert">{{ filterError() }}</p>
    }
    @if (loading()) {
      <app-loading-state label="Đang tải sự kiện…" />
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      <button mat-stroked-button type="button" (click)="load()">Thử lại</button>
    } @else if (events().length === 0) {
      <app-empty-state
        icon="calendar"
        title="Chưa có sự kiện nào"
        description="Không tìm thấy sự kiện khớp bộ lọc. Thử điều chỉnh tiêu chí tìm kiếm."
      />
    } @else {
      <div class="event-grid">
        @for (ev of events(); track ev.id) {
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
      <app-paginator [page]="page()" [totalPages]="totalPages()" (pageChange)="goTo($event)" />
    }
  `,
  styles: `
    .filter-bar {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px 16px;
      align-items: start;
      margin-bottom: 1.5rem;
    }
    .filter-bar mat-form-field {
      width: 100%;
    }
    .filter-actions {
      grid-column: 1 / -1;
      display: flex;
      gap: 0.75rem;
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
    :host {
      display: block;
      padding-top: 32px;
    }
    .event-body {
      overflow-wrap: anywhere;
    }
    @media (prefers-reduced-motion: reduce) {
      .event-card {
        transition: none;
      }
      .event-card:hover {
        transform: none;
      }
    }
    @media (max-width: 900px) {
      .filter-bar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .event-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .filter-bar,
      .event-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class EventsPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(CatalogApi);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest?: Subscription;
  private appliedFilter: EventFilter = {};

  protected readonly categories = signal<Category[]>([]);
  protected readonly categoryError = signal('');
  protected readonly filterError = signal('');
  protected readonly events = signal<EventSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);

  private readonly size = 12;

  protected readonly filterForm = this.fb.nonNullable.group({
    categoryId: [null as number | null],
    city: [''],
    from: [''],
    to: [''],
  });

  constructor() {
    this.api
      .listCategories({ size: 100 })
      .pipe(
        expand((res) =>
          res.page + 1 < res.totalPages
            ? this.api.listCategories({ page: res.page + 1, size: 100 })
            : EMPTY,
        ),
        reduce((all, res) => all.concat(res.content), [] as Category[]),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () =>
          this.categoryError.set(
            'Không tải được danh mục. Bạn vẫn có thể lọc theo thành phố và thời gian; tải lại trang để thử lại.',
          ),
      });
    this.load();
  }

  protected applyFilter(): void {
    this.filterError.set('');
    const { from, to } = this.filterForm.getRawValue();
    if ((from && !vietnamInstant(from)) || (to && !vietnamInstant(to))) {
      this.filterError.set('Vui lòng nhập ngày giờ hợp lệ.');
      return;
    }
    if (from && to && Date.parse(vietnamInstant(from)!) > Date.parse(vietnamInstant(to)!)) {
      this.filterError.set('Thời gian bắt đầu phải trước hoặc bằng thời gian kết thúc.');
      return;
    }
    this.appliedFilter = this.buildFilter();
    this.page.set(0);
    this.load();
  }

  protected resetFilter(): void {
    this.filterForm.reset({ categoryId: null, city: '', from: '', to: '' });
    this.applyFilter();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected bannerStyle(ev: EventSummary): string | null {
    return ev.bannerUrl ? `url('${ev.bannerUrl}')` : null;
  }

  protected load(): void {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.listRequest = this.api
      .listEvents(this.appliedFilter, { page: this.page(), size: this.size })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: PageResponse<EventSummary>) => {
          this.events.set(res.content);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            this.feedback.problem(error, 'Không thể tải danh sách sự kiện. Vui lòng thử lại.')
              .message,
          );
          this.loading.set(false);
        },
      });
  }

  private buildFilter(): EventFilter {
    const { categoryId, city, from, to } = this.filterForm.getRawValue();
    return {
      categoryId: categoryId ?? undefined,
      city: city.trim() || undefined,
      from: from ? vietnamInstant(from)! : undefined,
      to: to ? vietnamInstant(to)! : undefined,
    };
  }
}

import { LoadingState } from '../../shared/loading-state';
import { FeedbackService } from '../../shared/feedback.service';
import { vietnamInstant } from '../../shared/vietnam-time';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, EMPTY, expand, interval, reduce, Subscription } from 'rxjs';
import { EventSalesStatus } from './event-sales-status';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
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

interface ActiveChip {
  key: 'keyword' | 'categoryId' | 'city' | 'from' | 'to';
  label: string;
}

@Component({
  selector: 'app-events-page',
  imports: [
    LoadingState,
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatIconButton,
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
    EventSalesStatus,
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

    <form class="search-shell" [formGroup]="filterForm" (ngSubmit)="applyNow()">
      <div class="search-row">
        <div class="search-field">
          <app-icon name="search" />
          <input
            type="search"
            formControlName="keyword"
            maxlength="200"
            placeholder="Tìm sự kiện theo tên hoặc mô tả…"
            aria-label="Tìm kiếm sự kiện"
            enterkeyhint="search"
          />
          @if (filterForm.controls.keyword.value) {
            <button
              type="button"
              class="search-clear"
              (click)="clearKeyword()"
              aria-label="Xóa từ khóa"
            >
              ×
            </button>
          }
        </div>
        <button
          type="button"
          class="filter-toggle"
          [class.is-active]="filtersOpen()"
          (click)="toggleFilters()"
          [attr.aria-expanded]="filtersOpen()"
          aria-controls="advanced-filters"
        >
          <app-icon name="list" />
          <span>Bộ lọc</span>
          @if (advancedCount() > 0) {
            <span class="filter-count">{{ advancedCount() }}</span>
          }
        </button>
      </div>

      @if (filtersOpen()) {
        <div class="advanced-filters" id="advanced-filters">
          <p id="event-filter-time-help" class="muted time-help">
            Thời gian lọc nhập theo giờ Việt Nam (UTC+7).
          </p>
          <div class="filter-grid">
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
          </div>
        </div>
      }
    </form>

    @if (filterError()) {
      <p class="form-notice error" role="alert">{{ filterError() }}</p>
    }

    <div class="result-bar" role="status">
      @if (chips().length > 0) {
        <ul class="chip-list" aria-label="Bộ lọc đang áp dụng">
          @for (chip of chips(); track chip.key) {
            <li>
              <button type="button" class="chip" (click)="removeChip(chip.key)">
                <span>{{ chip.label }}</span>
                <span class="chip-x" aria-hidden="true">×</span>
                <span class="sr-only">Gỡ bộ lọc</span>
              </button>
            </li>
          }
          <li>
            <button type="button" class="chip chip-reset" (click)="resetFilter()">
              Xóa tất cả
            </button>
          </li>
        </ul>
      }
      @if (!loading() && !error()) {
        <span class="result-count">{{ resultSummary() }}</span>
      }
    </div>

    @if (loading()) {
      <app-loading-state label="Đang tải sự kiện…" />
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      <button mat-stroked-button type="button" (click)="load()">Thử lại</button>
    } @else if (events().length === 0) {
      <app-empty-state
        icon="calendar"
        title="Không tìm thấy sự kiện"
        [description]="
          chips().length > 0
            ? 'Không có sự kiện khớp bộ lọc hiện tại. Thử xóa bớt tiêu chí hoặc đổi từ khóa.'
            : 'Hiện chưa có sự kiện nào được công bố. Vui lòng quay lại sau.'
        "
      >
        @if (chips().length > 0) {
          <button mat-flat-button type="button" (click)="resetFilter()">Xóa bộ lọc</button>
        }
      </app-empty-state>
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
              <app-event-sales-status [event]="ev" [now]="now()" />
              <dl class="card-dates">
                <div><dt>Diễn ra</dt><dd>{{ ev.startTime | dateTime }}</dd></div>
                <div><dt>Mở bán</dt><dd>{{ ev.salesStartTime | dateTime }}</dd></div>
              </dl>
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
    :host {
      display: block;
      padding-top: 32px;
    }

    /* ---- Search shell ---- */
    .search-shell {
      margin-bottom: 1.25rem;
    }
    .search-row {
      display: flex;
      gap: 12px;
      align-items: stretch;
    }
    .search-field {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0 0.95rem;
      border: 1px solid var(--app-line);
      border-radius: 0.3rem;
      background: var(--app-panel);
      transition: border-color 0.15s ease;
    }
    .search-field:focus-within {
      border-color: var(--app-accent);
      box-shadow: inset 0 0 0 1px var(--app-accent);
    }
    .search-field app-icon {
      color: var(--app-muted);
      font-size: 1.2rem;
    }
    .search-field input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      color: var(--app-ink);
      padding: 0.85rem 0;
      font-size: 1.02rem;
    }
    .search-field input::placeholder {
      color: var(--app-muted);
    }
    .search-field input::-webkit-search-cancel-button {
      appearance: none;
    }
    .search-clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      border: none;
      border-radius: 0.2rem;
      background: var(--app-soft);
      color: var(--app-ink);
      font-size: 1.15rem;
      line-height: 1;
      cursor: pointer;
    }
    .search-clear:hover {
      background: var(--app-ink);
      color: var(--app-inverse);
    }
    .filter-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 1.15rem;
      border: 1px solid var(--app-line);
      border-radius: 0.3rem;
      background: var(--app-panel);
      color: var(--app-ink);
      font-weight: 650;
      white-space: nowrap;
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }
    .filter-toggle:hover {
      border-color: var(--app-ink);
    }
    .filter-toggle.is-active {
      background: var(--app-accent-soft);
      color: var(--app-accent-strong);
      border-color: var(--app-accent);
    }
    .filter-toggle app-icon {
      font-size: 1.05rem;
    }
    .filter-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.35rem;
      height: 1.35rem;
      padding: 0 0.35rem;
      border-radius: 1rem;
      background: var(--app-accent);
      color: var(--app-inverse);
      font-size: 0.75rem;
      font-weight: 700;
    }

    /* ---- Advanced filters ---- */
    .advanced-filters {
      margin-top: 12px;
      padding: 18px;
      border: 1px solid var(--app-line);
      border-top: 2px solid var(--app-accent);
      border-radius: 0.3rem;
      background: var(--app-panel);
      animation: filter-open 0.18s ease;
    }
    .time-help {
      margin: 0 0 0.75rem;
      font-size: 0.82rem;
    }
    .filter-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px 16px;
      align-items: start;
    }
    .filter-grid mat-form-field {
      width: 100%;
    }
    @keyframes filter-open {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ---- Result bar + chips ---- */
    .result-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      min-height: 2.1rem;
      margin-bottom: 1.25rem;
    }
    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.32rem 0.7rem;
      border: 1px solid var(--app-accent-line);
      border-radius: 1.2rem;
      background: var(--app-accent-soft);
      color: var(--app-accent-strong);
      font-size: 0.82rem;
      cursor: pointer;
      transition:
        background 0.15s ease,
        color 0.15s ease;
    }
    .chip:hover {
      background: var(--app-accent);
      color: var(--app-inverse);
      border-color: var(--app-accent);
    }
    .chip-x {
      font-size: 1rem;
      line-height: 1;
    }
    .chip-reset {
      border-style: dashed;
      border-color: var(--app-line);
      background: var(--app-panel);
      color: var(--app-muted);
    }
    .chip-reset:hover {
      background: var(--app-soft);
      color: var(--app-ink);
      border-color: var(--app-ink);
    }
    .result-count {
      margin-left: auto;
      font-size: 0.85rem;
      color: var(--app-muted);
      white-space: nowrap;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ---- Event grid ---- */
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
      overflow-wrap: anywhere;
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

    @media (prefers-reduced-motion: reduce) {
      .event-card {
        transition: none;
      }
      .event-card:hover {
        transform: none;
      }
      .advanced-filters {
        animation: none;
      }
    }
    @media (max-width: 900px) {
      .filter-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .event-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .filter-grid,
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

  protected readonly now = signal(Date.now());
  protected readonly categories = signal<Category[]>([]);
  protected readonly categoryError = signal('');
  protected readonly filterError = signal('');
  protected readonly events = signal<EventSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected readonly filtersOpen = signal(false);

  // Snapshot of raw form values at last successful apply — drives the chips.
  private readonly appliedRaw = signal({
    categoryId: null as number | null,
    city: '',
    keyword: '',
    from: '',
    to: '',
  });

  private readonly size = 12;

  protected readonly filterForm = this.fb.nonNullable.group({
    categoryId: [null as number | null],
    city: [''],
    keyword: [''],
    from: [''],
    to: [''],
  });

  /** Number of applied filters other than the keyword (shown on the toggle badge). */
  protected readonly advancedCount = computed(() => {
    const r = this.appliedRaw();
    return [r.categoryId != null, !!r.city.trim(), !!r.from, !!r.to].filter(Boolean).length;
  });

  protected readonly chips = computed<ActiveChip[]>(() => {
    const r = this.appliedRaw();
    const list: ActiveChip[] = [];
    if (r.keyword.trim()) {
      list.push({ key: 'keyword', label: `“${r.keyword.trim()}”` });
    }
    if (r.categoryId != null) {
      const name = this.categories().find((c) => c.id === r.categoryId)?.name;
      list.push({ key: 'categoryId', label: name ?? 'Danh mục' });
    }
    if (r.city.trim()) {
      list.push({ key: 'city', label: r.city.trim() });
    }
    if (r.from) {
      list.push({ key: 'from', label: `Từ ${this.formatLocal(r.from)}` });
    }
    if (r.to) {
      list.push({ key: 'to', label: `Đến ${this.formatLocal(r.to)}` });
    }
    return list;
  });

  protected readonly resultSummary = computed(() => {
    const total = this.totalElements();
    if (total === 0) {
      return 'Không có kết quả';
    }
    return `${total} sự kiện`;
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
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
            'Không tải được danh mục. Bạn vẫn có thể lọc theo thành phố, từ khóa và thời gian; tải lại trang để thử lại.',
          ),
      });

    // Live filtering: debounce text typing, de-duplicate identical states.
    this.filterForm.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.applyFilter());

    this.load();
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected clearKeyword(): void {
    this.filterForm.controls.keyword.setValue('');
  }

  /** Immediate apply (Enter / submit) that bypasses the debounce. */
  protected applyNow(): void {
    this.applyFilter();
  }

  protected applyFilter(): void {
    this.filterError.set('');
    const raw = this.filterForm.getRawValue();
    const { from, to } = raw;
    if ((from && !vietnamInstant(from)) || (to && !vietnamInstant(to))) {
      this.filterError.set('Vui lòng nhập ngày giờ hợp lệ.');
      return;
    }
    if (from && to && Date.parse(vietnamInstant(from)!) > Date.parse(vietnamInstant(to)!)) {
      this.filterError.set('Thời gian bắt đầu phải trước hoặc bằng thời gian kết thúc.');
      return;
    }
    this.appliedFilter = this.buildFilter();
    this.appliedRaw.set({ ...raw });
    this.page.set(0);
    this.load();
  }

  protected removeChip(key: ActiveChip['key']): void {
    if (key === 'categoryId') {
      this.filterForm.controls.categoryId.setValue(null);
    } else {
      this.filterForm.controls[key].setValue('');
    }
  }

  protected resetFilter(): void {
    this.filterForm.reset({ categoryId: null, city: '', keyword: '', from: '', to: '' });
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
          this.totalElements.set(res.totalElements);
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

  private formatLocal(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private buildFilter(): EventFilter {
    const { categoryId, city, keyword, from, to } = this.filterForm.getRawValue();
    return {
      categoryId: categoryId ?? undefined,
      city: city.trim() || undefined,
      keyword: keyword.trim() || undefined,
      from: from ? vietnamInstant(from)! : undefined,
      to: to ? vietnamInstant(to)! : undefined,
    };
  }
}

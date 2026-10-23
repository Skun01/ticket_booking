import { LoadingState } from '../../shared/loading-state';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { EMPTY, Subscription, expand, finalize, forkJoin, of, reduce, timeout } from 'rxjs';
import { CatalogApi, OrganizerApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { Category, EventItem, EventRequest, Venue } from '../../core/api/models';
import { PageHeader } from '../../shared/page-header';
import { positiveId, uncertainWrite, vietnamDateInput, vietnamInstant } from './organizer-utils';

@Component({
  selector: 'app-organizer-event-form-page',
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
    PageHeader,
  ],
  template: `
    <app-page-header
      [title]="id() ? 'Sửa sự kiện' : 'Tạo sự kiện'"
      subtitle="Lưu bản nháp trước, cấu hình hạng vé rồi mới phát hành."
    >
      <a mat-stroked-button routerLink="/organizer">Sự kiện của tôi</a>
    </app-page-header>
    @if (loading()) {
      <app-loading-state label="Đang tải thông tin và danh mục…" />
    } @else if (loadError()) {
      <p class="form-notice error" role="alert">{{ loadError() }}</p>
      @if (!invalidRoute()) {
        <button mat-stroked-button type="button" (click)="load()">Thử lại</button>
      }
    } @else if (!editable()) {
      <p class="form-notice warning" role="status">
        Chỉ sự kiện ở trạng thái nháp mới được chỉnh sửa.
      </p>
      <a mat-stroked-button [routerLink]="['/organizer/events', id()]">Về quản lý sự kiện</a>
    } @else if (!categories().length || !venues().length) {
      <p class="form-notice warning" role="status">
        Chưa có danh mục hoặc địa điểm để chọn. Vui lòng nhờ quản trị viên bổ sung dữ liệu.
      </p>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="panel event-form">
        <h2>Thông tin sự kiện</h2>
        <mat-form-field appearance="outline" class="wide">
          <mat-label>Tiêu đề</mat-label>
          <input matInput formControlName="title" maxlength="200" required />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Danh mục</mat-label>
          <mat-select formControlName="categoryId" required>
            @for (category of categories(); track category.id) {
              <mat-option [value]="category.id">{{ category.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Địa điểm</mat-label>
          <mat-select formControlName="venueId" required>
            @for (venue of venues(); track venue.id) {
              <mat-option [value]="venue.id"
                >{{ venue.name }} - {{ venue.city }} ({{ venue.capacity }} chỗ)</mat-option
              >
            }
          </mat-select>
        </mat-form-field>
        <p class="muted wide">
          Nhập thời gian theo giờ Việt Nam (UTC+7), kể cả khi bạn đang ở múi giờ khác.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Bắt đầu (giờ Việt Nam)</mat-label>
          <input matInput type="datetime-local" step="1" formControlName="startTime" required />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Kết thúc (giờ Việt Nam)</mat-label>
          <input matInput type="datetime-local" step="1" formControlName="endTime" required />
        </mat-form-field>
        <mat-form-field appearance="outline" class="wide">
          <mat-label>URL banner (không bắt buộc)</mat-label>
          <input
            matInput
            type="url"
            formControlName="bannerUrl"
            maxlength="500"
            placeholder="https://..."
          />
        </mat-form-field>
        <mat-form-field appearance="outline" class="wide">
          <mat-label>Mô tả (không bắt buộc)</mat-label>
          <textarea matInput formControlName="description" maxlength="15000" rows="7"></textarea>
        </mat-form-field>
        @if (error()) {
          <p class="form-notice error wide" role="alert">{{ error() }}</p>
        }
        @if (fieldErrors().length) {
          <ul class="wide" aria-label="Lỗi dữ liệu từ máy chủ">
            @for (err of fieldErrors(); track err.field) {
              <li>{{ err.field }}: {{ err.message }}</li>
            }
          </ul>
        }
        @if (uncertain()) {
          <div class="wide form-notice warning" role="status">
            <p>
              Chưa xác nhận được kết quả lưu. Kiểm tra sự kiện trước khi gửi lại để tránh tạo trùng
              hoặc ghi đè dữ liệu.
            </p>
            <a [routerLink]="id() ? ['/organizer/events', id()] : ['/organizer']"
              >Kiểm tra sự kiện đã lưu</a
            >
          </div>
        }
        <div class="wide form-actions">
          <button
            mat-flat-button
            type="submit"
            [disabled]="busy() || uncertain()"
            [attr.aria-busy]="busy()"
          >
            {{ busy() ? 'Đang lưu…' : 'Lưu bản nháp' }}
          </button>
          <a mat-stroked-button routerLink="/organizer">Quay lại</a>
        </div>
      </form>
    }
  `,
  styles: `
    .event-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 20px;
    }
    .wide,
    .event-form h2 {
      grid-column: 1 / -1;
    }
    .event-form mat-form-field {
      width: 100%;
      min-width: 0;
    }
    @media (max-width: 768px) {
      .event-form {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class OrganizerEventFormPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(OrganizerApi);
  private readonly catalog = inject(CatalogApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readRequest?: Subscription;
  private saveRequest?: Subscription;
  protected readonly id = signal<number | null>(null);
  protected readonly event = signal<EventItem | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly venues = signal<Venue[]>([]);
  protected readonly loading = signal(true);
  protected readonly invalidRoute = signal(false);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly uncertain = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<{ field: string; message: string }[]>([]);
  protected readonly editable = computed(() => !this.id() || this.event()?.status === 'DRAFT');
  protected readonly form = this.fb.nonNullable.group({
    title: [''],
    categoryId: [null as number | null],
    venueId: [null as number | null],
    startTime: [''],
    endTime: [''],
    bannerUrl: [''],
    description: [''],
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.readRequest?.unsubscribe();
      this.saveRequest?.unsubscribe();
      this.id.set(positiveId(params.get('id')));
      this.invalidRoute.set(params.has('id') && !this.id());
      if (this.invalidRoute()) {
        this.loading.set(false);
        this.loadError.set('Đường dẫn sự kiện không hợp lệ.');
        return;
      }
      this.load();
    });
  }

  protected load(): void {
    if (this.busy() || this.invalidRoute()) return;
    this.readRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.uncertain.set(false);
    const categories = this.catalog.listCategories({ size: 100 }).pipe(
      expand((res) =>
        res.page + 1 < res.totalPages
          ? this.catalog.listCategories({ page: res.page + 1, size: 100 })
          : EMPTY,
      ),
      reduce((all, res) => all.concat(res.content), [] as Category[]),
    );
    const venues = this.catalog.listVenues({ size: 100 }).pipe(
      expand((res) =>
        res.page + 1 < res.totalPages
          ? this.catalog.listVenues({ page: res.page + 1, size: 100 })
          : EMPTY,
      ),
      reduce((all, res) => all.concat(res.content), [] as Venue[]),
    );
    const id = this.id();
    this.readRequest = forkJoin({
      categories,
      venues,
      event: id ? this.api.getEvent(id) : of(null),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ categories, venues, event }) => {
          this.categories.set(categories);
          this.venues.set(venues);
          this.event.set(event);
          this.form.reset(
            event
              ? {
                  title: event.title,
                  categoryId: event.category.id,
                  venueId: event.venue.id,
                  startTime: vietnamDateInput(event.startTime),
                  endTime: vietnamDateInput(event.endTime),
                  description: event.description ?? '',
                  bannerUrl: event.bannerUrl ?? '',
                }
              : {
                  title: '',
                  categoryId: null,
                  venueId: null,
                  startTime: '',
                  endTime: '',
                  description: '',
                  bannerUrl: '',
                },
          );
        },
        error: (error) =>
          this.loadError.set(
            this.feedback.problem(error, 'Không tải được dữ liệu form. Vui lòng thử lại.').message,
          ),
      });
  }

  protected save(): void {
    if (this.busy() || this.uncertain() || !this.editable()) return;
    this.error.set('');
    this.fieldErrors.set([]);
    const value = this.form.getRawValue();
    const start = vietnamInstant(value.startTime),
      end = vietnamInstant(value.endTime);
    if (!value.title.trim() || value.title.trim().length > 200) {
      this.error.set('Nhập tiêu đề từ 1 đến 200 ký tự.');
      return;
    }
    if (
      !this.categories().some((c) => c.id === value.categoryId) ||
      !this.venues().some((v) => v.id === value.venueId)
    ) {
      this.error.set('Vui lòng chọn danh mục và địa điểm hợp lệ.');
      return;
    }
    if (!start || !end || Date.parse(start) <= Date.now() || Date.parse(end) <= Date.parse(start)) {
      this.error.set('Giờ bắt đầu phải ở tương lai, giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    if (value.description.length > 15000 || value.bannerUrl.trim().length > 500) {
      this.error.set('Mô tả tối đa 15.000 ký tự, URL banner tối đa 500 ký tự.');
      return;
    }
    if (value.bannerUrl.trim()) {
      try {
        const url = new URL(value.bannerUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        this.error.set('Banner phải là URL http hoặc https hợp lệ.');
        return;
      }
    }
    const request: EventRequest = {
      categoryId: value.categoryId!,
      venueId: value.venueId!,
      title: value.title.trim(),
      description: value.description || null,
      bannerUrl: value.bannerUrl.trim() || null,
      startTime: start,
      endTime: end,
    };
    const id = this.id();
    this.busy.set(true);
    this.form.disable({ emitEvent: false });
    this.saveRequest = (id ? this.api.updateEvent(id, request) : this.api.createEvent(request))
      .pipe(
        timeout(20000),
        finalize(() => {
          this.busy.set(false);
          this.form.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (event) => {
          this.feedback.success(id ? 'Đã lưu thay đổi sự kiện.' : 'Đã tạo bản nháp sự kiện.');
          this.uncertain.set(true);
          void this.router.navigate(['/organizer/events', event.id]);
        },
        error: (error) => {
          const problem = this.feedback.problem(
            error,
            'Không lưu được sự kiện. Vui lòng kiểm tra lại.',
          );
          this.error.set(problem.message);
          this.fieldErrors.set(
            Object.entries(problem.fields).map(([field, message]) => ({ field, message })),
          );
          this.uncertain.set(
            uncertainWrite(error) || (error instanceof HttpErrorResponse && error.status === 409),
          );
        },
      });
  }
}

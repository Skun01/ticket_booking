import { FocusOnShow } from '../../shared/focus-on-show';
import { LoadingState } from '../../shared/loading-state.component';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Observable, Subscription, distinctUntilChanged, finalize, map, timeout } from 'rxjs';
import { AdminApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { PageResponse } from '../../core/api/models';
import { EmptyState } from '../../shared/empty-state.component';
import { PageHeader } from '../../shared/page-header.component';
import { Paginator } from '../../shared/paginator.component';

// Hai catalog cùng vòng đời CRUD; trường riêng vẫn được validate theo từng DTO.
interface CatalogRow {
  id: number;
  name: string;
  slug?: string;
  address?: string;
  city?: string;
  capacity?: number;
}
type CatalogKind = 'categories' | 'venues';

@Component({
  selector: 'app-admin-catalog-page',
  imports: [
    FocusOnShow,
    LoadingState,
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    EmptyState,
    PageHeader,
    Paginator,
  ],
  templateUrl: './admin-catalog-page.component.html',
  
  styles: `
    .panel {
      overflow-wrap: anywhere;
    }
    .editor form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 20px;
    }
    .wide {
      grid-column: 1 / -1;
    }
    mat-form-field {
      width: 100%;
      min-width: 0;
    }
    .count,
    .loading {
      margin-top: 24px;
    }
    .table-scroll {
      overflow-x: auto;
      max-width: 100%;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      min-width: 520px;
      text-align: left;
    }
    th,
    td {
      padding: 16px 12px;
      border-bottom: 1px solid var(--app-line);
      overflow-wrap: anywhere;
      max-width: 260px;
    }
    thead {
      background: var(--app-soft);
    }
    .row-actions {
      display: flex;
      gap: 8px;
    }
    @media (max-width: 768px) {
      .editor form {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AdminCatalogPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(AdminApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private listGeneration = 0;
  private listRequest?: Subscription;
  private detailRequest?: Subscription;
  private writeRequest?: Subscription;
  protected readonly kind = signal<CatalogKind>('categories');
  protected readonly isCategory = computed(() => this.kind() === 'categories');
  protected readonly rows = signal<CatalogRow[]>([]);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly busy = signal(false);
  protected readonly mustRefresh = signal(false);
  protected readonly error = signal('');
  protected readonly listError = signal('');
  protected readonly notice = signal('');
  protected readonly editorOpen = signal(false);
  protected readonly editId = signal<number | null>(null);
  protected readonly confirmDelete = signal<CatalogRow | null>(null);
  protected readonly fieldErrors = signal<{ field: string; message: string }[]>([]);
  protected readonly blocked = computed(
    () => this.loading() || this.detailLoading() || this.busy() || this.mustRefresh(),
  );
  protected readonly form = this.fb.nonNullable.group({
    name: [''],
    slug: [''],
    address: [''],
    city: [''],
    capacity: [null as number | null],
  });

  constructor() {
    this.route.data
      .pipe(
        map((data) => data['catalog'] as CatalogKind),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((kind) => {
        this.listRequest?.unsubscribe();
        this.detailRequest?.unsubscribe();
        this.writeRequest?.unsubscribe();
        this.kind.set(kind);
        this.rows.set([]);
        this.mustRefresh.set(false);
        this.notice.set('');
        this.error.set('');
        this.closeEditor();
        this.confirmDelete.set(null);
        this.load(0);
      });
  }

  protected reload(): void {
    if (this.busy() || this.detailLoading()) return;
    this.closeEditor();
    this.confirmDelete.set(null);
    this.error.set('');
    this.load(this.page());
  }

  protected load(page: number): void {
    if (this.busy() || this.detailLoading()) return;
    const generation = ++this.listGeneration;
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.listError.set('');
    this.page.set(page);
    const request: Observable<PageResponse<CatalogRow>> = this.isCategory()
      ? this.api.listCategories({ page, size: 12 })
      : this.api.listVenues({ page, size: 12 });
    this.listRequest = request
      .pipe(
        timeout(20000),
        finalize(() => {
          if (generation === this.listGeneration) this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (page > 0 && page >= result.totalPages) {
            this.load(Math.max(0, result.totalPages - 1));
            return;
          }
          this.rows.set(result.content);
          this.page.set(result.page);
          this.totalPages.set(result.totalPages);
          this.total.set(result.totalElements);
          this.mustRefresh.set(false);
        },
        error: (error) => {
          this.listError.set(
            this.feedback.problem(error, 'Không tải được danh sách. Vui lòng thử lại.').message,
          );
          this.mustRefresh.set(true);
        },
      });
  }

  protected create(): void {
    if (this.blocked()) return;
    this.closeEditor();
    this.confirmDelete.set(null);
    this.error.set('');
    this.notice.set('');
    this.editorOpen.set(true);
    this.focusEditor();
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editId.set(null);
    this.fieldErrors.set([]);
    this.form.reset({ name: '', slug: '', address: '', city: '', capacity: null });
  }

  protected edit(item: CatalogRow): void {
    if (this.blocked()) return;
    this.closeEditor();
    this.confirmDelete.set(null);
    this.error.set('');
    this.notice.set('');
    this.detailLoading.set(true);
    const request: Observable<CatalogRow> = this.isCategory()
      ? this.api.getCategory(item.id)
      : this.api.getVenue(item.id);
    this.detailRequest = request
      .pipe(
        timeout(20000),
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (row) => {
          this.editId.set(row.id);
          this.form.reset({
            name: row.name,
            slug: row.slug ?? '',
            address: row.address ?? '',
            city: row.city ?? '',
            capacity: row.capacity ?? null,
          });
          this.editorOpen.set(true);
          this.focusEditor();
        },
        error: (error) => {
          this.error.set(
            this.feedback.problem(error, 'Không tải được dữ liệu để chỉnh sửa.').message,
          );
          this.mustRefresh.set(true);
        },
      });
  }

  protected askDelete(item: CatalogRow): void {
    if (this.blocked()) return;
    this.closeEditor();
    this.error.set('');
    this.notice.set('');
    this.confirmDelete.set(item);
  }

  protected save(): void {
    if (this.blocked() || !this.editorOpen()) return;
    this.error.set('');
    this.fieldErrors.set([]);
    const value = this.form.getRawValue(),
      name = value.name.trim();
    const max = this.isCategory() ? 100 : 150;
    if (!name || value.name.length > max) {
      this.error.set(`Tên phải từ 1 đến ${max} ký tự, không chỉ gồm khoảng trắng.`);
      return;
    }
    const id = this.editId();
    let request: Observable<CatalogRow>;
    if (this.isCategory()) {
      const slug = value.slug.trim();
      if (!slug || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        this.error.set(
          'Slug tối đa 120 ký tự, chỉ gồm chữ thường, số và dấu gạch nối giữa các phần.',
        );
        return;
      }
      request = id
        ? this.api.updateCategory(id, { name, slug })
        : this.api.createCategory({ name, slug });
    } else {
      const address = value.address.trim(),
        city = value.city.trim(),
        capacity = value.capacity;
      if (!address || value.address.length > 255 || !city || value.city.length > 100) {
        this.error.set('Nhập địa chỉ (tối đa 255 ký tự) và thành phố (tối đa 100 ký tự).');
        return;
      }
      if (
        capacity === null ||
        !Number.isInteger(capacity) ||
        capacity < 1 ||
        capacity > 2147483647
      ) {
        this.error.set('Sức chứa phải là số nguyên từ 1 đến 2.147.483.647.');
        return;
      }
      request = id
        ? this.api.updateVenue(id, { name, address, city, capacity })
        : this.api.createVenue({ name, address, city, capacity });
    }
    this.busy.set(true);
    this.form.disable({ emitEvent: false });
    this.writeRequest = request
      .pipe(
        timeout(20000),
        finalize(() => {
          this.busy.set(false);
          this.form.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closeEditor();
          this.notice.set(id ? 'Đã cập nhật dữ liệu.' : 'Đã tạo dữ liệu mới.');
          this.feedback.success(this.notice());
          this.load(id ? this.page() : 0);
        },
        error: (error) => this.writeError(error),
      });
  }

  protected remove(): void {
    const item = this.confirmDelete();
    if (!item || this.blocked()) return;
    this.busy.set(true);
    this.error.set('');
    const request = this.isCategory()
      ? this.api.deleteCategory(item.id)
      : this.api.deleteVenue(item.id);
    this.writeRequest = request
      .pipe(
        timeout(20000),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.confirmDelete.set(null);
          this.notice.set('Đã xóa dữ liệu.');
          this.feedback.success(this.notice());
          this.load(this.page());
        },
        error: (error) => this.writeError(error),
      });
  }

  private focusEditor(): void {
    afterNextRender(
      () => {
        if (!this.destroyRef.destroyed) this.nameInput()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  private writeError(error: unknown): void {
    const problem = this.feedback.problem(
      error,
      'Không xác nhận được kết quả lưu/xóa. Vui lòng kiểm tra lại.',
    );
    this.error.set(problem.message);
    this.fieldErrors.set(
      Object.entries(problem.fields).map(([field, message]) => ({ field, message })),
    );
    if (
      !(error instanceof HttpErrorResponse) ||
      error.status === 0 ||
      error.status >= 500 ||
      error.status === 404
    )
      this.mustRefresh.set(true);
  }
}

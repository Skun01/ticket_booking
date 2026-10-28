import { FocusOnShow } from '../../shared/focus-on-show';
import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { finalize, timeout } from 'rxjs';
import { OrganizerApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { EventItem, TicketType, TicketTypeRequest } from '../../core/api/models';
import { uncertainWrite } from './organizer-utils';

@Component({
  selector: 'app-ticket-type-editor',
  imports: [FocusOnShow, ReactiveFormsModule, MatButton, MatFormField, MatLabel, MatInput],
  template: `
    <section class="panel" appFocusOnShow aria-labelledby="ticket-editor-title">
      <h2 id="ticket-editor-title">{{ ticketType() ? 'Sửa hạng vé' : 'Thêm hạng vé' }}</h2>
      <p class="muted">
        Tổng số vé mọi hạng không được vượt {{ event().venue.capacity }} chỗ của địa điểm.
      </p>
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <mat-form-field appearance="outline" class="wide">
          <mat-label>Tên hạng vé</mat-label>
          <input matInput formControlName="name" maxlength="100" required />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Giá vé (VND)</mat-label>
          <input
            matInput
            type="text"
            inputmode="decimal"
            formControlName="price"
            maxlength="13"
            required
            aria-describedby="price-help"
          />
        </mat-form-field>
        <p id="price-help" class="muted">
          Dùng dấu chấm cho phần thập phân, tối đa 2 chữ số. Nhập 0 cho vé miễn phí.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Tổng số vé</mat-label>
          <input
            matInput
            type="number"
            formControlName="totalQuantity"
            min="1"
            max="2147483647"
            step="1"
            required
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Tối đa mỗi đơn</mat-label>
          <input
            matInput
            type="number"
            formControlName="maxPerOrder"
            min="1"
            max="2147483647"
            step="1"
            required
          />
        </mat-form-field>
        @if (error()) {
          <p class="form-notice error wide" role="alert">{{ error() }}</p>
        }
        @if (fieldErrors().length) {
          <ul class="wide">
            @for (err of fieldErrors(); track err.field) {
              <li>{{ err.field }}: {{ err.message }}</li>
            }
          </ul>
        }
        @if (uncertain()) {
          <p class="form-notice warning wide" role="status">
            Chưa xác nhận được kết quả lưu. Hãy cập nhật lại trang quản lý trước khi gửi thêm để
            tránh tạo hạng vé trùng.
          </p>
        }
        <div class="wide form-actions">
          <button
            mat-flat-button
            type="submit"
            [disabled]="busy() || uncertain()"
            [attr.aria-busy]="busy()"
          >
            {{ busy() ? 'Đang lưu…' : 'Lưu hạng vé' }}
          </button>
          <button mat-stroked-button type="button" (click)="closed.emit()" [disabled]="busy()">
            Đóng form
          </button>
        </div>
      </form>
    </section>
  `,
  styles: `
    form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 20px;
    }
    mat-form-field {
      width: 100%;
      min-width: 0;
    }
    .wide {
      grid-column: 1 / -1;
    }
    @media (max-width: 768px) {
      form {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class TicketTypeEditor {
  private readonly feedback = inject(FeedbackService);
  readonly event = input.required<EventItem>();
  readonly ticketType = input<TicketType | null>(null);
  readonly allTypes = input.required<TicketType[]>();
  readonly saved = output<TicketType>();
  readonly closed = output<void>();
  readonly busyChange = output<boolean>();
  readonly refreshRequired = output<void>();
  private readonly api = inject(OrganizerApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  protected readonly busy = signal(false);
  protected readonly uncertain = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<{ field: string; message: string }[]>([]);
  protected readonly form = this.fb.nonNullable.group({
    name: [''],
    price: ['0'],
    totalQuantity: [null as number | null],
    maxPerOrder: [1 as number | null],
  });

  constructor() {
    effect(() => {
      const tt = this.ticketType();
      this.error.set('');
      this.uncertain.set(false);
      this.fieldErrors.set([]);
      this.form.reset({
        name: tt?.name ?? '',
        price: String(tt?.price ?? 0),
        totalQuantity: tt?.totalQuantity ?? null,
        maxPerOrder: tt?.maxPerOrder ?? 1,
      });
    });
  }

  protected save(): void {
    if (this.busy() || this.uncertain() || this.event().status !== 'DRAFT') return;
    this.error.set('');
    this.fieldErrors.set([]);
    const value = this.form.getRawValue(),
      tt = this.ticketType(),
      ev = this.event();
    const total = value.totalQuantity,
      max = value.maxPerOrder;
    if (!value.name.trim() || value.name.trim().length > 100) {
      this.error.set('Tên hạng vé phải từ 1 đến 100 ký tự.');
      return;
    }
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.price.trim())) {
      this.error.set('Giá phải không âm, tối đa 10 chữ số nguyên và 2 chữ số thập phân.');
      return;
    }
    if (
      total === null ||
      max === null ||
      !Number.isInteger(total) ||
      !Number.isInteger(max) ||
      total < 1 ||
      max < 1 ||
      total > 2147483647 ||
      max > total
    ) {
      this.error.set(
        'Tổng vé và giới hạn mỗi đơn phải là số nguyên dương; giới hạn mỗi đơn không vượt tổng vé.',
      );
      return;
    }
    if (tt && total < tt.soldQuantity) {
      this.error.set('Tổng vé không được thấp hơn lượng đã bán hoặc đang giữ chỗ.');
      return;
    }
    const other = this.allTypes()
      .filter((t) => t.id !== tt?.id)
      .reduce((sum, t) => sum + t.totalQuantity, 0);
    if (total + other > ev.venue.capacity) {
      this.error.set('Tổng số vé của các hạng vượt sức chứa địa điểm.');
      return;
    }
    const request: TicketTypeRequest = {
      name: value.name.trim(),
      price: Number(value.price),
      totalQuantity: total,
      maxPerOrder: max,
    };
    this.busy.set(true);
    this.busyChange.emit(true);
    this.form.disable({ emitEvent: false });
    (tt ? this.api.updateTicketType(tt.id, request) : this.api.createTicketType(ev.id, request))
      .pipe(
        timeout(20000),
        finalize(() => {
          this.busy.set(false);
          this.form.enable({ emitEvent: false });
          if (!this.destroyRef.destroyed) this.busyChange.emit(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.uncertain.set(true);
          this.saved.emit(result);
        },
        error: (error) => {
          const problem = this.feedback.problem(
            error,
            'Không lưu được hạng vé. Vui lòng kiểm tra lại.',
          );
          this.error.set(problem.message);
          this.fieldErrors.set(
            Object.entries(problem.fields).map(([field, message]) => ({ field, message })),
          );
          // Sau mọi lỗi cần đọc lại cấu hình/trạng thái để tránh ghi lên dữ liệu cũ.
          this.uncertain.set(true);
          this.refreshRequired.emit();
          if (uncertainWrite(error))
            this.error.set(`${problem.message} Kết quả thao tác chưa được xác nhận.`);
        },
      });
  }
}

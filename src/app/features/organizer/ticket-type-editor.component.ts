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
  templateUrl: './ticket-type-editor.component.html',
  
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

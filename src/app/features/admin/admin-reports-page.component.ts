import { DateTimePicker } from '../../shared/date-time-picker.directive';
import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Subscription, finalize, timeout } from 'rxjs';
import { AdminApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { RevenueReport } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header.component';
import { RevenueChart } from '../../shared/revenue-chart.component';
import { recentRevenueRange, vietnamDateInput, vietnamInstant } from '../../shared/vietnam-time';

@Component({
  selector: 'app-admin-reports-page',
  imports: [
    LoadingState,
    DateTimePicker,
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    DateTimePipe,
    MoneyPipe,
    PageHeader,
    RevenueChart,
  ],
  templateUrl: './admin-reports-page.component.html',
  
  styles: `
    .range-panel {
      margin-top: 0;
    }
    form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 20px;
    }
    mat-form-field {
      width: 100%;
      min-width: 0;
    }
    form .form-actions {
      grid-column: 1 / -1;
      margin-top: 0;
    }
    .report-content,
    .loading {
      margin-top: 32px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
      padding: 24px 0;
      border-top: 1px solid var(--app-line);
    }
    .metrics span,
    .metrics strong {
      display: block;
    }
    .metrics span {
      color: var(--app-muted);
    }
    .metrics strong {
      font-size: 1.6rem;
      overflow-wrap: anywhere;
    }
    .panel {
      min-width: 0;
    }
    .table-scroll {
      overflow-x: auto;
      max-width: 100%;
      margin-top: 20px;
    }
    table {
      width: 100%;
      min-width: 460px;
      border-collapse: collapse;
      text-align: left;
    }
    th,
    td {
      border-bottom: 1px solid var(--app-line);
      padding: 12px;
      max-width: 360px;
      overflow-wrap: anywhere;
    }
    small {
      display: block;
      font-weight: normal;
    }
    @media (max-width: 768px) {
      form,
      .metrics {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AdminReportsPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(AdminApi);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private requestedRange = recentRevenueRange();
  protected readonly loading = signal(true);
  protected readonly report = signal<RevenueReport | null>(null);
  protected readonly error = signal('');
  protected readonly rangeError = signal('');
  protected readonly form = this.fb.nonNullable.group({
    from: [vietnamDateInput(this.requestedRange.from)],
    to: [vietnamDateInput(this.requestedRange.to)],
  });

  constructor() {
    this.load();
  }

  protected apply(): void {
    this.rangeError.set('');
    const value = this.form.getRawValue();
    const from = vietnamInstant(value.from),
      to = vietnamInstant(value.to);
    if (!from || !to || Date.parse(from) >= Date.parse(to)) {
      this.rangeError.set(
        'Nhập đủ ngày giờ hợp lệ; thời điểm bắt đầu phải trước thời điểm kết thúc.',
      );
      return;
    }
    this.requestedRange = { from, to };
    this.load();
  }

  protected resetRange(): void {
    this.requestedRange = recentRevenueRange();
    this.form.reset({
      from: vietnamDateInput(this.requestedRange.from),
      to: vietnamDateInput(this.requestedRange.to),
    });
    this.rangeError.set('');
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.report.set(null);
    this.request = this.api
      .revenueReport(this.requestedRange.from, this.requestedRange.to)
      .pipe(
        timeout(30000),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (report) =>
          this.report.set({
            ...report,
            dailyRevenue: [...report.dailyRevenue].sort((a, b) => a.date.localeCompare(b.date)),
          }),
        error: (error) =>
          this.error.set(
            this.feedback.problem(error, 'Không tải được báo cáo doanh thu. Vui lòng thử lại.')
              .message,
          ),
      });
  }
}

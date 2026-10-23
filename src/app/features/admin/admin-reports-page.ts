import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Subscription, finalize, timeout } from 'rxjs';
import { AdminApi } from '../../core/api/catalog.api';
import { apiError } from '../../core/api/api-error';
import { RevenueReport } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { RevenueChart } from '../../shared/revenue-chart';
import { recentRevenueRange, vietnamDateInput, vietnamInstant } from '../../shared/vietnam-time';

@Component({
  selector: 'app-admin-reports-page',
  imports: [
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
  template: `
    <app-page-header
      title="Báo cáo doanh thu"
      subtitle="Doanh thu toàn hệ thống từ các đơn đã thanh toán."
    />
    <section class="panel range-panel" aria-labelledby="range-title">
      <h2 id="range-title">Khoảng thời gian</h2>
      <p id="range-help" class="muted">
        Nhập giờ Việt Nam (UTC+7). Tính từ thời điểm bắt đầu, không bao gồm thời điểm kết thúc. Muốn
        xem trọn một ngày, chọn từ 00:00 ngày đó đến 00:00 ngày kế tiếp.
      </p>
      <form [formGroup]="form" (ngSubmit)="apply()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Từ thời điểm</mat-label>
          <input
            matInput
            type="datetime-local"
            step="1"
            formControlName="from"
            required
            aria-describedby="range-help"
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Đến thời điểm (không gồm)</mat-label>
          <input
            matInput
            type="datetime-local"
            step="1"
            formControlName="to"
            required
            aria-describedby="range-help"
          />
        </mat-form-field>
        <div class="form-actions">
          <button mat-flat-button type="submit">Xem báo cáo</button>
          <button mat-stroked-button type="button" (click)="resetRange()">30 ngày gần nhất</button>
        </div>
      </form>
      @if (rangeError()) {
        <p class="form-notice error" role="alert">{{ rangeError() }}</p>
      }
    </section>
    @if (loading()) {
      <p class="loading" role="status">Đang tổng hợp báo cáo…</p>
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      <button mat-stroked-button type="button" (click)="retry()">Thử lại khoảng vừa yêu cầu</button>
    } @else if (report(); as report) {
      <section class="report-content" aria-labelledby="report-title">
        <h2 id="report-title">Kết quả báo cáo</h2>
        <p class="muted">
          Từ {{ report.from | dateTime }} đến trước {{ report.to | dateTime }} (giờ Việt Nam).
        </p>
        <div class="metrics" aria-label="Tổng doanh thu trong khoảng">
          <div>
            <span>Đơn đã thanh toán</span><strong>{{ report.paidOrders }}</strong>
          </div>
          <div>
            <span>Doanh thu</span><strong>{{ report.revenue | money }}</strong>
          </div>
        </div>
        <section class="panel" aria-labelledby="daily-title">
          <h2 id="daily-title">Doanh thu theo ngày</h2>
          <p class="muted">
            Ngày và các giá trị do backend tổng hợp. Không tính đơn đang giữ chỗ, đã hủy hoặc hết
            hạn; chỉ vẽ những ngày backend trả về dữ liệu.
          </p>
          @if (report.dailyRevenue.length) {
            <app-revenue-chart [rows]="report.dailyRevenue" />
            <div
              class="table-scroll"
              role="region"
              tabindex="0"
              aria-label="Bảng doanh thu theo ngày"
            >
              <table>
                <caption class="visually-hidden">
                  Số đơn và doanh thu theo ngày trong khoảng báo cáo
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Ngày</th>
                    <th scope="col">Đơn đã thanh toán</th>
                    <th scope="col">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of report.dailyRevenue; track row.date) {
                    <tr>
                      <th scope="row">{{ row.date }}</th>
                      <td>{{ row.paidOrders }}</td>
                      <td>{{ row.revenue | money }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p>Chưa có doanh thu theo ngày trong khoảng đã chọn.</p>
          }
        </section>
        <section class="panel" aria-labelledby="top-title">
          <h2 id="top-title">Top sự kiện</h2>
          <p class="muted">
            Theo thứ tự backend trả về: nhiều vé đã bán trước, sau đó doanh thu. Tối đa 10 sự kiện
            trong cùng khoảng thời gian.
          </p>
          @if (report.topEvents.length) {
            <div class="table-scroll" role="region" tabindex="0" aria-label="Bảng top sự kiện">
              <table>
                <caption class="visually-hidden">
                  Top sự kiện theo vé đã bán và doanh thu
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Hạng</th>
                    <th scope="col">Sự kiện</th>
                    <th scope="col">Vé đã bán</th>
                    <th scope="col">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  @for (event of report.topEvents; track event.eventId; let rank = $index) {
                    <tr>
                      <td>{{ rank + 1 }}</td>
                      <th scope="row">
                        {{ event.eventTitle }}<small class="muted">ID {{ event.eventId }}</small>
                      </th>
                      <td>{{ event.ticketsSold }}</td>
                      <td>{{ event.revenue | money }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p>Chưa có sự kiện phát sinh doanh thu trong khoảng đã chọn.</p>
          }
        </section>
      </section>
    }
  `,
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
            apiError(error, 'Không tải được báo cáo doanh thu. Vui lòng thử lại.').message,
          ),
      });
  }
}

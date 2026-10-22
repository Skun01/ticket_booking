import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { Subscription, distinctUntilChanged, finalize, map, timeout } from 'rxjs';
import { OrganizerApi } from '../../core/api/catalog.api';
import { apiError } from '../../core/api/api-error';
import { EventReport } from '../../core/api/models';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { RevenueChart } from '../../shared/revenue-chart';
import { saveBlob } from '../../shared/download-file';
import { positiveId } from './organizer-utils';

@Component({
  selector: 'app-organizer-event-report-page',
  imports: [RouterLink, MatButton, MoneyPipe, PageHeader, RevenueChart],
  template: `
    <app-page-header
      title="Báo cáo sự kiện"
      subtitle="Tổng hợp doanh thu và vé bán từ các đơn đã thanh toán."
    >
      <a mat-stroked-button routerLink="/organizer">Sự kiện của tôi</a>
      @if (id()) {
        <a mat-stroked-button [routerLink]="['/organizer/events', id()]">Quản lý sự kiện</a>
      }
    </app-page-header>
    @if (loading()) {
      <p role="status">Đang tải báo cáo…</p>
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      @if (id()) {
        <button mat-stroked-button type="button" (click)="load()">Thử lại</button>
      }
    } @else if (report(); as report) {
      <h2>{{ report.eventTitle }}</h2>
      <div class="metrics" aria-label="Chỉ số sự kiện">
        <div>
          <span>Đơn đã thanh toán</span><strong>{{ report.paidOrders }}</strong>
        </div>
        <div>
          <span>Vé đã bán</span><strong>{{ report.ticketsSold }}</strong>
        </div>
        <div>
          <span>Doanh thu</span><strong>{{ report.revenue | money }}</strong>
        </div>
      </div>
      <p class="muted">
        Không tính đơn đang giữ chỗ, đơn đã hủy hoặc hết hạn. Biểu đồ hiển thị các ngày backend có
        dữ liệu doanh thu.
      </p>
      @if (downloadError()) {
        <p class="form-notice error" role="alert">{{ downloadError() }}</p>
      }
      @if (notice()) {
        <p class="form-notice" role="status">{{ notice() }}</p>
      }
      <div class="form-actions">
        <button
          mat-flat-button
          type="button"
          (click)="download()"
          [disabled]="downloading()"
          [attr.aria-busy]="downloading()"
        >
          {{ downloading() ? 'Đang tải…' : 'Tải báo cáo PDF' }}
        </button>
        <button mat-stroked-button type="button" (click)="load()" [disabled]="downloading()">
          Cập nhật báo cáo
        </button>
      </div>
      <section class="panel" aria-labelledby="daily-title">
        <h2 id="daily-title">Doanh thu theo ngày</h2>
        @if (report.dailyRevenue.length) {
          <app-revenue-chart [rows]="report.dailyRevenue" />
          <div
            class="table-scroll"
            tabindex="0"
            role="region"
            aria-label="Bảng doanh thu theo ngày"
          >
            <table>
              <caption class="visually-hidden">
                Dữ liệu doanh thu theo ngày của sự kiện
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
          <p class="muted">
            Chưa có dữ liệu doanh thu theo ngày. Số liệu sẽ xuất hiện khi có đơn được thanh toán.
          </p>
        }
      </section>
    }
  `,
  styles: `
    h2 {
      overflow-wrap: anywhere;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
      font-size: clamp(1.2rem, 2vw, 1.8rem);
      overflow-wrap: anywhere;
    }
    .panel {
      min-width: 0;
    }
    .table-scroll {
      overflow-x: auto;
      margin-top: 24px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      text-align: left;
      min-width: 400px;
    }
    th,
    td {
      padding: 12px;
      border-bottom: 1px solid var(--app-line);
    }
    @media (max-width: 768px) {
      .metrics {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }
  `,
})
export class OrganizerEventReportPage {
  private readonly api = inject(OrganizerApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readRequest?: Subscription;
  private downloadRequest?: Subscription;
  private downloadAttempt = 0;
  protected readonly id = signal<number | null>(null);
  protected readonly report = signal<EventReport | null>(null);
  protected readonly loading = signal(true);
  protected readonly downloading = signal(false);
  protected readonly error = signal('');
  protected readonly downloadError = signal('');
  protected readonly notice = signal('');

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((value) => {
        this.readRequest?.unsubscribe();
        this.downloadRequest?.unsubscribe();
        ++this.downloadAttempt;
        this.id.set(positiveId(value));
        this.report.set(null);
        this.error.set('');
        this.downloadError.set('');
        this.notice.set('');
        if (!this.id()) {
          this.loading.set(false);
          this.error.set('Đường dẫn sự kiện không hợp lệ.');
          return;
        }
        this.load();
      });
  }

  protected load(): void {
    const id = this.id();
    if (!id || this.downloading()) return;
    this.readRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.readRequest = this.api
      .report(id)
      .pipe(
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
          this.error.set(apiError(error, 'Không tải được báo cáo sự kiện.').message),
      });
  }

  protected download(): void {
    const id = this.id();
    if (!id || !this.report() || this.downloading()) return;
    const attempt = ++this.downloadAttempt;
    this.downloading.set(true);
    this.downloadError.set('');
    this.notice.set('');
    this.downloadRequest = this.api
      .reportPdf(id)
      .pipe(
        timeout(30000),
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) => {
          if (!blob.size || !blob.type.includes('application/pdf')) {
            this.downloadError.set('Máy chủ không trả về PDF hợp lệ.');
            return;
          }
          saveBlob(blob, `event-${id}-revenue.pdf`);
          this.notice.set('Đã gửi yêu cầu tải báo cáo. Kiểm tra mục tải xuống của trình duyệt.');
        },
        error: (error) => {
          void this.showDownloadError(error, attempt);
        },
      });
  }

  private async showDownloadError(error: unknown, attempt: number): Promise<void> {
    let normalized = error;
    if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
      try {
        normalized = new HttpErrorResponse({
          error: JSON.parse(await error.error.text()),
          status: error.status,
        });
      } catch {
        /* Body không phải ProblemDetail JSON: giữ thông báo dự phòng. */
      }
    }
    if (!this.destroyRef.destroyed && attempt === this.downloadAttempt) {
      this.downloadError.set(
        apiError(normalized, 'Không tải được PDF báo cáo. Vui lòng thử lại.').message,
      );
    }
  }
}

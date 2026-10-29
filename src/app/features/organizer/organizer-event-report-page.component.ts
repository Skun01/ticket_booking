import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { Subscription, distinctUntilChanged, finalize, map, timeout } from 'rxjs';
import { OrganizerApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { EventReport } from '../../core/api/models';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header.component';
import { RevenueChart } from '../../shared/revenue-chart.component';
import { saveBlob } from '../../shared/download-file';
import { positiveId } from './organizer-utils';

@Component({
  selector: 'app-organizer-event-report-page',
  imports: [LoadingState, RouterLink, MatButton, MoneyPipe, PageHeader, RevenueChart],
  templateUrl: './organizer-event-report-page.component.html',
  
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
  private readonly feedback = inject(FeedbackService);
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
          this.error.set(this.feedback.problem(error, 'Không tải được báo cáo sự kiện.').message),
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
            this.feedback.error(this.downloadError());
            return;
          }
          saveBlob(blob, `event-${id}-revenue.pdf`);
          this.notice.set('Đã gửi yêu cầu tải báo cáo. Kiểm tra mục tải xuống của trình duyệt.');
          this.feedback.info(this.notice());
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
        this.feedback.problem(normalized, 'Không tải được PDF báo cáo. Vui lòng thử lại.').message,
      );
    }
  }
}

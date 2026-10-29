import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { Subscription, finalize } from 'rxjs';
import { TicketApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { Ticket } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { EmptyState } from '../../shared/empty-state.component';
import { PageHeader } from '../../shared/page-header.component';
import { Paginator } from '../../shared/paginator.component';
import { StatusBadge } from '../../shared/status-badge.component';
import { saveBlob } from '../../shared/download-file';

@Component({
  selector: 'app-tickets-page',
  imports: [
    LoadingState,
    RouterLink,
    MatButton,
    DateTimePipe,
    EmptyState,
    PageHeader,
    Paginator,
    StatusBadge,
  ],
  templateUrl: './tickets-page.component.html',
  
  styles: `
    :host {
      display: block;
      padding-top: 32px;
    }
    .ticket-list {
      display: grid;
      gap: 16px;
    }
    .ticket {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      border: 1px solid var(--app-line);
      border-radius: 0.4rem;
      padding: 24px;
      background: var(--app-panel);
    }
    .ticket-info {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .ticket h2 {
      font-size: 1.25rem;
    }
    .ticket p {
      margin-bottom: 0.5rem;
    }
    .code {
      font-variant-numeric: tabular-nums;
    }
    .ticket-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }
    @media (max-width: 768px) {
      .ticket {
        grid-template-columns: 1fr;
        padding: 20px;
      }
      .ticket-actions {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
      }
    }
  `,
})
export class TicketsPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(TicketApi);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly tickets = signal<Ticket[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly downloadError = signal('');
  protected readonly downloadNotice = signal('');
  protected readonly downloading = signal<number | null>(null);
  protected readonly page = signal(0);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(0);

  constructor() {
    this.load(0);
  }

  protected load(page: number): void {
    this.request?.unsubscribe();
    this.page.set(page);
    this.loading.set(true);
    this.error.set('');
    this.request = this.api
      .listOwn({ page, size: 12 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.tickets.set(result.content);
          this.page.set(result.page);
          this.total.set(result.totalElements);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(this.feedback.problem(error, 'Không thể tải vé của bạn.').message);
          this.loading.set(false);
        },
      });
  }

  protected download(ticket: Ticket): void {
    if (this.downloading() !== null) return;
    this.downloading.set(ticket.id);
    this.downloadError.set('');
    this.downloadNotice.set('');
    this.api
      .downloadPdf(ticket.id)
      .pipe(
        finalize(() => this.downloading.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) => {
          if (!blob.size || !blob.type.includes('application/pdf')) {
            this.downloadError.set('Máy chủ không trả về file PDF hợp lệ. Vui lòng thử lại.');
            this.feedback.error(this.downloadError());
            return;
          }
          saveBlob(blob, `ticket-${ticket.id}.pdf`);
          this.downloadNotice.set(
            `Đã gửi yêu cầu tải vé ${ticket.ticketCode}. Kiểm tra mục tải xuống của trình duyệt.`,
          );
          this.feedback.info('Đã gửi yêu cầu tải PDF vé. Kiểm tra mục tải xuống của trình duyệt.');
        },
        error: (error: unknown) => {
          void this.showDownloadError(error);
        },
      });
  }

  private async showDownloadError(error: unknown): Promise<void> {
    // Với responseType blob, ProblemDetail cũng là Blob, cần đọc JSON trước khi map mã lỗi.
    let normalized = error;
    if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
      try {
        normalized = new HttpErrorResponse({
          error: JSON.parse(await error.error.text()),
          status: error.status,
        });
      } catch {
        /* Giữ thông báo dự phòng nếu body không phải JSON. */
      }
    }
    if (!this.destroyRef.destroyed)
      this.downloadError.set(
        this.feedback.problem(normalized, 'Không thể tải PDF vé. Vui lòng thử lại.').message,
      );
  }
}

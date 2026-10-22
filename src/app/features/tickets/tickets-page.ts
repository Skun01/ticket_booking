import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { Subscription, finalize } from 'rxjs';
import { TicketApi } from '../../core/api/catalog.api';
import { apiError } from '../../core/api/api-error';
import { Ticket } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { EmptyState } from '../../shared/empty-state';
import { PageHeader } from '../../shared/page-header';
import { Paginator } from '../../shared/paginator';
import { StatusBadge } from '../../shared/status-badge';
import { saveBlob } from '../../shared/download-file';

@Component({
  selector: 'app-tickets-page',
  imports: [RouterLink, MatButton, DateTimePipe, EmptyState, PageHeader, Paginator, StatusBadge],
  template: `
    <app-page-header
      title="Vé của tôi"
      subtitle="Vé điện tử được phát hành sau khi thanh toán thành công."
    >
      <a mat-stroked-button routerLink="/orders">Đơn của tôi</a>
    </app-page-header>
    @if (downloadError()) {
      <p class="form-notice error" role="alert">{{ downloadError() }}</p>
    }
    @if (downloadNotice()) {
      <p class="form-notice" role="status">{{ downloadNotice() }}</p>
    }
    @if (loading()) {
      <p role="status">Đang tải vé của bạn…</p>
    } @else if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
      <button mat-stroked-button type="button" (click)="load(page())">Thử lại</button>
    } @else if (tickets().length === 0) {
      <app-empty-state
        icon="calendar"
        title="Bạn chưa có vé nào"
        description="Hoàn tất thanh toán đơn để nhận vé điện tử."
      >
        <a mat-flat-button routerLink="/orders">Xem đơn của tôi</a>
      </app-empty-state>
    } @else {
      <p class="muted">{{ total() }} vé. Không chia sẻ mã vé hoặc PDF cho người lạ.</p>
      <div class="ticket-list">
        @for (ticket of tickets(); track ticket.id) {
          <article class="ticket">
            <div class="ticket-info">
              <h2>
                <a [routerLink]="['/events', ticket.eventId]">{{ ticket.eventTitle }}</a>
              </h2>
              <p>{{ ticket.ticketTypeName }}</p>
              <p class="muted">
                {{ ticket.startTime | dateTime }} đến {{ ticket.endTime | dateTime }}
              </p>
              <p class="code">
                Mã vé: <strong>{{ ticket.ticketCode }}</strong>
              </p>
              @if (ticket.checkedInAt) {
                <p class="muted">Đã check-in lúc {{ ticket.checkedInAt | dateTime }}</p>
              }
              @if (ticket.status === 'CANCELLED') {
                <p>Vé đã hủy, không dùng để vào sự kiện.</p>
              }
            </div>
            <div class="ticket-actions">
              <app-status-badge [status]="ticket.status" />
              <button
                mat-flat-button
                type="button"
                (click)="download(ticket)"
                [disabled]="downloading() !== null"
                [attr.aria-busy]="downloading() === ticket.id"
              >
                {{ downloading() === ticket.id ? 'Đang tải…' : 'Tải vé PDF' }}
              </button>
              <a [routerLink]="['/orders', ticket.orderId]">Xem đơn vé</a>
            </div>
          </article>
        }
      </div>
      <app-paginator [page]="page()" [totalPages]="totalPages()" (pageChange)="load($event)" />
    }
  `,
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
          this.error.set(apiError(error, 'Không thể tải vé của bạn.').message);
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
            return;
          }
          saveBlob(blob, `ticket-${ticket.id}.pdf`);
          this.downloadNotice.set(
            `Đã gửi yêu cầu tải vé ${ticket.ticketCode}. Kiểm tra mục tải xuống của trình duyệt.`,
          );
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
        apiError(normalized, 'Không thể tải PDF vé. Vui lòng thử lại.').message,
      );
  }
}

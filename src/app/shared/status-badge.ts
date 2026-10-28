import { Component, computed, input } from '@angular/core';
import { EventStatus, OrderStatus, TicketStatus } from '../core/api/models';

type AnyStatus = EventStatus | OrderStatus | TicketStatus | string;

const labels: Record<string, string> = {
  // EventStatus
  DRAFT: 'Nháp',
  PUBLISHED: 'Đang mở',
  CANCELLED: 'Đã hủy',
  ENDED: 'Đã kết thúc',
  // OrderStatus
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  EXPIRED: 'Hết hạn',
  // TicketStatus
  VALID: 'Hợp lệ',
  USED: 'Đã dùng',
};

// Map trạng thái → tông màu (class).
const tones: Record<string, string> = {
  DRAFT: 'info',
  PUBLISHED: 'success',
  CANCELLED: 'danger',
  ENDED: 'neutral',
  PENDING: 'warning',
  PAID: 'success',
  EXPIRED: 'danger',
  VALID: 'success',
  USED: 'neutral',
};

@Component({
  selector: 'app-status-badge',
  template: `<span class="badge" [class]="tone()">{{ label() }}</span>`,
  styles: `
    .badge {
      display: inline-flex; align-items: center; padding: .15rem .6rem;
      border-radius: 999px; font-size: .8rem; font-weight: 600; line-height: 1.6;
      border: 1px solid transparent;
    }
    .success { background: var(--app-success-soft); color: var(--app-success); border-color: var(--app-success-line); }
    .warning { background: var(--app-warning-soft); color: var(--app-warning); border-color: var(--app-warning-line); }
    .danger  { background: var(--app-danger-soft); color: var(--app-danger); border-color: var(--app-danger-line); }
    .info    { background: var(--app-info-soft); color: var(--app-info); border-color: var(--app-info-line); }
    .neutral { background: var(--app-soft); color: var(--app-muted); border-color: var(--app-line); }
  `,
})
export class StatusBadge {
  readonly status = input.required<AnyStatus>();
  protected readonly label = computed(() => labels[this.status()] ?? this.status());
  protected readonly tone = computed(() => tones[this.status()] ?? 'neutral');
}

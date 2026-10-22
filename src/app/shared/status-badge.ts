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
  DRAFT: 'neutral',
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
    .success { background: #e6f4ea; color: #1e7e34; border-color: #bfe3c9; }
    .warning { background: #fff4e5; color: #b26a00; border-color: #ffd9a8; }
    .danger  { background: #fdecea; color: #c0392b; border-color: #f5c6c0; }
    .neutral { background: #eef0f2; color: #5a6168; border-color: #d9dde1; }
  `,
})
export class StatusBadge {
  readonly status = input.required<AnyStatus>();
  protected readonly label = computed(() => labels[this.status()] ?? this.status());
  protected readonly tone = computed(() => tones[this.status()] ?? 'neutral');
}

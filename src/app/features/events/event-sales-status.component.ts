import { Component, computed, input } from '@angular/core';
import { EventDetail } from '../../core/api/models';

export type EventSalesSchedule = Pick<EventDetail, 'salesStartTime' | 'startTime' | 'endTime'>;

export type EventSalesPhase = 'upcoming' | 'on-sale' | 'ongoing' | 'ended' | 'invalid';

export interface EventSalesState {
  phase: EventSalesPhase;
  label: string;
  countdown: string;
}

export function formatSalesCountdown(remainingMs: number): string {
  const totalSeconds = Number.isFinite(remainingMs)
    ? Math.max(0, Math.ceil(remainingMs / 1000))
    : 0;
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (days) parts.push(`${days} ngày`);
  if (hours) parts.push(`${hours} giờ`);
  if (minutes) parts.push(`${minutes} phút`);
  if (seconds || parts.length === 0) parts.push(`${seconds} giây`);

  return parts.join(' ');
}

export function getEventSalesState(event: EventSalesSchedule, now: number): EventSalesState {
  const salesStart = Date.parse(event.salesStartTime);
  const eventStart = Date.parse(event.startTime);
  const eventEnd = Date.parse(event.endTime);

  if (
    !Number.isFinite(now) ||
    !Number.isFinite(salesStart) ||
    !Number.isFinite(eventStart) ||
    !Number.isFinite(eventEnd) ||
    salesStart >= eventStart ||
    eventStart >= eventEnd
  ) {
    return { phase: 'invalid', label: 'Lịch chưa khả dụng', countdown: '' };
  }
  if (now < salesStart) {
    return {
      phase: 'upcoming',
      label: 'Sắp mở bán',
      countdown: formatSalesCountdown(salesStart - now),
    };
  }
  if (now < eventStart) return { phase: 'on-sale', label: 'Đang mở bán', countdown: '' };
  if (now < eventEnd) return { phase: 'ongoing', label: 'Đang diễn ra', countdown: '' };
  return { phase: 'ended', label: 'Đã kết thúc', countdown: '' };
}

@Component({
  selector: 'app-event-sales-status',
  templateUrl: './event-sales-status.component.html',
  
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
    }
    .badge {
      display: inline-flex;
      align-items: flex-start;
      gap: 0.55rem;
      max-width: 100%;
      padding: 0.38rem 0.65rem;
      border: 1px solid var(--app-line);
      border-radius: 999px;
      color: var(--app-ink);
      background: var(--app-panel);
      font-size: 0.78rem;
      line-height: 1.35;
    }
    .dot {
      flex: 0 0 auto;
      width: 0.45rem;
      height: 0.45rem;
      margin-top: 0.3rem;
      border-radius: 50%;
      background: currentColor;
    }
    .copy {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.1rem 0.45rem;
      min-width: 0;
    }
    strong {
      font-size: inherit;
    }
    small {
      color: inherit;
      font-size: 0.72rem;
      overflow-wrap: anywhere;
    }
    .countdown {
      font-variant-numeric: tabular-nums;
    }
    .phase-upcoming,
    .phase-invalid {
      color: var(--app-warning);
      background: var(--app-warning-soft);
      border-color: var(--app-warning-line);
    }
    .phase-on-sale {
      color: var(--app-success);
      background: var(--app-success-soft);
      border-color: var(--app-success-line);
    }
    .phase-on-sale .dot {
      box-shadow: 0 0 0 2px var(--app-success-line);
    }
    .phase-ongoing {
      color: var(--app-info);
      background: var(--app-info-soft);
      border-color: var(--app-info-line);
    }
    .phase-ended {
      color: var(--app-muted);
      background: var(--app-soft);
    }
    .phase-invalid {
      border-style: dashed;
    }
  `,
})
export class EventSalesStatus {
  readonly event = input.required<EventSalesSchedule>();
  readonly now = input.required<number>();
  protected readonly state = computed(() => getEventSalesState(this.event(), this.now()));
}

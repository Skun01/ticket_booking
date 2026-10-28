import { EventDetail, TicketType } from '../../core/api/models';

export type EventSalesSchedule = Pick<EventDetail, 'salesStartTime' | 'startTime' | 'endTime'>;
export type EventSalesPhase = 'upcoming' | 'on-sale' | 'ongoing' | 'ended' | 'invalid';

export interface EventSalesState {
  phase: EventSalesPhase;
  label: string;
  countdown: string;
}

type TicketStock = Pick<TicketType, 'availableQuantity'>;

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

export function ticketUnavailableReason(
  event: EventSalesSchedule,
  ticket: TicketStock,
  now: number,
): string {
  const { phase } = getEventSalesState(event, now);

  if (phase === 'invalid') return 'Lịch bán vé không hợp lệ.';
  if (phase === 'upcoming') return 'Chưa đến giờ mở bán.';
  if (phase === 'ongoing' || phase === 'ended') {
    return 'Sự kiện đã bắt đầu, bán vé đã kết thúc.';
  }
  if (!Number.isFinite(ticket.availableQuantity) || ticket.availableQuantity <= 0) {
    return 'Đã hết vé.';
  }
  return '';
}

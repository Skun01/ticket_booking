import { EventSalesSchedule } from './event-sales-status';
import { ticketUnavailableReason } from './ticket-availability';

const salesStart = Date.parse('2026-01-01T00:00:00.000Z');
const eventStart = Date.parse('2026-01-02T00:00:00.000Z');
const eventEnd = Date.parse('2026-01-03T00:00:00.000Z');
const schedule: EventSalesSchedule = {
  salesStartTime: new Date(salesStart).toISOString(),
  startTime: new Date(eventStart).toISOString(),
  endTime: new Date(eventEnd).toISOString(),
};

describe('ticket availability', () => {
  it('preserves the messages before, during, and after ticket sales', () => {
    expect(ticketUnavailableReason(schedule, { availableQuantity: 1 }, salesStart - 1)).toBe(
      'Chưa đến giờ mở bán.',
    );
    expect(ticketUnavailableReason(schedule, { availableQuantity: 1 }, salesStart)).toBe('');
    expect(ticketUnavailableReason(schedule, { availableQuantity: 1 }, eventStart)).toBe(
      'Sự kiện đã bắt đầu, bán vé đã kết thúc.',
    );
    expect(ticketUnavailableReason(schedule, { availableQuantity: 1 }, eventEnd)).toBe(
      'Sự kiện đã bắt đầu, bán vé đã kết thúc.',
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'treats inventory %s as unavailable while sales are open',
    (availableQuantity) => {
      expect(ticketUnavailableReason(schedule, { availableQuantity }, salesStart)).toBe(
        'Đã hết vé.',
      );
    },
  );

  it('accepts finite positive inventory while sales are open', () => {
    expect(ticketUnavailableReason(schedule, { availableQuantity: 0.5 }, salesStart)).toBe('');
  });

  it('reports malformed schedules before considering inventory', () => {
    expect(
      ticketUnavailableReason(
        { ...schedule, endTime: schedule.startTime },
        { availableQuantity: 0 },
        salesStart,
      ),
    ).toBe('Lịch bán vé không hợp lệ.');
    expect(ticketUnavailableReason(schedule, { availableQuantity: 1 }, Number.NaN)).toBe(
      'Lịch bán vé không hợp lệ.',
    );
  });
});

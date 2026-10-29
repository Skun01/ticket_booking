import { TestBed } from '@angular/core/testing';
import {
  EventSalesSchedule,
  EventSalesStatus,
  formatSalesCountdown,
  getEventSalesState,
} from './event-sales-status.component';

const salesStart = Date.parse('2026-01-01T00:00:00.000Z');
const eventStart = Date.parse('2026-01-03T00:00:00.000Z');
const eventEnd = Date.parse('2026-01-04T00:00:00.000Z');
const schedule: EventSalesSchedule = {
  salesStartTime: new Date(salesStart).toISOString(),
  startTime: new Date(eventStart).toISOString(),
  endTime: new Date(eventEnd).toISOString(),
};

describe('event sales state', () => {
  it('uses exact schedule boundaries for each phase', () => {
    expect(getEventSalesState(schedule, salesStart - 1)).toEqual({
      phase: 'upcoming',
      label: 'Sắp mở bán',
      countdown: '1 giây',
    });
    expect(getEventSalesState(schedule, salesStart)).toEqual({
      phase: 'on-sale',
      label: 'Đang mở bán',
      countdown: '',
    });
    expect(getEventSalesState(schedule, eventStart - 1).phase).toBe('on-sale');
    expect(getEventSalesState(schedule, eventStart)).toEqual({
      phase: 'ongoing',
      label: 'Đang diễn ra',
      countdown: '',
    });
    expect(getEventSalesState(schedule, eventEnd - 1).phase).toBe('ongoing');
    expect(getEventSalesState(schedule, eventEnd)).toEqual({
      phase: 'ended',
      label: 'Đã kết thúc',
      countdown: '',
    });
  });

  it('rejects missing, malformed, non-finite, and out-of-order schedules', () => {
    const invalidSchedules: EventSalesSchedule[] = [
      { ...schedule, salesStartTime: '' },
      { ...schedule, startTime: 'not-a-date' },
      { ...schedule, endTime: undefined as unknown as string },
      { ...schedule, salesStartTime: schedule.startTime },
      { ...schedule, startTime: schedule.endTime },
    ];

    for (const invalid of invalidSchedules) {
      expect(getEventSalesState(invalid, salesStart).phase).toBe('invalid');
    }
    expect(getEventSalesState(schedule, Number.NaN)).toEqual({
      phase: 'invalid',
      label: 'Lịch chưa khả dụng',
      countdown: '',
    });
    expect(getEventSalesState(schedule, Number.POSITIVE_INFINITY).phase).toBe('invalid');
  });

  it('formats multi-day durations and rounds any positive subsecond up', () => {
    expect(formatSalesCountdown(((2 * 24 + 3) * 60 * 60 + 4 * 60 + 5) * 1000)).toBe(
      '2 ngày 3 giờ 4 phút 5 giây',
    );
    expect(formatSalesCountdown(0.1)).toBe('1 giây');
    expect(formatSalesCountdown(0)).toBe('0 giây');
    expect(formatSalesCountdown(-1000)).toBe('0 giây');
  });
});

describe('EventSalesStatus', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [EventSalesStatus] }));

  it('renders the upcoming countdown in a compact badge', () => {
    const fixture = TestBed.createComponent(EventSalesStatus);
    fixture.componentRef.setInput('event', schedule);
    fixture.componentRef.setInput('now', salesStart - 1000);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('phase-upcoming')).toBe(true);
    expect(badge.textContent).toContain('Sắp mở bán');
    expect(badge.textContent).toContain('Mở bán sau 1 giây');
  });

  it('explains that sales are closed while the event is ongoing', () => {
    const fixture = TestBed.createComponent(EventSalesStatus);
    fixture.componentRef.setInput('event', schedule);
    fixture.componentRef.setInput('now', eventStart);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Đang diễn ra');
    expect(fixture.nativeElement.textContent).toContain('Đã đóng bán');
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { CatalogApi } from '../../core/api/catalog.api';
import { EventDetail } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { FeedbackService } from '../../shared/feedback.service';
import { EventDetailPage } from './event-detail-page';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function eventFixture(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: 42,
    title: 'Giải chạy đầu năm',
    description: 'Một sự kiện thử nghiệm.',
    bannerUrl: null,
    salesStartTime: '2026-01-01T01:00:00.000Z',
    startTime: '2026-01-02T02:00:00.000Z',
    endTime: '2026-01-02T04:00:00.000Z',
    category: { id: 1, name: 'Chạy bộ', slug: 'chay-bo' },
    venue: {
      id: 2,
      name: 'Sân vận động',
      address: '1 Đường Chính',
      city: 'Hà Nội',
      capacity: 1000,
    },
    ticketTypes: [
      {
        id: 7,
        eventId: 42,
        name: 'Tiêu chuẩn',
        price: 250_000,
        totalQuantity: 100,
        soldQuantity: 20,
        availableQuantity: 80,
        maxPerOrder: 4,
      },
    ],
    ...overrides,
  };
}

function normalizedText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('EventDetailPage', () => {
  let fixture: ComponentFixture<EventDetailPage> | undefined;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let catalog: { getEvent: ReturnType<typeof vi.fn> };
  let session: {
    loading: ReturnType<typeof signal<boolean>>;
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    isCustomer: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'Date'] });
    vi.setSystemTime(NOW);
    paramMap = new BehaviorSubject(convertToParamMap({ id: '42' }));
    catalog = { getEvent: vi.fn() };
    session = {
      loading: signal(false),
      isAuthenticated: signal(false),
      isCustomer: signal(false),
    };

    TestBed.configureTestingModule({
      imports: [EventDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap } },
        { provide: CatalogApi, useValue: catalog },
        { provide: SessionService, useValue: session },
        {
          provide: FeedbackService,
          useValue: { problem: vi.fn(() => ({ message: 'Không thể tải sự kiện.' })) },
        },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function render(event: EventDetail): HTMLElement {
    catalog.getEvent.mockReturnValue(of(event));
    fixture = TestBed.createComponent(EventDetailPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('loads the route event and renders one prominent purchase action without legacy ticket rows', () => {
    const host = render(eventFixture());

    expect(catalog.getEvent).toHaveBeenCalledOnce();
    expect(catalog.getEvent).toHaveBeenCalledWith(42);
    expect(host.querySelector('h1')?.textContent).toContain('Giải chạy đầu năm');

    const buyButtons = host.querySelectorAll<HTMLButtonElement>('.buy-button');
    expect(buyButtons).toHaveLength(1);
    expect(normalizedText(buyButtons[0])).toContain('Mua vé');
    expect(host.querySelector('.ticket-row')).toBeNull();
  });

  it('shows the upcoming countdown and exact opening, start, and end times in Vietnam time', () => {
    const host = render(eventFixture());
    const text = normalizedText(host);

    expect(text).toContain('Sắp mở bán');
    expect(text).toContain('Mở bán sau 1 giờ');
    expect(text).toContain('Mở bán 08:00 · 01/01/2026');
    expect(text).toContain('Bắt đầu 09:00 · 02/01/2026');
    expect(text).toContain('Kết thúc 11:00 · 02/01/2026');
    expect(text).toContain('Đóng bán 09:00 · 02/01/2026');
  });

  it.each([
    {
      name: 'no ticket types',
      event: eventFixture({
        salesStartTime: '2025-12-31T00:00:00.000Z',
        ticketTypes: [],
      }),
      message: 'Chưa có hạng vé nào được mở bán.',
      stockNotice: false,
    },
    {
      name: 'all ticket types sold out',
      event: eventFixture({
        salesStartTime: '2025-12-31T00:00:00.000Z',
        ticketTypes: [
          {
            id: 7,
            eventId: 42,
            name: 'Tiêu chuẩn',
            price: 250_000,
            totalQuantity: 100,
            soldQuantity: 100,
            availableQuantity: 0,
            maxPerOrder: 4,
          },
        ],
      }),
      message: 'Các hạng vé hiện đã hết. Vui lòng quay lại sau.',
      stockNotice: true,
    },
  ])('disables purchasing for $name', ({ event, message, stockNotice }) => {
    const host = render(event);

    expect(host.querySelector<HTMLButtonElement>('.buy-button')?.disabled).toBe(true);
    expect(normalizedText(host)).toContain(message);
    expect(!!host.querySelector('.stock-notice')).toBe(stockNotice);
    if (stockNotice) expect(host.querySelector('.stock-notice')?.textContent).toContain('Hết vé');
  });

  it.each([
    {
      name: 'the session is loading',
      configure: () => session.loading.set(true),
      message: 'Đang kiểm tra tài khoản…',
    },
    {
      name: 'an authenticated organizer is viewing',
      configure: () => {
        session.isAuthenticated.set(true);
        session.isCustomer.set(false);
      },
      message: 'Chỉ tài khoản khách hàng (CUSTOMER) được đặt vé.',
    },
  ])('disables the purchase action while $name', ({ configure, message }) => {
    configure();
    const host = render(
      eventFixture({ salesStartTime: '2025-12-31T00:00:00.000Z' }),
    );

    expect(host.querySelector<HTMLButtonElement>('.buy-button')?.disabled).toBe(true);
    expect(normalizedText(host)).toContain(message);
  });

  it('navigates to the booking path without ticket query parameters', () => {
    const host = render(
      eventFixture({ salesStartTime: '2025-12-31T00:00:00.000Z' }),
    );
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    host.querySelector<HTMLButtonElement>('.buy-button')?.click();

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/events', 42, 'book']);
  });

  it('revalidates availability against Date.now when the purchase action is clicked', () => {
    const event = eventFixture({ salesStartTime: '2025-12-31T00:00:00.000Z' });
    const host = render(event);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(host.querySelector<HTMLButtonElement>('.buy-button')?.disabled).toBe(false);

    vi.setSystemTime(new Date(event.startTime));
    host.querySelector<HTMLButtonElement>('.buy-button')?.click();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('stops its countdown interval when destroyed', () => {
    const timersBeforeRender = vi.getTimerCount();
    render(eventFixture());
    expect(vi.getTimerCount()).toBeGreaterThan(timersBeforeRender);

    fixture?.destroy();
    fixture = undefined;

    expect(vi.getTimerCount()).toBe(timersBeforeRender);
  });
});

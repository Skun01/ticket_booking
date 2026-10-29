import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { CatalogApi, OrderApi } from '../../core/api/catalog.api';
import { EventDetail } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { FeedbackService } from '../../shared/feedback.service';
import { BookingPage } from './booking-page.component';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function eventFixture(): EventDetail {
  return {
    id: 42,
    title: 'Giải chạy đầu năm',
    description: null,
    bannerUrl: null,
    salesStartTime: '2025-12-31T00:00:00.000Z',
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
        id: 10,
        eventId: 42,
        name: 'Đã bán hết',
        price: 100_000,
        totalQuantity: 10,
        soldQuantity: 10,
        availableQuantity: 0,
        maxPerOrder: 2,
      },
      {
        id: 11,
        eventId: 42,
        name: 'Tiêu chuẩn',
        price: 200_000,
        totalQuantity: 50,
        soldQuantity: 5,
        availableQuantity: 45,
        maxPerOrder: 4,
      },
      {
        id: 12,
        eventId: 42,
        name: 'Cao cấp',
        price: 500_000,
        totalQuantity: 20,
        soldQuantity: 2,
        availableQuantity: 18,
        maxPerOrder: 2,
      },
    ],
  };
}

function normalizedText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('BookingPage ticket preselection', () => {
  let fixture: ComponentFixture<BookingPage> | undefined;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let catalog: { getEvent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'Date'] });
    vi.setSystemTime(NOW);
    queryParamMap = new BehaviorSubject(convertToParamMap({}));
    catalog = { getEvent: vi.fn(() => of(eventFixture())) };

    TestBed.configureTestingModule({
      imports: [BookingPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ id: '42' })),
            queryParamMap,
          },
        },
        { provide: CatalogApi, useValue: catalog },
        { provide: OrderApi, useValue: { create: vi.fn() } },
        {
          provide: SessionService,
          useValue: { isCustomer: signal(true) },
        },
        {
          provide: FeedbackService,
          useValue: {
            problem: vi.fn(() => ({ message: 'Không thể đặt vé.' })),
            success: vi.fn(),
          },
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

  function render(): HTMLElement {
    fixture = TestBed.createComponent(BookingPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('selects the first available ticket when the booking URL has no query parameter', () => {
    const host = render();
    const options = host.querySelectorAll<HTMLButtonElement>('.ticket-option');

    expect(catalog.getEvent).toHaveBeenCalledWith(42);
    expect(options).toHaveLength(3);
    expect(options[0].disabled).toBe(true);
    expect(options[0].getAttribute('aria-checked')).toBe('false');
    expect(options[1].getAttribute('aria-checked')).toBe('true');
    expect(options[2].getAttribute('aria-checked')).toBe('false');
    expect(normalizedText(host.querySelector('.summary')!)).toContain('Tiêu chuẩn');
    expect(normalizedText(host.querySelector('.summary')!)).toContain('200.000');
  });

  it('honors the legacy ticketTypeId query parameter when that ticket remains available', () => {
    queryParamMap.next(convertToParamMap({ ticketTypeId: '12' }));

    const host = render();
    const options = host.querySelectorAll<HTMLButtonElement>('.ticket-option');

    expect(options[1].getAttribute('aria-checked')).toBe('false');
    expect(options[2].getAttribute('aria-checked')).toBe('true');
    expect(normalizedText(host.querySelector('.summary')!)).toContain('Cao cấp');
    expect(normalizedText(host.querySelector('.summary')!)).toContain('500.000');
  });
});

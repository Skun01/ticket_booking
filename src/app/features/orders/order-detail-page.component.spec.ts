import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { OrderApi } from '../../core/api/catalog.api';
import { Order, PayOSCheckout } from '../../core/api/models';
import { PaymentNavigation } from '../../core/api/payment-navigation.service';
import { SessionService } from '../../core/auth/session.service';
import { FeedbackService } from '../../shared/feedback.service';
import { OrderDetailPage } from './order-detail-page.component';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const CHECKOUT: PayOSCheckout = {
  orderId: 42,
  orderCode: 42,
  checkoutUrl: 'https://pay.payos.vn/web/link-42',
  qrCode: 'bank-qr-payload',
  paymentLinkId: 'link-42',
  amount: 200_000,
  status: 'PENDING',
};

function orderFixture(status: Order['status'] = 'PENDING'): Order {
  return {
    id: 42,
    orderCode: 'ORD-42',
    status,
    totalAmount: 200_000,
    discountAmount: 0,
    expiresAt: '2026-01-01T00:15:00.000Z',
    createdAt: NOW.toISOString(),
    items: [
      {
        id: 1,
        ticketTypeId: 11,
        ticketTypeName: 'Tiêu chuẩn',
        eventId: 2,
        quantity: 1,
        unitPrice: 200_000,
      },
    ],
  };
}

describe('OrderDetailPage PayOS checkout', () => {
  let fixture: ComponentFixture<OrderDetailPage> | undefined;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let data: BehaviorSubject<Record<string, boolean>>;
  let api: {
    getOwn: ReturnType<typeof vi.fn>;
    syncPayOS: ReturnType<typeof vi.fn>;
    createPayOSCheckout: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let navigation: { openCheckout: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(NOW);
    params = new BehaviorSubject(convertToParamMap({ id: '42' }));
    query = new BehaviorSubject(convertToParamMap({}));
    data = new BehaviorSubject<Record<string, boolean>>({});
    api = {
      getOwn: vi.fn(() => of(orderFixture())),
      syncPayOS: vi.fn(() => of(orderFixture())),
      createPayOSCheckout: vi.fn(),
      cancel: vi.fn(() => of(orderFixture('CANCELLED'))),
    };
    navigation = { openCheckout: vi.fn() };
    TestBed.configureTestingModule({
      imports: [OrderDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: query, data } },
        { provide: OrderApi, useValue: api },
        { provide: PaymentNavigation, useValue: navigation },
        { provide: SessionService, useValue: { isCustomer: signal(true) } },
        {
          provide: FeedbackService,
          useValue: {
            problem: vi.fn((_error, message) => ({ message })),
            success: vi.fn(),
            info: vi.fn(),
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
    fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers order selection without API requests when opening payment without an order', () => {
    data.next({ paymentPage: true });
    const host = render();
    expect(host.textContent).toContain('Chọn đơn vé để thanh toán');
    expect(host.querySelector('a[href="/orders"]')).not.toBeNull();
    expect(host.querySelector('a[href="/events"]')).not.toBeNull();
    expect(host.querySelector('[data-action="pay"]')).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(api.getOwn).not.toHaveBeenCalled();
    expect(api.syncPayOS).not.toHaveBeenCalled();
    expect(api.createPayOSCheckout).not.toHaveBeenCalled();
  });

  it('loads the selected payment order without treating it as a PayOS callback', () => {
    data.next({ paymentPage: true });
    query.next(convertToParamMap({ orderCode: '42', status: 'PAID' }));
    const host = render();
    expect(api.getOwn).toHaveBeenCalledExactlyOnceWith(42);
    expect(host.textContent).toContain('Hoàn tất thanh toán');
    expect(host.textContent).not.toContain('Thanh toán thành công');
    expect(host.querySelector<HTMLButtonElement>('[data-action="pay"]')!.disabled).toBe(false);
    expect(host.querySelector('app-order-summary')?.textContent).toContain('ORD-42');
    vi.advanceTimersByTime(60_000);
    expect(api.syncPayOS).not.toHaveBeenCalled();
  });

  it('rejects a malformed payment selection instead of showing the empty state', () => {
    data.next({ paymentPage: true });
    query.next(convertToParamMap({ orderCode: 'invalid' }));
    const host = render();
    expect(host.textContent).toContain('Đường dẫn đơn vé không hợp lệ');
    expect(host.textContent).not.toContain('Chọn đơn vé để thanh toán');
    expect(api.getOwn).not.toHaveBeenCalled();
  });

  it('offers tickets instead of checkout after backend-confirmed payment', () => {
    api.getOwn.mockReturnValue(of(orderFixture('PAID')));
    const host = render();
    expect(host.textContent).toContain('1 vé điện tử đã sẵn sàng');
    expect(host.querySelector('a[href="/tickets"]')).not.toBeNull();
    expect(host.querySelector('[data-action="pay"]')).toBeNull();
  });

  it('keeps order cancellation behind explicit confirmation', () => {
    const host = render();
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Hủy đơn')!
      .click();
    fixture!.detectChanges();
    expect(host.textContent).toContain('Chỉ xác nhận nếu bạn chưa chuyển tiền');
    expect(api.cancel).not.toHaveBeenCalled();
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Giữ đơn')!
      .click();
    fixture!.detectChanges();
    expect(host.querySelector('[data-action="cancel"]')).toBeNull();
    expect(api.syncPayOS).not.toHaveBeenCalled();
    expect(api.cancel).not.toHaveBeenCalled();
  });

  it('uses PayOS instead of presenting simulated payments', () => {
    const host = render();
    expect(host.textContent).toContain('PayOS');
    expect(host.textContent).not.toContain('giả lập');
    expect(host.querySelector('mat-checkbox')).toBeNull();
  });

  it('creates one checkout and redirects using the returned URL', () => {
    const result = new Subject<PayOSCheckout>();
    api.createPayOSCheckout.mockReturnValue(result);
    const host = render();
    const pay = host.querySelector<HTMLButtonElement>('[data-action="pay"]')!;
    pay.click();
    pay.click();
    fixture!.detectChanges();
    expect(api.createPayOSCheckout).toHaveBeenCalledExactlyOnceWith(42);
    expect(pay.disabled).toBe(true);
    result.next(CHECKOUT);
    result.complete();
    fixture!.detectChanges();
    expect(navigation.openCheckout).toHaveBeenCalledExactlyOnceWith(CHECKOUT.checkoutUrl);
    expect(host.textContent).not.toContain('Thanh toán thành công');
  });

  it('reconciles on browser back before allowing the existing checkout to be reopened', () => {
    api.createPayOSCheckout.mockReturnValue(of(CHECKOUT));
    const host = render();
    const pay = host.querySelector<HTMLButtonElement>('[data-action="pay"]')!;
    pay.click();
    fixture!.detectChanges();
    expect(pay.disabled).toBe(true);
    window.dispatchEvent(new Event('pageshow'));
    fixture!.detectChanges();
    expect(api.syncPayOS).toHaveBeenCalledExactlyOnceWith(42);
    expect(pay.disabled).toBe(false);
    pay.click();
    expect(api.createPayOSCheckout).toHaveBeenCalledTimes(1);
    expect(navigation.openCheckout).toHaveBeenCalledTimes(2);
  });

  it('reconciles instead of reopening a checkout that PayOS reports as paid', () => {
    api.createPayOSCheckout.mockReturnValue(of({ ...CHECKOUT, status: 'PAID' }));
    api.syncPayOS.mockReturnValue(of(orderFixture('PAID')));
    const host = render();
    host.querySelector<HTMLButtonElement>('[data-action="pay"]')!.click();
    fixture!.detectChanges();
    expect(navigation.openCheckout).not.toHaveBeenCalled();
    expect(api.syncPayOS).toHaveBeenCalledExactlyOnceWith(42);
    expect(host.textContent).toContain('Thanh toán thành công');
  });

  it('reuses the existing checkout if opening PayOS fails', () => {
    api.createPayOSCheckout.mockReturnValue(of(CHECKOUT));
    navigation.openCheckout.mockImplementationOnce(() => {
      throw new Error('Blocked');
    });
    const host = render();
    const pay = host.querySelector<HTMLButtonElement>('[data-action="pay"]')!;
    pay.click();
    fixture!.detectChanges();
    expect(host.textContent).toContain('Mở lại trang PayOS');
    pay.click();
    expect(api.createPayOSCheckout).toHaveBeenCalledTimes(1);
    expect(navigation.openCheckout).toHaveBeenCalledTimes(2);
  });

  it('does not replay checkout after a network error and requires reconciliation', () => {
    api.createPayOSCheckout.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const host = render();
    const pay = host.querySelector<HTMLButtonElement>('[data-action="pay"]')!;
    pay.click();
    fixture!.detectChanges();
    expect(pay.disabled).toBe(true);
    expect(api.createPayOSCheckout).toHaveBeenCalledTimes(1);
    expect(api.syncPayOS).not.toHaveBeenCalled();
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Cập nhật đơn'))!
      .click();
    fixture!.detectChanges();
    expect(api.syncPayOS).toHaveBeenCalledExactlyOnceWith(42);
    expect(pay.disabled).toBe(false);
    expect(api.createPayOSCheckout).toHaveBeenCalledTimes(1);
  });

  it('does not infer payment from the redirect status and polls for backend confirmation', () => {
    data.next({ paymentReturn: true });
    query.next(
      convertToParamMap({ orderCode: '42', id: 'payment-link-not-order-id', status: 'PAID' }),
    );
    api.syncPayOS.mockReturnValueOnce(of(orderFixture())).mockReturnValue(of(orderFixture('PAID')));
    const host = render();
    expect(api.syncPayOS).toHaveBeenCalledExactlyOnceWith(42);
    expect(api.getOwn).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Thanh toán thành công');
    expect(host.textContent).toContain('Đang đối soát');
    expect(host.querySelector<HTMLButtonElement>('[data-action="pay"]')!.disabled).toBe(true);
    vi.advanceTimersByTime(3000);
    fixture!.detectChanges();
    expect(host.textContent).toContain('Thanh toán thành công');
    vi.advanceTimersByTime(60_000);
    expect(api.syncPayOS).toHaveBeenCalledTimes(2);
  });

  it('stops polling after ten pending responses without claiming success', () => {
    data.next({ paymentReturn: true });
    query.next(convertToParamMap({ orderCode: '42', status: 'PAID' }));
    const host = render();
    vi.advanceTimersByTime(60_000);
    fixture!.detectChanges();
    expect(api.syncPayOS).toHaveBeenCalledTimes(10);
    expect(host.textContent).toContain('Máy chủ chưa xác nhận thanh toán');
    expect(host.textContent).not.toContain('Thanh toán thành công');
  });

  it('reconciles only once on cancel and makes the pending order actionable immediately', () => {
    data.next({ paymentReturn: true, paymentCancelled: true });
    query.next(convertToParamMap({ orderCode: '42', cancel: 'true', status: 'CANCELLED' }));
    const result = new Subject<Order>();
    api.syncPayOS.mockReturnValue(result);
    const host = render();
    const pay = host.querySelector<HTMLButtonElement>('[data-action="pay"]');
    expect(api.syncPayOS).toHaveBeenCalledExactlyOnceWith(42);
    expect(host.textContent).toContain('Đang kiểm tra trạng thái đơn');
    expect(pay).toBeNull();

    result.next(orderFixture());
    result.complete();
    fixture!.detectChanges();
    const resume = host.querySelector<HTMLButtonElement>('[data-action="pay"]')!;
    expect(resume.disabled).toBe(false);
    expect(resume.textContent).toContain('Tiếp tục thanh toán');
    expect(host.textContent).toContain('Đơn vé chưa bị hủy');
    expect(host.textContent).toContain('Đơn vẫn được giữ đến');
    expect(host.textContent).not.toContain('Đang kiểm tra trạng thái đơn');
    expect(host.textContent).not.toContain('Đang đối soát');
    expect(host.textContent).not.toContain('Máy chủ chưa xác nhận thanh toán');
    expect(api.cancel).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(api.syncPayOS).toHaveBeenCalledTimes(1);
  });

  it('still allows a single manual reconciliation after returning from cancel', () => {
    data.next({ paymentReturn: true, paymentCancelled: true });
    query.next(convertToParamMap({ orderCode: '42' }));
    const host = render();
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Cập nhật đơn'))!
      .click();
    fixture!.detectChanges();
    expect(api.syncPayOS).toHaveBeenCalledTimes(2);
    expect(host.querySelector<HTMLButtonElement>('[data-action="pay"]')!.disabled).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(api.syncPayOS).toHaveBeenCalledTimes(2);
  });

  it('shows backend-confirmed payment even when returning through the cancel URL', () => {
    data.next({ paymentReturn: true, paymentCancelled: true });
    query.next(convertToParamMap({ orderCode: '42', cancel: 'true', status: 'CANCELLED' }));
    api.syncPayOS.mockReturnValue(of(orderFixture('PAID')));
    const host = render();
    expect(host.textContent).toContain('Thanh toán thành công');
    expect(host.textContent).not.toContain('hủy thanh toán trên PayOS');
    expect(host.querySelector('[data-action="pay"]')).toBeNull();
    expect(api.cancel).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(api.syncPayOS).toHaveBeenCalledTimes(1);
  });

  it('requires a valid numeric orderCode on return instead of using the payment-link id', () => {
    data.next({ paymentReturn: true });
    query.next(convertToParamMap({ id: '42', status: 'PAID' }));
    const host = render();
    expect(api.syncPayOS).not.toHaveBeenCalled();
    expect(api.getOwn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Đường dẫn đơn vé không hợp lệ');
  });

  it('does not cancel an order that reconciliation confirms is already paid', () => {
    api.syncPayOS.mockReturnValue(of(orderFixture('PAID')));
    const host = render();
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Hủy đơn')!
      .click();
    fixture!.detectChanges();
    host.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    fixture!.detectChanges();
    expect(api.cancel).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Thanh toán thành công');
  });

  it('stops polling and offers login again on an expired session', () => {
    data.next({ paymentReturn: true });
    query.next(convertToParamMap({ orderCode: '42' }));
    api.syncPayOS.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const host = render();
    expect(host.textContent).toContain('Đăng nhập lại');
    expect(
      host.querySelector<HTMLAnchorElement>('a[href^="/login"]')?.getAttribute('href'),
    ).toContain('returnUrl=%2Fpayment%2Fsuccess%3ForderCode%3D42');
    vi.advanceTimersByTime(60_000);
    expect(api.syncPayOS).toHaveBeenCalledTimes(1);
  });

  it('disposes pending polling when the component is destroyed', () => {
    data.next({ paymentReturn: true });
    query.next(convertToParamMap({ orderCode: '42' }));
    render();
    fixture!.destroy();
    fixture = undefined;
    vi.advanceTimersByTime(60_000);
    expect(api.syncPayOS).toHaveBeenCalledTimes(1);
  });

  it('does not offer checkout for an expired order', () => {
    api.getOwn.mockReturnValue(of({ ...orderFixture(), expiresAt: NOW.toISOString() }));
    const host = render();
    const pay = host.querySelector<HTMLButtonElement>('[data-action="pay"]')!;
    expect(pay.disabled).toBe(true);
    pay.click();
    expect(api.createPayOSCheckout).not.toHaveBeenCalled();
  });

  it('rejects invalid order IDs before making an API request', () => {
    params.next(convertToParamMap({ id: 'not-an-id' }));
    const host = render();
    expect(api.getOwn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Đường dẫn đơn vé không hợp lệ');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-config';
import { OrderApi } from './catalog.api';

const BASE = 'http://localhost:8080/api';

describe('OrderApi PayOS endpoints', () => {
  let api: OrderApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: `${BASE}/` },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(OrderApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates hosted checkout without using the legacy mock payment endpoint', () => {
    const received = vi.fn();
    api.createPayOSCheckout(42).subscribe(received);
    const request = http.expectOne(`${BASE}/orders/42/payos-checkout`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    const checkout = {
      orderId: 42,
      orderCode: 42,
      checkoutUrl: 'https://pay.payos.vn/web/link-42',
      qrCode: 'qr-payload',
      paymentLinkId: 'link-42',
      amount: 200_000,
      status: 'PENDING',
    };
    request.flush(checkout);
    expect(received).toHaveBeenCalledWith(checkout);
    http.expectNone(`${BASE}/orders/42/pay`);
  });

  it('reconciles payment through the dedicated sync endpoint', () => {
    const received = vi.fn();
    api.syncPayOS(42).subscribe(received);
    const request = http.expectOne(`${BASE}/orders/42/payos-sync`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({ id: 42, status: 'PAID' });
    expect(received).toHaveBeenCalledWith({ id: 42, status: 'PAID' });
  });

  it('does not automatically retry a failed checkout creation', () => {
    const error = vi.fn();
    api.createPayOSCheckout(42).subscribe({ error });
    http
      .expectOne(`${BASE}/orders/42/payos-checkout`)
      .flush({ code: 'PAYMENT_LINK_CREATION_FAILED' }, { status: 502, statusText: 'Bad Gateway' });
    expect(error).toHaveBeenCalledTimes(1);
    http.expectNone(`${BASE}/orders/42/payos-checkout`);
  });
});

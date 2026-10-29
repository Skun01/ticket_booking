import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaymentNavigation } from './payment-navigation.service';

describe('PaymentNavigation', () => {
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: { location: { assign } } } }],
    });
  });

  it('opens the hosted checkout returned by the API in the same tab', () => {
    TestBed.inject(PaymentNavigation).openCheckout('https://pay.payos.vn/web/checkout-id');
    expect(assign).toHaveBeenCalledWith('https://pay.payos.vn/web/checkout-id');
  });

  it.each([
    'javascript:alert(1)',
    'http://pay.payos.vn/web/checkout-id',
    '/orders/42',
    'https://user:password@pay.payos.vn/web/checkout-id',
  ])('rejects an unsafe checkout URL: %s', (url) => {
    expect(() => TestBed.inject(PaymentNavigation).openCheckout(url)).toThrow();
    expect(assign).not.toHaveBeenCalled();
  });
});

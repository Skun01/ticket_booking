import { DOCUMENT, inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PaymentNavigation {
  private readonly document = inject(DOCUMENT);

  openCheckout(checkoutUrl: string): void {
    const url = new URL(checkoutUrl);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Invalid checkout URL');
    }
    const window = this.document.defaultView;
    if (!window) throw new Error('Checkout navigation is unavailable');
    window.location.assign(url.href);
  }
}

import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Đưa bàn phím đến vùng xác nhận/editor mới mở; trả về nút mở khi đóng nếu còn dùng được. */
@Directive({ selector: '[appFocusOnShow]', host: { tabindex: '-1' } })
export class FocusOnShow {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  constructor() {
    const previous = this.host.ownerDocument.activeElement;
    afterNextRender(() => this.host.focus());
    inject(DestroyRef).onDestroy(() => {
      if (
        // Angular có thể đã gỡ node trước callback destroy: trình duyệt trả focus về body.
        (this.host.contains(this.host.ownerDocument.activeElement) ||
          this.host.ownerDocument.activeElement === this.host.ownerDocument.body) &&
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !previous.matches(':disabled')
      )
        previous.focus({ preventScroll: true });
    });
  }
}

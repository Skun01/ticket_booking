import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject } from '@angular/core';

/** Fragment href chịu ảnh hưởng của <base>; skip-link chỉ focus main, không điều hướng SPA. */
@Directive({ selector: 'a[appSkipLink]', host: { '(click)': 'skip($event)' } })
export class SkipLink {
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLAnchorElement>>(ElementRef);
  protected skip(event: MouseEvent): void {
    const href = this.element.nativeElement.getAttribute('href');
    if (!href?.startsWith('#')) return;
    const target = this.document.getElementById(href.slice(1));
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}

import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';
import { FeedbackService } from '../shared/feedback.service';

@Injectable({ providedIn: 'root' })
export class NavigationUxService {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  private lastPath = '';
  private focusGeneration = 0;
  readonly navigating = signal(false);
  readonly navigationFailed = signal(false);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        ++this.focusGeneration;
        this.navigationFailed.set(false);
        this.navigating.set(true);
      } else if (event instanceof NavigationEnd) {
        this.navigating.set(false);
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        if (path === this.lastPath) return;
        this.lastPath = path;
        const generation = this.focusGeneration;
        afterNextRender(
          () => {
            if (generation !== this.focusGeneration) return;
            const active = this.document.activeElement;
            // Check-in và các form có thể đã chủ động focus ô nhập ở render này.
            if (
              active?.closest('main') &&
              active.matches('input, textarea, select, [role="combobox"]')
            )
              return;
            const target =
              this.document.querySelector<HTMLElement>('main h1, [role="main"] h1') ??
              this.document.querySelector<HTMLElement>('main, [role="main"]');
            if (target) {
              target.setAttribute('tabindex', '-1');
              target.focus({ preventScroll: true });
            }
          },
          { injector: this.injector },
        );
      } else if (
        event instanceof NavigationCancel ||
        event instanceof NavigationSkipped ||
        event instanceof NavigationError
      ) {
        this.navigating.set(false);
        if (event instanceof NavigationError) {
          this.navigationFailed.set(true);
          this.feedback.problem(
            event.error,
            'Không mở được trang. Vui lòng kiểm tra kết nối rồi tải lại trang.',
            true,
          );
        }
      }
    });
  }
}

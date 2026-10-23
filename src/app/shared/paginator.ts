import { Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { Icon } from './icon';

@Component({
  selector: 'app-paginator',
  imports: [MatButton, Icon],
  template: `
    @if (totalPages() > 1) {
      <nav class="paginator" aria-label="Phân trang">
        <button mat-stroked-button type="button" [disabled]="page() <= 0" (click)="go(page() - 1)">
          <app-icon name="left" /> Trước
        </button>
        <span class="page-info" aria-live="polite" aria-atomic="true"
          >Trang {{ page() + 1 }} / {{ totalPages() }}</span
        >
        <button
          mat-stroked-button
          type="button"
          [disabled]="page() >= totalPages() - 1"
          (click)="go(page() + 1)"
        >
          Sau <app-icon name="right" />
        </button>
      </nav>
    }
  `,
  styles: `
    .paginator {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
    .page-info {
      font-size: 0.9rem;
      color: var(--app-muted);
    }
  `,
})
export class Paginator {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  protected go(next: number): void {
    if (next < 0 || next >= this.totalPages()) return;
    this.pageChange.emit(next);
  }
}

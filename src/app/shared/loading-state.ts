import { Component, input } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-state',
  imports: [MatProgressSpinner],
  host: { role: 'status', 'aria-live': 'polite' },
  template: `<mat-spinner [diameter]="20" aria-hidden="true" /><span>{{ label() }}</span>`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 0;
      color: var(--app-muted);
    }
    mat-spinner {
      flex-shrink: 0;
    }
  `,
})
export class LoadingState {
  readonly label = input('Đang tải dữ liệu…');
}

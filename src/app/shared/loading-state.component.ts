import { Component, input } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-loading-state',
  imports: [MatProgressSpinner, NgxSkeletonLoaderModule],
  host: { role: 'status', 'aria-live': 'polite', 'aria-busy': 'true' },
  templateUrl: './loading-state.component.html',
  styleUrl: './loading-state.component.scss',
})
export class LoadingState {
  readonly label = input('Đang tải dữ liệu…');
  readonly variant = input<'inline' | 'cards' | 'table' | 'detail' | 'form' | 'report'>('inline');
  readonly rows = [0, 1, 2, 3];
  readonly cards = [0, 1, 2];
  readonly line = { height: '14px', marginBottom: '12px', borderRadius: '6px', background: 'var(--app-soft)' };
  readonly short = { ...this.line, width: '55%' };
  readonly banner = { ...this.line, height: '170px', borderRadius: '12px', marginBottom: '20px' };
  readonly field = { ...this.line, height: '52px', marginBottom: '8px', borderRadius: '12px' };
  readonly metric = { ...this.line, height: '100px', borderRadius: '14px' };
  readonly chart = { ...this.line, height: '220px', borderRadius: '14px' };
}

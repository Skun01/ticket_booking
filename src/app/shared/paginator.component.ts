import { Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { Icon } from './icon.component';

@Component({
  selector: 'app-paginator',
  imports: [MatButton, Icon],
  templateUrl: './paginator.component.html',
  
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

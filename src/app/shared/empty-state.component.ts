import { Component, input } from '@angular/core';
import { Icon } from './icon.component';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  templateUrl: './empty-state.component.html',
  
  styles: `
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: .5rem;
      padding: 3rem 1.5rem; text-align: center; color: #5a6168;
    }
    .empty-state app-icon { font-size: 2.5rem; opacity: .5; }
    .empty-state .title { font-weight: 600; font-size: 1.05rem; color: #2b3138; margin: 0; }
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly icon = input('info');
}

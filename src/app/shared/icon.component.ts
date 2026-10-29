import { Component, input } from '@angular/core';

const paths: Record<string, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  home: 'M3 10l9-7 9 7v11h-6v-7H9v7H3z',
  list: 'M9 5h12 M9 12h12 M9 19h12 M3 5h1 M3 12h1 M3 19h1',
  left: 'M20 12H4 M10 6l-6 6 6 6',
  right: 'M4 12h16 M14 6l6 6-6 6',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 6 0 0 1 16 0v2',
  calendar: 'M3 5h18v16H3z M7 2v6 M17 2v6 M3 11h18 M7 15h2 M13 15h2',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',
  mail: 'M3 5h18v14H3z M3 5l9 8 9-8',
  lock: 'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
  compass: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M16 8l-3 5-5 3 3-5z',
  info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 11v6 M12 7v1',
  login: 'M14 3h7v18h-7 M3 12h13 M10 6l6 6-6 6',
  logout: 'M10 3H3v18h7 M10 12h11 M15 6l6 6-6 6',
  check: 'M4 12l5 5L20 6',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  ticket: 'M3 4h18v5a3 3 0 0 0 0 6v5H3v-5a3 3 0 0 0 0-6z M15 4v3 M15 11v2 M15 17v3',
  qr: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h2v2h-2z M21 15v6h-6 M12 3v3 M3 12h6 M12 12h5 M12 18v3',
  shield: 'M12 2l8 3v7c0 5-8 10-8 10S4 17 4 12V5z M8 12l3 3 5-6',
  refresh: 'M20 7V3l-4 4 M20 7A9 9 0 1 0 21 15 M16 7h4',
};

@Component({
  selector: 'app-icon',
  host: { 'aria-hidden': 'true' },
  templateUrl: './icon.component.html',
  
  styles: `:host { display: inline-flex; width: 1.25em; height: 1.25em; flex-shrink: 0; vertical-align: middle; }
    svg { width: 100%; height: 100%; }`,
})
export class Icon {
  readonly name = input('info');
  protected path(): string { return paths[this.name()] || paths['info']; }
}

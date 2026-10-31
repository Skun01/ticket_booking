import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionService } from './core/auth/session.service';
import { NavigationUxService } from './core/navigation-ux.service';
import { MatProgressBar } from '@angular/material/progress-bar';

@Component({
  imports: [RouterOutlet, MatProgressBar],
  selector: 'app-root',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class App {
  protected readonly session = inject(SessionService);
  protected readonly navigation = inject(NavigationUxService);
  protected reload(): void {
    window.location.reload();
  }

  constructor() {
    void this.session.initialize();
  }
}

import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon.component';
import { SessionService } from '../../core/auth/session.service';
import { homeRouteFor } from '../../core/auth/home-route';

@Component({
  selector: 'app-status-page',
  host: {
    '[attr.role]': 'standalone ? "main" : null',
    '[attr.tabindex]': 'standalone ? -1 : null',
  },
  imports: [RouterLink, Icon],
  templateUrl: './status-page.component.html',
  
})
export class StatusPage {
  protected readonly session = inject(SessionService);
  protected readonly homeRouteFor = homeRouteFor;
  protected readonly data = inject(ActivatedRoute).snapshot.data;
  protected readonly standalone = inject(ActivatedRoute).snapshot.routeConfig?.path === '**';
}

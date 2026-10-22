import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-status-page',
  imports: [RouterLink, Icon],
  template: `
    <section class="empty-state" aria-labelledby="status-title">
      <span class="status-icon"><app-icon [name]="data['icon'] || 'info'" /></span>
      <p class="eyebrow">{{ data['label'] || 'THÔNG BÁO' }}</p>
      <h1 id="status-title">{{ data['title'] || 'Thông báo' }}</h1>
      <p>{{ data['description'] || 'Trang bạn tìm kiếm không tồn tại hoặc bạn không có quyền truy cập.' }}</p>
      <a class="text-link" routerLink="/">Về trang chủ <app-icon name="right" /></a>
    </section>
  `,
})
export class StatusPage {
  protected readonly data = inject(ActivatedRoute).snapshot.data;
}

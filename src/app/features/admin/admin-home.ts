import { Component, inject } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'app-admin-home',
  template: `
    <p class="eyebrow">KHU VỰC HỆ THỐNG</p>
    <h1>Không gian quản trị</h1>
    <p class="lead">Trang quản trị tổng quan. Sẵn sàng tích hợp các module và tính năng nghiệp vụ mới.</p>

    <section class="panel" aria-labelledby="profile-title">
      <h2 id="profile-title">Thông tin tài khoản quản trị</h2>
      <dl class="profile-details">
        <div><dt>Họ tên</dt><dd>{{ session.user()?.fullName }}</dd></div>
        <div><dt>Email</dt><dd>{{ session.user()?.email }}</dd></div>
        <div><dt>Vai trò</dt><dd>{{ session.user()?.role }}</dd></div>
      </dl>
    </section>

    <section class="panel">
      <h2>Sẵn sàng phát triển module mới</h2>
      <p class="muted">
        Cấu trúc dự án và tầng xác thực phân quyền đã hoàn tất. Bạn có thể bắt đầu tạo thêm các module quản trị,
        bảng dữ liệu, biểu mẫu và API nghiệp vụ tại đây.
      </p>
    </section>
  `,
})
export class AdminHome {
  protected readonly session = inject(SessionService);
}

import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { customerGuard } from './core/auth/customer.guard';
import { organizerGuard } from './core/auth/organizer.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/public-layout.component').then((m) => m.PublicLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Trang chủ · Vévui',
        loadComponent: () => import('./features/home/home-page.component').then((m) => m.HomePage),
      },
      {
        path: 'login',
        title: 'Đăng nhập · Vévui',
        loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'Đăng ký · Vévui',
        loadComponent: () => import('./features/auth/register-page.component').then((m) => m.RegisterPage),
      },
      {
        path: 'events',
        title: 'Sự kiện · Vévui',
        loadComponent: () => import('./features/events/events-page.component').then((m) => m.EventsPage),
      },
      {
        path: 'events/:id/book',
        canActivate: [customerGuard],
        title: 'Đặt vé · Vévui',
        loadComponent: () => import('./features/events/booking-page.component').then((m) => m.BookingPage),
      },
      {
        path: 'orders',
        canActivate: [customerGuard],
        title: 'Đơn của tôi · Vévui',
        loadComponent: () => import('./features/orders/orders-page.component').then((m) => m.OrdersPage),
      },
      {
        path: 'payment',
        canActivate: [customerGuard],
        title: 'Thanh toán · Vévui',
        data: { paymentPage: true },
        loadComponent: () =>
          import('./features/orders/order-detail-page.component').then((m) => m.OrderDetailPage),
      },
      {
        path: 'payment/success',
        canActivate: [customerGuard],
        title: 'Kết quả thanh toán · Vévui',
        data: { paymentReturn: true },
        loadComponent: () =>
          import('./features/orders/order-detail-page.component').then((m) => m.OrderDetailPage),
      },
      {
        path: 'payment/cancel',
        canActivate: [customerGuard],
        title: 'Quay lại từ PayOS · Vévui',
        data: { paymentReturn: true, paymentCancelled: true },
        loadComponent: () =>
          import('./features/orders/order-detail-page.component').then((m) => m.OrderDetailPage),
      },
      {
        path: 'orders/:id',
        canActivate: [customerGuard],
        title: 'Chi tiết đơn vé · Vévui',
        loadComponent: () =>
          import('./features/orders/order-detail-page.component').then((m) => m.OrderDetailPage),
      },
      {
        path: 'tickets',
        canActivate: [customerGuard],
        title: 'Vé của tôi · Vévui',
        loadComponent: () => import('./features/tickets/tickets-page.component').then((m) => m.TicketsPage),
      },
      {
        path: 'events/:id',
        title: 'Chi tiết sự kiện · Vévui',
        loadComponent: () =>
          import('./features/events/event-detail-page.component').then((m) => m.EventDetailPage),
      },
      {
        path: 'forbidden',
        title: 'Không đủ quyền · Vévui',
        loadComponent: () => import('./features/status/status-page.component').then((m) => m.StatusPage),
        data: {
          title: 'Bạn không có quyền truy cập',
          label: '403 · KHÔNG ĐỦ QUYỀN',
          description: 'Khu vực này yêu cầu vai trò phù hợp. Vui lòng quay lại trang chủ.',
          icon: 'lock',
        },
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    loadComponent: () => import('./layout/admin-layout.component').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Quản trị · Vévui',
        loadComponent: () => import('./features/admin/admin-home.component').then((m) => m.AdminHome),
      },
      {
        path: 'categories',
        title: 'Quản lý danh mục · Vévui',
        data: { catalog: 'categories' },
        loadComponent: () =>
          import('./features/admin/admin-catalog-page.component').then((m) => m.AdminCatalogPage),
      },
      {
        path: 'venues',
        title: 'Quản lý địa điểm · Vévui',
        data: { catalog: 'venues' },
        loadComponent: () =>
          import('./features/admin/admin-catalog-page.component').then((m) => m.AdminCatalogPage),
      },
      {
        path: 'reports',
        title: 'Báo cáo doanh thu · Vévui',
        loadComponent: () =>
          import('./features/admin/admin-reports-page.component').then((m) => m.AdminReportsPage),
      },
    ],
  },
  {
    path: 'organizer',
    canActivate: [organizerGuard],
    canActivateChild: [organizerGuard],
    loadComponent: () => import('./layout/organizer-layout.component').then((m) => m.OrganizerLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Sự kiện của tôi · Vévui',
        loadComponent: () =>
          import('./features/organizer/organizer-events-page.component').then((m) => m.OrganizerEventsPage),
      },
      {
        path: 'checkin',
        title: 'Check-in vé · Vévui',
        loadComponent: () =>
          import('./features/organizer/organizer-checkin-page.component').then((m) => m.OrganizerCheckInPage),
      },
      {
        path: 'events/new',
        title: 'Tạo sự kiện · Vévui',
        loadComponent: () =>
          import('./features/organizer/organizer-event-form-page.component').then(
            (m) => m.OrganizerEventFormPage,
          ),
      },
      {
        path: 'events/:id/edit',
        title: 'Sửa sự kiện · Vévui',
        loadComponent: () =>
          import('./features/organizer/organizer-event-form-page.component').then(
            (m) => m.OrganizerEventFormPage,
          ),
      },
      {
        path: 'events/:id/report',
        title: 'Báo cáo sự kiện · Vévui',
        loadComponent: () =>
          import('./features/organizer/organizer-event-report-page.component').then(
            (m) => m.OrganizerEventReportPage,
          ),
      },
      {
        path: 'events/:id',
        title: 'Quản lý sự kiện · Vévui',
        loadComponent: () =>
          import('./features/organizer/organizer-event-detail-page.component').then(
            (m) => m.OrganizerEventDetailPage,
          ),
      },
    ],
  },
  {
    path: '**',
    title: 'Không tìm thấy trang · Vévui',
    loadComponent: () => import('./features/status/status-page.component').then((m) => m.StatusPage),
    data: {
      title: 'Không tìm thấy trang',
      label: '404 · KHÔNG TÌM THẤY',
      description: 'Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.',
      icon: 'compass',
    },
  },
];

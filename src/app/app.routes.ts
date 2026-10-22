import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { customerGuard } from './core/auth/customer.guard';
import { organizerGuard } from './core/auth/organizer.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/public-layout').then((m) => m.PublicLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Trang chủ · Fullstack Starter',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'login',
        title: 'Đăng nhập · Fullstack Starter',
        loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'Đăng ký · Fullstack Starter',
        loadComponent: () => import('./features/auth/register-page').then((m) => m.RegisterPage),
      },
      {
        path: 'events',
        title: 'Sự kiện · Fullstack Starter',
        loadComponent: () => import('./features/events/events-page').then((m) => m.EventsPage),
      },
      {
        path: 'events/:id/book',
        canActivate: [customerGuard],
        title: 'Đặt vé · Fullstack Starter',
        loadComponent: () => import('./features/events/booking-page').then((m) => m.BookingPage),
      },
      {
        path: 'orders',
        canActivate: [customerGuard],
        title: 'Đơn của tôi · Fullstack Starter',
        loadComponent: () => import('./features/orders/orders-page').then((m) => m.OrdersPage),
      },
      {
        path: 'orders/:id',
        canActivate: [customerGuard],
        title: 'Chi tiết đơn vé · Fullstack Starter',
        loadComponent: () =>
          import('./features/orders/order-detail-page').then((m) => m.OrderDetailPage),
      },
      {
        path: 'tickets',
        canActivate: [customerGuard],
        title: 'Vé của tôi · Fullstack Starter',
        loadComponent: () => import('./features/tickets/tickets-page').then((m) => m.TicketsPage),
      },
      {
        path: 'events/:id',
        title: 'Chi tiết sự kiện · Fullstack Starter',
        loadComponent: () =>
          import('./features/events/event-detail-page').then((m) => m.EventDetailPage),
      },
      {
        path: 'forbidden',
        title: 'Không đủ quyền · Fullstack Starter',
        loadComponent: () => import('./features/status/status-page').then((m) => m.StatusPage),
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
    loadComponent: () => import('./layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Quản trị · Fullstack Starter',
        loadComponent: () => import('./features/admin/admin-home').then((m) => m.AdminHome),
      },
    ],
  },
  {
    path: 'organizer',
    canActivate: [organizerGuard],
    canActivateChild: [organizerGuard],
    loadComponent: () => import('./layout/organizer-layout').then((m) => m.OrganizerLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Sự kiện của tôi · Fullstack Starter',
        loadComponent: () =>
          import('./features/organizer/organizer-events-page').then((m) => m.OrganizerEventsPage),
      },
      {
        path: 'checkin',
        title: 'Check-in vé · Fullstack Starter',
        loadComponent: () =>
          import('./features/organizer/organizer-checkin-page').then((m) => m.OrganizerCheckInPage),
      },
      {
        path: 'events/new',
        title: 'Tạo sự kiện · Fullstack Starter',
        loadComponent: () =>
          import('./features/organizer/organizer-event-form-page').then(
            (m) => m.OrganizerEventFormPage,
          ),
      },
      {
        path: 'events/:id/edit',
        title: 'Sửa sự kiện · Fullstack Starter',
        loadComponent: () =>
          import('./features/organizer/organizer-event-form-page').then(
            (m) => m.OrganizerEventFormPage,
          ),
      },
      {
        path: 'events/:id/report',
        title: 'Báo cáo sự kiện · Fullstack Starter',
        loadComponent: () =>
          import('./features/organizer/organizer-event-report-page').then(
            (m) => m.OrganizerEventReportPage,
          ),
      },
      {
        path: 'events/:id',
        title: 'Quản lý sự kiện · Fullstack Starter',
        loadComponent: () =>
          import('./features/organizer/organizer-event-detail-page').then(
            (m) => m.OrganizerEventDetailPage,
          ),
      },
    ],
  },
  {
    path: '**',
    title: 'Không tìm thấy trang · Fullstack Starter',
    loadComponent: () => import('./features/status/status-page').then((m) => m.StatusPage),
    data: {
      title: 'Không tìm thấy trang',
      label: '404 · KHÔNG TÌM THẤY',
      description: 'Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.',
      icon: 'compass',
    },
  },
];

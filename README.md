# Frontend Base Starter

Base project Angular 22 với Angular Material, kiến trúc standalone components, kết nối backend Spring Boot và xử lý xác thực phiên đăng nhập bằng JWT Bearer + Refresh Token HttpOnly Cookie.

## Công nghệ

- Angular 22 (Standalone Components)
- Angular Material
- TypeScript ~6.0, RxJS ~7.8
- Testing: Vitest

## Lệnh chạy

```bash
# Cài đặt dependencies (nếu chưa có)
npm install

# Chạy dev server
npm start
# hoặc
ng serve
```

Ứng dụng khởi chạy tại `http://localhost:4200` và kết nối API tại `http://localhost:8080/api`.

## Chạy unit test

```bash
npm test
```

## Cấu trúc thư mục

```
src/
├── app/
│   ├── core/
│   │   ├── api/          # api-config (API_BASE_URL), api-error (RFC 9457 ProblemDetail mapping)
│   │   └── auth/         # session.service, auth.interceptor, admin.guard, auth.guard
│   ├── features/
│   │   ├── home/         # HomePage
│   │   ├── auth/         # LoginPage, RegisterPage
│   │   ├── admin/        # AdminHome
│   │   └── status/       # StatusPage (403, 404)
│   ├── layout/           # PublicLayout, AdminLayout
│   ├── shared/           # Icon component và các component dùng chung
│   ├── app.config.ts     # Router, HttpClient với authInterceptor
│   ├── app.routes.ts     # Định tuyến ứng dụng
│   ├── app.ts            # Root component khởi tạo session
│   ├── app.html
│   └── app.scss
├── styles.scss           # Theme Material, biến màu, CSS tiện ích
└── main.ts               # Điểm khởi động ứng dụng
```

## Luồng xác thực mặc định

- `session.service.ts`: Khởi tạo và khôi phục phiên từ refresh token trong cookie khi app tải, tự động gọi `/api/auth/refresh` và tải thông tin `/api/users/me`.
- `auth.interceptor.ts`: Tự động gắn header `Authorization: Bearer <accessToken>` cho các request API, xử lý xoay token khi nhận lỗi 401.
- `admin.guard.ts`: Bảo vệ các route `/admin/**`, yêu cầu user có vai trò `ADMIN`.
- `auth.guard.ts`: Bảo vệ các route yêu cầu đăng nhập.

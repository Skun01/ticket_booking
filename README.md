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

## Thanh toán PayOS

Luồng khách hàng: tạo đơn → `/payment?orderCode={id}` → **Thanh toán qua PayOS** → trang thanh toán PayOS → quay lại frontend để đối soát kết quả. Trang `/orders/{id}` vẫn mở được thông tin và thao tác thanh toán của đơn.

Mở `/payment` khi chưa chọn đơn sẽ hiển thị hướng dẫn đến **Đơn của tôi** hoặc chọn sự kiện, không tự tạo đơn hay liên kết thanh toán. Trang thanh toán có tóm tắt vé, tổng tiền và thời gian giữ chỗ; trên mobile, số tiền và thao tác thanh toán được ưu tiên trước phần chi tiết đơn.

- Tạo liên kết bằng `POST /api/orders/{id}/payos-checkout`; không dùng API thanh toán MOCK `/pay`.
- Hai route `/payment/success` và `/payment/cancel` nhận query `orderCode` (ID số của đơn). Query `id` là ID liên kết PayOS, **không phải ID đơn**.
- Frontend khôi phục phiên đăng nhập rồi gọi `POST /api/orders/{id}/payos-sync`. Chỉ hiển thị thành công khi backend trả `status: PAID`, không tin `status`/`code` trong query URL.
- Khi quay lại `/payment/success`, đối soát tối đa 10 lần, cách nhau 3 giây sau mỗi phản hồi còn chờ; dừng khi có kết quả, có lỗi hoặc đơn hết hạn. Với `/payment/cancel`, chỉ đối soát một lần rồi kết thúc trạng thái chờ, không polling tiếp. Nút **Cập nhật đơn** cho phép đối soát thủ công.
- Quay lại từ trang hủy PayOS không tự hủy đơn vé. Người dùng phải xác nhận hủy đơn riêng; không hủy nếu đã chuyển tiền. Backend hiện không tự hủy liên kết PayOS/hoàn tiền khi hủy đơn vé.
- Không tự gửi lại yêu cầu tạo checkout sau lỗi mạng/timeout. Yêu cầu có thể đã tạo liên kết ở máy chủ; cần cập nhật đơn trước khi chủ động thử lại.

Cấu hình trong **backend**, không đặt khóa PayOS trong frontend:

```dotenv
PAYOS_RETURN_URL=http://localhost:4200/payment/success
PAYOS_CANCEL_URL=http://localhost:4200/payment/cancel
```

Backend còn cần `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` và `CORS_ALLOWED_ORIGINS` cho origin frontend. Đặt rõ hai URL trên vì một số giá trị mẫu backend dùng cổng 5173, trong khi Angular chạy cổng 4200. Khi triển khai, thay bằng origin HTTPS thực tế và cấu hình web server phục vụ `index.html` cho các deep link `/payment/**`.

Cấu hình webhook trên PayOS trỏ đến backend công khai: `https://<backend-host>/api/payments/payos/webhook`. Webhook là kết nối server-to-server; frontend không gọi webhook và không cần cài PayOS SDK.

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

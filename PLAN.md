# Kế hoạch xây dựng UI/UX Frontend

Nền tảng **bán vé sự kiện** (event ticketing). Backend đã có đầy đủ API; frontend hiện tại mới là
starter template (home/login/register/admin-home, mô hình role USER/ADMIN). Kế hoạch này xây dựng UI/UX
cho toàn bộ nghiệp vụ, bám sát các controller hiện có.

---

## 0. Bối cảnh & khoảng trống hiện tại

**Backend roles:** `ADMIN`, `ORGANIZER`, `CUSTOMER` (enum `Role`).
**Frontend hiện tại:** `SessionService.CurrentUser.role` mới chỉ có `'USER' | 'ADMIN'`, guard chỉ có
`adminGuard`. Đây là khoảng trống đầu tiên phải xử lý trước mọi tính năng nghiệp vụ.

**Bản đồ API → vai trò người dùng:**

| Nhóm API                                                                       | Vai trò              | Chức năng chính                             |
| ------------------------------------------------------------------------------ | -------------------- | ------------------------------------------- |
| `/api/auth/*`, `/api/users/me`                                                 | Công khai / mọi user | Đăng ký, đăng nhập, phiên                   |
| `/api/events`, `/api/events/{id}`                                              | Công khai            | Duyệt & xem chi tiết sự kiện                |
| `/api/orders/*`, `/api/tickets/*`                                              | CUSTOMER             | Đặt vé, thanh toán, hủy, vé của tôi, PDF vé |
| `/api/organizer/events/*`, `/api/ticket-types/{id}`, `/api/organizer/checkin`  | ORGANIZER            | Quản lý sự kiện, hạng vé, check-in, báo cáo |
| `/api/admin/categories/*`, `/api/admin/venues/*`, `/api/admin/reports/revenue` | ADMIN                | Danh mục, địa điểm, báo cáo doanh thu       |

---

## Phase 0 — (Backend) Endpoint công khai đọc danh mục & địa điểm

> **Quyết định đã chốt:** xử lý theo _hướng 1_ — bổ sung 2 endpoint read-only không yêu cầu quyền.
> Đây là điều kiện tiên quyết cho bộ lọc sự kiện công khai (Phase 2) và form tạo sự kiện của
> organizer (Phase 4). Là thay đổi backend nằm ngoài controller hiện có, đã được xác nhận.

1. Thêm `GET /api/categories` — trả danh sách danh mục (dùng lại `CategoryService`, `CategoryResponse`).
2. Thêm `GET /api/venues` — trả danh sách địa điểm (dùng lại `VenueService`, `VenueResponse`); cân nhắc
   lọc `?city=` phục vụ bộ lọc sự kiện.
3. Cả hai đặt `@SecurityRequirements` (public, giống `EventController`), chỉ đọc, phân trang hoặc trả
   danh sách gọn tùy nhu cầu dropdown.
4. Giữ nguyên các endpoint quản trị `/api/admin/categories`, `/api/admin/venues` cho thao tác ghi (ADMIN).

**Deliverable:** organizer và khách vãng lai đọc được danh mục/địa điểm mà không cần quyền ADMIN.

---

## Phase 1 — Nền tảng: role model, core API layer, guards, điều hướng

Mục tiêu: chuẩn hóa hạ tầng trước khi dựng màn hình nghiệp vụ.

1. **Cập nhật mô hình role** trong `core/auth/session.service.ts`:
   - Đổi `CurrentUser.role` thành `'ADMIN' | 'ORGANIZER' | 'CUSTOMER'`.
   - Bổ sung computed: `isOrganizer`, `isCustomer` (giữ `isAdmin`).
   - Bổ sung field `phone`, `status` theo `UserResponse`.
2. **Guards theo vai trò** (`core/auth/`):
   - `auth.guard.ts` (đã có) — yêu cầu đăng nhập.
   - Thêm `organizer.guard.ts`, `customer.guard.ts` (và giữ `admin.guard.ts`).
   - Redirect về `/forbidden` khi sai quyền (tái dùng StatusPage 403).
3. **Core API services** dùng chung `HttpClient` + interceptor sẵn có (`core/api/`):
   - Tạo type/interface khớp DTO backend: `Event`, `EventDetail`, `TicketType`, `Order`, `OrderItem`,
     `Ticket`, `Category`, `Venue`, `PageResponse<T>`, các enum (`EventStatus`, `OrderStatus`,
     `TicketStatus`, `PaymentMethod`).
   - Service theo domain: `EventApi`, `OrderApi`, `TicketApi`, `OrganizerApi`, `AdminCatalogApi`,
     `ReportApi`. Mỗi service bọc đúng endpoint controller.
   - Helper tải file nhị phân (PDF vé / báo cáo) qua `responseType: 'blob'`.
4. **Shared UI primitives** (`shared/`): mở rộng `Icon`, thêm `PageHeader`, `EmptyState`,
   `StatusBadge` (map enum → nhãn + màu), `Paginator` (bọc `PageResponse`), `MoneyPipe` (định dạng
   tiền), `DateTimePipe` (hiển thị `Instant`).
5. **Khung điều hướng theo vai trò**: cập nhật `public-layout` để hiện link theo `isCustomer`/
   `isOrganizer`/`isAdmin`. Tạo `organizer-layout` (song song `admin-layout`).

**Deliverable:** build sạch, phiên đăng nhập nhận đúng 3 vai trò, guard điều hướng đúng, chưa có màn
hình nghiệp vụ mới.

---

## Phase 2 — Khách (CUSTOMER): duyệt sự kiện công khai

Phục vụ API công khai `/api/events`. Không cần đăng nhập.

1. **Trang danh sách sự kiện** `/events`:
   - Lưới card sự kiện (banner, tiêu đề, thời gian, địa điểm/thành phố, danh mục).
   - Bộ lọc: danh mục (`categoryId`), thành phố (`city`), khoảng thời gian (`from`/`to`).
   - Phân trang (`page`, `size`) qua component `Paginator`.
   - Trạng thái rỗng / đang tải / lỗi.
2. **Trang chi tiết sự kiện** `/events/:id`:
   - Banner lớn, mô tả, thời gian, địa điểm (tên + địa chỉ + thành phố).
   - Danh sách hạng vé: tên, giá, số lượng còn (`availableQuantity`), `maxPerOrder`, thời gian mở bán.
   - CTA "Đặt vé" trên mỗi hạng vé → chuyển vào luồng đặt vé (Phase 3). Nếu chưa đăng nhập → điều
     hướng `/login` kèm returnUrl.
3. Cập nhật **HomePage**: thay nội dung starter bằng hero giới thiệu + sự kiện nổi bật (gọi trang
   danh sách với size nhỏ), CTA "Khám phá sự kiện".

**Deliverable:** khách vãng lai duyệt, lọc, xem chi tiết sự kiện mượt mà.

---

## Phase 3 — Khách (CUSTOMER): đặt vé, thanh toán, vé của tôi

Phục vụ `/api/orders/*` và `/api/tickets/*`. Yêu cầu đăng nhập (customerGuard).

1. **Luồng đặt vé** (từ chi tiết sự kiện):
   - Chọn hạng vé + số lượng (ràng buộc `maxPerOrder`, `availableQuantity`).
   - `POST /api/orders` → nhận `OrderResponse` (có `expiresAt` giữ chỗ) → chuyển sang trang thanh toán.
2. **Trang đơn vé / thanh toán** `/orders/:id`:
   - Hiển thị chi tiết đơn (`items`, `totalAmount`, `discountAmount`, trạng thái, đồng hồ đếm ngược
     tới `expiresAt`).
   - Nếu `PENDING`: nút "Thanh toán" (`POST /{id}/pay`, mock) và "Hủy đơn" (`POST /{id}/cancel`).
   - Tùy chọn mô phỏng thất bại (`simulateFailure`) để test UX lỗi.
   - Sau khi `PAID`: hiện link tới vé của tôi.
3. **Trang "Đơn của tôi"** `/orders`: danh sách `GET /orders/my` (phân trang), badge trạng thái, lọc
   nhanh theo trạng thái ở client.
4. **Trang "Vé của tôi"** `/tickets`:
   - `GET /tickets/my` (phân trang): mã vé, sự kiện, thời gian, hạng vé, trạng thái (`VALID/USED/CANCELLED`).
   - Nút "Tải vé PDF" → `GET /tickets/{id}/pdf` (blob, có QR).

**Deliverable:** vòng đời đầy đủ đặt → thanh toán/hủy → nhận vé → tải PDF.

---

## Phase 4 — Nhà tổ chức (ORGANIZER): quản lý sự kiện & hạng vé

Phục vụ `/api/organizer/events/*` và `/api/ticket-types/{id}`. organizerGuard + `organizer-layout`.

1. **Dashboard tổ chức** `/organizer`: danh sách sự kiện của tôi (`GET /organizer/events`, phân trang),
   badge `EventStatus`, nút tạo mới.
2. **Tạo / sửa sự kiện** `/organizer/events/new`, `/organizer/events/:id/edit`:
   - Form theo `EventRequest`: danh mục, địa điểm, tiêu đề, mô tả, banner URL, thời gian bắt đầu
     (`@Future`) / kết thúc.
   - Danh mục & địa điểm: dùng `GET /api/categories` và `GET /api/venues` công khai đã bổ sung ở
     Phase 0; tải đầy đủ các trang cho dropdown, không gọi API quản trị.
3. **Chi tiết sự kiện (quản lý)** `/organizer/events/:id`:
   - Thông tin sự kiện + đổi trạng thái (`PATCH /{id}/status`: DRAFT→PUBLISHED→ENDED/CANCELLED).
   - Quản lý hạng vé: `GET /{id}/ticket-types`, tạo (`POST /{id}/ticket-types`), sửa
     (`PUT /api/ticket-types/{id}`) theo `TicketTypeRequest` (giá, tổng số lượng, max/đơn, thời gian bán).
4. **Báo cáo sự kiện**: `GET /organizer/events/{id}/report` (số đơn đã trả, vé đã bán, doanh thu,
   doanh thu theo ngày → biểu đồ cột/line đơn giản). Nút tải PDF `GET /{id}/report/pdf`.

**Deliverable:** organizer tạo sự kiện, cấu hình hạng vé, phát hành, xem báo cáo.

---

## Phase 5 — Nhà tổ chức: check-in vé

Phục vụ `/api/organizer/checkin`.

1. **Trang check-in** `/organizer/checkin`:
   - Ô nhập mã vé (`ticketCode`) + nút check-in → `POST /organizer/checkin`.
   - Hiển thị kết quả `TicketResponse` (trạng thái chuyển `VALID → USED`, thời gian check-in, sự kiện).
   - UX quét nhanh: giữ focus input, báo lỗi rõ (vé sai, đã dùng, không thuộc sự kiện của tôi).
   - (Tùy chọn, ngoài scope bắt buộc) quét QR bằng camera — chỉ thêm nếu được yêu cầu.

**Deliverable:** màn hình check-in dùng được tại cổng sự kiện.

---

## Phase 6 — Quản trị (ADMIN): danh mục, địa điểm, báo cáo doanh thu

Phục vụ `/api/admin/*`. adminGuard + `admin-layout` sẵn có.

1. **Quản lý danh mục** `/admin/categories`: bảng + phân trang (`GET`), tạo/sửa (`name`, `slug` theo
   pattern), xóa (`DELETE`) với xác nhận.
2. **Quản lý địa điểm** `/admin/venues`: tương tự (`name`, `address`, `city`, `capacity`).
3. **Báo cáo doanh thu toàn hệ thống** `/admin/reports`:
   - `GET /admin/reports/revenue?from&to`: tổng đơn đã trả, doanh thu, doanh thu theo ngày, top sự
     kiện. Chọn khoảng thời gian + biểu đồ + bảng top events.
4. Thay `admin-home` starter bằng dashboard tổng quan (link nhanh tới 3 mục trên + vài số liệu).

**Deliverable:** admin quản trị catalog và xem báo cáo.

---

## Phase 7 — Hoàn thiện UX xuyên suốt

1. **Xử lý lỗi & thông báo**: dùng `api-error` (RFC 9457 ProblemDetail) → toast/snackbar nhất quán;
   thông báo thành công cho các hành động ghi.
2. **Trạng thái tải**: skeleton/spinner cho danh sách & chi tiết; disable nút khi submit.
3. **Responsive & a11y**: lưới card co giãn, bảng cuộn ngang trên mobile; giữ skip-link, focus state,
   aria-label (đã có nền tảng trong layout).
4. **Điều hướng theo vai trò**: menu, trang chủ và redirect sau đăng nhập tùy biến theo vai trò.
5. **Tiêu đề trang & routing**: đặt `title` cho mọi route; `returnUrl` sau đăng nhập.

**Trạng thái Phase 7: đã triển khai và xác minh frontend (23/10/2026).**

- Dùng Angular Material snackbar qua `FeedbackService`; giữ lỗi/validation tại form để không mất
  thông tin khi đóng snackbar. Chỉ báo thành công thao tác ghi sau phản hồi backend xác nhận.
- Spinner dùng chung cho danh sách/chi tiết, giới hạn chờ API 30 giây, không tự replay thao tác ghi.
- Hoàn thiện skip-link không đổi route, focus khi chuyển trang/mở và đóng vùng xác nhận,
  `aria-current`, bảng cuộn bằng bàn phím và menu mobile với tên người dùng dài; giữ palette xám.
- Trang chủ, login/register và trang lỗi dẫn đúng vai trò; giữ query trong `returnUrl` hợp lệ,
  từ chối đích ngoài whitelist; có thông báo và nút tải lại khi lazy route bị lỗi.
- Production build, TypeScript và `git diff --check` đạt. Chrome headless với API giả lập:
  UX Phase 7 (78 requests), hồi quy Phase 3–6 (63 + 83 + 27 + 76 requests) đều đạt;
  kiểm tra mobile 320/390px, timeout, keyboard focus/scroll, lỗi phiên và không replay POST.
- **Giới hạn:** chưa xác minh tích hợp backend thật; smoke script ở thư mục tạm, không ghi dữ liệu
  backend thật. Không thêm dependency, không thay đổi backend trong Phase 7.

---

## Phụ thuộc & quyết định cần chốt trước khi code

1. **Nguồn categories/venues cho ORGANIZER và trang lọc công khai.** ✅ **ĐÃ CHỐT — hướng 1:** bổ sung
   endpoint công khai read-only (`GET /api/categories`, `GET /api/venues`) ở backend. Chi tiết tại
   **Phase 0**.
2. **Điều hướng mặc định sau đăng nhập.** ✅ **ĐÃ CHỐT — theo vai trò:** customer → `/events`,
   organizer → `/organizer`, admin → `/admin`.
3. **Thư viện biểu đồ** cho báo cáo (Phase 4 & 6). ✅ **ĐÃ CHỐT — Chart.js 4**, dùng trực tiếp
   không thêm wrapper Angular. Biểu đồ cột kèm bảng dữ liệu để đọc bằng bàn phím/screen reader.

---

## Thứ tự triển khai đề xuất

Phase 0 (backend, tiên quyết) → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7.
Mỗi phase build sạch và chạy được trước khi sang phase kế tiếp.

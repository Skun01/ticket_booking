import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export interface ApiProblem {
  code?: string;
  status?: number;
  errors?: { field: string; message: string }[];
}

export interface FormApiError {
  message: string;
  fields: Record<string, string>;
}

const fieldMessages: Record<string, string> = {
  email: 'Vui lòng nhập email hợp lệ.',
  password: 'Vui lòng kiểm tra mật khẩu.',
  fullName: 'Vui lòng nhập họ và tên.',
  quantity: 'Số lượng vé không hợp lệ.',
  ticketTypeId: 'Vui lòng chọn hạng vé hợp lệ.',
  ticketCode: 'Mã vé phải từ 1 đến 40 ký tự, không chỉ gồm khoảng trắng.',
};

const codeMessages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không chính xác.',
  EMAIL_ALREADY_REGISTERED: 'Email này đã được đăng ký trong hệ thống.',
  USER_NOT_FOUND: 'Không tìm thấy thông tin người dùng.',
  INVALID_REFRESH_TOKEN: 'Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
  UNAUTHORIZED: 'Yêu cầu đăng nhập để tiếp tục.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  VALIDATION_FAILED: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
  INTERNAL_ERROR: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
  ORDER_NOT_FOUND: 'Không tìm thấy đơn vé.',
  ORDER_NOT_OWNED: 'Bạn không có quyền xem hoặc thao tác với đơn vé này.',
  CUSTOMER_INACTIVE: 'Tài khoản khách hàng không hoạt động.',
  INVALID_ORDER_QUANTITY: 'Số lượng phải từ 1 đến 100 và không vượt giới hạn của hạng vé.',
  EVENT_NOT_BOOKABLE: 'Sự kiện không còn nhận đặt vé hoặc thanh toán.',
  SALE_NOT_OPEN: 'Hạng vé chưa mở bán hoặc đã ngừng bán.',
  SOLD_OUT: 'Không đủ vé cho số lượng đã chọn. Vui lòng quay lại sự kiện để cập nhật tồn kho.',
  INVENTORY_CONFLICT: 'Chưa cập nhật được tồn kho. Vui lòng kiểm tra lại đơn.',
  ORDER_NOT_PENDING: 'Đơn không còn ở trạng thái chờ thanh toán. Vui lòng cập nhật đơn.',
  ORDER_EXPIRED: 'Đơn đã hết thời hạn giữ chỗ. Vui lòng đặt đơn mới.',
  PAYMENT_DECLINED:
    'Thanh toán giả lập thất bại. Đơn chưa được thanh toán; bạn có thể tắt mô phỏng thất bại và thử lại khi còn hạn.',
  TICKET_NOT_FOUND: 'Không tìm thấy vé.',
  TICKET_NOT_OWNED: 'Bạn không có quyền tải vé này.',
  TICKET_NOT_OWNED_BY_ORGANIZER: 'Vé không thuộc sự kiện do bạn tổ chức. Không thể check-in.',
  TICKET_ALREADY_USED: 'Vé đã được check-in trước đó. Không cho sử dụng lại vé.',
  TICKET_NOT_VALID: 'Vé không hợp lệ hoặc đơn vé chưa được thanh toán. Không thể check-in.',
  EVENT_NOT_OPEN_FOR_CHECKIN:
    'Sự kiện đã hủy, đã kết thúc hoặc chưa được công bố. Không thể check-in.',
  PDF_GENERATION_FAILED: 'Chưa tạo được PDF vé. Vui lòng thử lại sau.',
  QR_GENERATION_FAILED: 'Chưa tạo được mã QR của vé. Vui lòng thử lại sau.',
  EVENT_NOT_FOUND: 'Không tìm thấy sự kiện.',
  EVENT_NOT_OWNED: 'Sự kiện này không thuộc tài khoản tổ chức của bạn.',
  INVALID_EVENT_TIME: 'Giờ kết thúc phải sau giờ bắt đầu.',
  INVALID_EVENT_FILTER_TIME: 'Khoảng thời gian lọc không hợp lệ.',
  INVALID_STATUS_TRANSITION: 'Không thể đổi trạng thái như đã chọn. Vui lòng cập nhật sự kiện.',
  EVENT_NOT_EDITABLE: 'Chỉ sự kiện nháp được sửa thông tin và hạng vé. Vui lòng cập nhật lại.',
  EVENT_START_IN_PAST: 'Giờ bắt đầu sự kiện phải ở tương lai.',
  EVENT_HAS_NO_TICKET_TYPES: 'Thêm ít nhất một hạng vé trước khi phát hành sự kiện.',
  VENUE_CAPACITY_EXCEEDED: 'Tổng số vé các hạng vượt sức chứa địa điểm.',
  TICKET_TYPE_NOT_FOUND: 'Không tìm thấy hạng vé.',
  INVALID_SALE_TIME: 'Khoảng giờ bán không hợp lệ hoặc vượt giờ bắt đầu sự kiện.',
  INVALID_TICKET_QUANTITY: 'Giới hạn mỗi đơn không được vượt tổng số vé của hạng.',
  QUANTITY_BELOW_SOLD: 'Tổng vé không được thấp hơn số đã bán hoặc đang giữ chỗ.',
  CATEGORY_NOT_FOUND: 'Danh mục không còn tồn tại. Vui lòng tải lại form.',
  VENUE_NOT_FOUND: 'Địa điểm không còn tồn tại. Vui lòng tải lại form.',
  CATEGORY_SLUG_EXISTS: 'Slug danh mục đã tồn tại. Vui lòng chọn slug khác.',
  CATEGORY_IN_USE: 'Không thể xóa danh mục đang được sự kiện sử dụng.',
  VENUE_IN_USE: 'Không thể xóa địa điểm đang được sự kiện sử dụng.',
  VENUE_CAPACITY_IN_USE:
    'Không thể đổi sức chứa địa điểm đã được sự kiện sử dụng. Giữ nguyên sức chứa để cập nhật thông tin khác.',
  INVALID_REPORT_RANGE:
    'Khoảng báo cáo không hợp lệ. Thời điểm bắt đầu phải trước thời điểm kết thúc.',
};

export function apiError(
  error: unknown,
  fallback = 'Không thể kết nối đến máy chủ. Vui lòng thử lại.',
): FormApiError {
  if (error instanceof TimeoutError)
    return {
      message:
        'Hết thời gian chờ phản hồi. Nếu vừa gửi thao tác, hãy kiểm tra kết quả trước khi gửi lại.',
      fields: {},
    };
  if (!(error instanceof HttpErrorResponse)) return { message: fallback, fields: {} };
  const problem: ApiProblem = error.error && typeof error.error === 'object' ? error.error : {};
  const fields: Record<string, string> = {};
  if (Array.isArray(problem.errors)) {
    for (const err of problem.errors) {
      if (
        err &&
        typeof err.field === 'string' &&
        typeof err.message === 'string' &&
        !Object.hasOwn(fields, err.field)
      ) {
        // Không tin tên field/code từ response như thuộc tính prototype của object.
        if (['__proto__', 'constructor', 'prototype'].includes(err.field)) continue;
        fields[err.field] = Object.hasOwn(fieldMessages, err.field)
          ? fieldMessages[err.field]
          : err.message;
      }
    }
  }
  const statusMessages: Record<number, string> = {
    0: 'Không kết nối được máy chủ. Kiểm tra mạng và thử tải lại dữ liệu.',
    401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    403: 'Bạn không có quyền thực hiện thao tác này.',
    429: 'Bạn đang gửi yêu cầu quá nhanh. Vui lòng chờ một lúc trước khi thử lại.',
  };
  const codeMessage =
    typeof problem.code === 'string' && Object.hasOwn(codeMessages, problem.code)
      ? codeMessages[problem.code]
      : '';
  return { message: codeMessage || statusMessages[error.status] || fallback, fields };
}

import { HttpErrorResponse } from '@angular/common/http';

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
};

export function apiError(error: unknown, fallback = 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'): FormApiError {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    const problem = error.error as ApiProblem;
    const fields: Record<string, string> = {};
    if (Array.isArray(problem.errors)) {
      for (const err of problem.errors) {
        if (err.field && !fields[err.field]) {
          fields[err.field] = fieldMessages[err.field] || err.message;
        }
      }
    }
    const message = (problem.code && codeMessages[problem.code]) || fallback;
    return { message, fields };
  }
  return { message: fallback, fields: {} };
}

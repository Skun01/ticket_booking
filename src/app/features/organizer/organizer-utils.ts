import { HttpErrorResponse } from '@angular/common/http';

export function positiveId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

// Giữ tương thích các form organizer, dùng chung chuyển đổi giờ với báo cáo ADMIN.
export { vietnamDateInput, vietnamInstant } from '../../shared/vietnam-time';

export function uncertainWrite(error: unknown): boolean {
  return !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
}

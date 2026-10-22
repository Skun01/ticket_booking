import { HttpErrorResponse } from '@angular/common/http';

export function positiveId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** Form nhập giờ Việt Nam rõ ràng, không phụ thuộc timezone máy người dùng. */
export function vietnamDateInput(instant: string): string {
  return new Date(Date.parse(instant) + 7 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

export function vietnamInstant(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}+07:00`);
  if (!Number.isFinite(date.getTime()) || vietnamDateInput(date.toISOString()) !== normalized)
    return null;
  return date.toISOString();
}

export function uncertainWrite(error: unknown): boolean {
  return !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
}

import { DatePipe, registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { Pipe, PipeTransform } from '@angular/core';

registerLocaleData(localeVi);

/** Hiển thị Instant (chuỗi ISO) theo giờ Việt Nam. */
@Pipe({ name: 'dateTime' })
export class DateTimePipe implements PipeTransform {
  private readonly datePipe = new DatePipe('vi-VN');

  transform(value: string | null | undefined, format = 'HH:mm · dd/MM/yyyy'): string {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';
    return this.datePipe.transform(value, format, '+0700') ?? '—';
  }
}

import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

/** Hiển thị Instant (chuỗi ISO) theo giờ Việt Nam. */
@Pipe({ name: 'dateTime' })
export class DateTimePipe implements PipeTransform {
  private readonly datePipe = new DatePipe('vi-VN');

  transform(value: string | null | undefined, format = 'HH:mm · dd/MM/yyyy'): string {
    if (!value) return '—';
    return this.datePipe.transform(value, format) ?? '—';
  }
}

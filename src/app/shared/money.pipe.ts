import { Pipe, PipeTransform } from '@angular/core';

/** Định dạng tiền VND. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private static readonly formatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return MoneyPipe.formatter.format(value);
  }
}

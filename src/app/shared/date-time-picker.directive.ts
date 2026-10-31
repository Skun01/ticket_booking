import { AfterViewInit, DestroyRef, Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import flatpickr from 'flatpickr';
import { Vietnamese } from 'flatpickr/dist/l10n/vn';
import type { Instance } from 'flatpickr/dist/types/instance';

/** The model is a Vietnam wall-clock string, never a browser-timezone instant. */
@Directive({
  selector: 'input[appDateTimePicker]',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateTimePicker), multi: true }],
  host: {
    placeholder: 'Chọn ngày và giờ', autocomplete: 'off',
    '(keydown.enter)': 'open($event)', '(keydown.space)': 'open($event)',
    '(blur)': 'markTouched()',
  },
})
export class DateTimePicker implements AfterViewInit, ControlValueAccessor {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private picker?: Instance;
  private value = '';
  private disabled = false;
  private change: (value: string) => void = () => {};
  private touched: () => void = () => {};

  constructor() {
    this.destroyRef.onDestroy(() => this.picker?.destroy());
  }

  ngAfterViewInit(): void {
    this.picker = flatpickr(this.element.nativeElement, {
      locale: { ...Vietnamese, firstDayOfWeek: 1 },
      enableTime: true,
      enableSeconds: true,
      time_24hr: true,
      minuteIncrement: 1,
      dateFormat: 'd/m/Y H:i:S',
      ariaDateFormat: 'l, d/m/Y',
      disableMobile: true,
      allowInput: false,
      monthSelectorType: 'dropdown',
      onChange: (dates, _text, instance) => {
        this.value = dates.length ? instance.formatDate(dates[0], 'Y-m-d\\TH:i:S') : '';
        this.change(this.value);
      },
      onClose: () => this.touched(),
      onReady: (_dates, _text, instance) => {
        const actions = document.createElement('div');
        actions.className = 'picker-actions';
        for (const [label, action] of [
          ['Hôm nay', () => {
            const vietnam = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19);
            instance.setDate(vietnam, true, 'Y-m-d\\TH:i:S');
          }],
          ['Xóa', () => instance.clear()],
          ['Xong', () => instance.close()],
        ] as const) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.addEventListener('click', action);
          actions.append(button);
        }
        instance.calendarContainer.append(actions);
      },
    });
    this.syncValue();
    this.setDisabledState(this.disabled);
  }

  open(event: Event): void {
    event.preventDefault();
    if (!this.disabled) this.picker?.open();
  }

  markTouched(): void { this.touched(); }

  writeValue(value: string | null): void {
    this.value = value ?? '';
    this.syncValue();
  }

  registerOnChange(fn: (value: string) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.element.nativeElement.disabled = disabled;
    if (disabled) this.picker?.close();
  }

  private syncValue(): void {
    if (!this.picker) return;
    if (!this.value) { this.picker.clear(false); return; }
    const normalized = this.value.length === 16 ? `${this.value}:00` : this.value;
    this.picker.setDate(normalized, false, 'Y-m-d\\TH:i:S');
  }
}

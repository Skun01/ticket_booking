import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DateTimePicker } from './date-time-picker.directive';
import { vietnamInstant } from './vietnam-time';
import type { Instance } from 'flatpickr/dist/types/instance';

@Component({
  imports: [ReactiveFormsModule, DateTimePicker],
  template: '<input appDateTimePicker [formControl]="control" />',
})
class Host {
  readonly control = new FormControl('2026-12-25T19:30:45', { nonNullable: true });
}

describe('DateTimePicker', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement & { _flatpickr: Instance };
    return { fixture, input, picker: input._flatpickr, control: fixture.componentInstance.control };
  }

  it('renders dd/MM/yyyy while preserving the Vietnam wall-clock model', () => {
    const { input, control } = setup();
    expect(input.value).toBe('25/12/2026 19:30:45');
    expect(control.value).toBe('2026-12-25T19:30:45');
  });

  it('propagates calendar selections and converts to UTC only at the API boundary', () => {
    const { picker, control } = setup();
    picker.setDate('2026-12-31T20:15:30', true, 'Y-m-d\\TH:i:S');
    expect(control.value).toBe('2026-12-31T20:15:30');
    expect(vietnamInstant(control.value)).toBe('2026-12-31T13:15:30.000Z');
  });

  it('supports clearing, programmatic reset, and disabled state', () => {
    const { input, picker, control } = setup();
    picker.clear();
    expect(control.value).toBe('');
    control.setValue('2027-01-02T08:00');
    expect(input.value).toBe('02/01/2027 08:00:00');
    control.disable();
    expect(input.disabled).toBe(true);
    control.enable();
    expect(input.disabled).toBe(false);
  });

  it('opens with the keyboard and removes the popup on destroy', () => {
    const { fixture, input, picker } = setup();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(picker.isOpen).toBe(true);
    const calendar = picker.calendarContainer;
    fixture.destroy();
    expect(document.body.contains(calendar)).toBe(false);
  });
});

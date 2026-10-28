import { DateTimePipe } from './date-time.pipe';

describe('DateTimePipe', () => {
  const pipe = new DateTimePipe();

  it('shows dates in Vietnam time regardless of the viewer timezone', () => {
    expect(pipe.transform('2026-10-23T02:30:00Z')).toBe('09:30 · 23/10/2026');
  });

  it('supports a more prominent date-only format', () => {
    expect(pipe.transform('2026-10-23T20:30:00Z', 'dd/MM/yyyy')).toBe('24/10/2026');
  });

  it('uses a safe placeholder for missing or malformed schedule dates', () => {
    for (const value of [undefined, null, '', 'not-a-date']) {
      expect(pipe.transform(value)).toBe('—');
    }
  });
});

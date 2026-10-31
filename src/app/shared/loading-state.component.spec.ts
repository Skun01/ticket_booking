import { TestBed } from '@angular/core/testing';
import { LoadingState } from './loading-state.component';

describe('LoadingState', () => {
  it('keeps inline loading compact', () => {
    const fixture = TestBed.createComponent(LoadingState);
    fixture.componentRef.setInput('label', 'Đang tải…');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Đang tải…');
    expect(fixture.nativeElement.querySelector('.skeleton-content')).toBeNull();
    expect(fixture.nativeElement.getAttribute('role')).toBe('status');
  });

  it.each(['cards', 'table', 'form', 'report', 'detail'])('renders the %s skeleton without exposing placeholders to screen readers', (variant) => {
    const fixture = TestBed.createComponent(LoadingState);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('.skeleton-content');
    expect(content.getAttribute('aria-hidden')).toBe('true');
    expect(content.querySelectorAll('ngx-skeleton-loader').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.getAttribute('aria-busy')).toBe('true');
  });
});

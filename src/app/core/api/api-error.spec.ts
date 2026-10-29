import { HttpErrorResponse } from '@angular/common/http';
import { apiError } from './api-error';

describe('API error presentation', () => {
  it('maps backend validation fields without displaying arbitrary server details', () => {
    const result = apiError(
      new HttpErrorResponse({
        status: 400,
        error: {
          code: 'VALIDATION_FAILED',
          detail: 'internal details',
          errors: [
            { field: 'email', message: 'server details' },
            { field: 'password', message: 'server details' },
          ],
        },
      }),
    );
    expect(result.fields['email']).toContain('email');
    expect(result.fields['password']).toContain('mật khẩu');
  });

  it('shows an understandable invalid-credentials message', () => {
    expect(apiError(new HttpErrorResponse({ status: 401, error: { code: 'INVALID_CREDENTIALS' } })).message)
      .toBe('Email hoặc mật khẩu không chính xác.');
  });

  it('presents a PayOS checkout error without encouraging immediate duplicate payment', () => {
    const result = apiError(new HttpErrorResponse({
      status: 502,
      error: { code: 'PAYMENT_LINK_CREATION_FAILED', detail: 'gateway secret' },
    }));
    expect(result.message).toContain('PayOS');
    expect(result.message).toContain('cập nhật đơn');
    expect(result.message).not.toContain('gateway secret');
  });

  it('does not expose unexpected exception text', () => {
    const result = apiError(new HttpErrorResponse({ status: 500, error: { detail: 'SQL secret' } }));
    expect(result.message).not.toContain('SQL');
    expect(apiError(new Error('private details')).message).not.toContain('private');
  });
});

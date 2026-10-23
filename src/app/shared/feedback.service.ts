import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormApiError, apiError } from '../core/api/api-error';

/** Chỉ phản hồi UI; không intercept, thử lại hoặc tự thực hiện yêu cầu mạng. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly snackBar = inject(MatSnackBar);

  problem(error: unknown, fallback?: string, announce = false): FormApiError {
    const problem = apiError(error, fallback);
    // Inline role=alert vẫn là nguồn đọc chính; tránh đọc cùng lỗi hai lần.
    this.show(`Không thành công: ${problem.message}`, 'error', announce);
    return problem;
  }

  error(message: string, announce = false): void {
    this.show(`Không thành công: ${message}`, 'error', announce);
  }

  success(message: string): void {
    this.show(`Thành công: ${message}`, 'success', true);
  }
  info(message: string): void {
    this.show(message, 'info', true);
  }

  private show(message: string, kind: 'error' | 'success' | 'info', announce: boolean): void {
    this.snackBar.open(message, 'Đóng', {
      duration: kind === 'error' ? 0 : 7000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      politeness: announce ? 'polite' : 'off',
      panelClass: ['app-snackbar', `app-snackbar-${kind}`],
    });
  }
}

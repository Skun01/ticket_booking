import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { finalize, timeout } from 'rxjs';
import { OrganizerApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { Ticket } from '../../core/api/models';
import { SessionService } from '../../core/auth/session.service';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { PageHeader } from '../../shared/page-header.component';
import { StatusBadge } from '../../shared/status-badge.component';
import { uncertainWrite } from './organizer-utils';

@Component({
  selector: 'app-organizer-checkin-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    DateTimePipe,
    PageHeader,
    StatusBadge,
  ],
  templateUrl: './organizer-checkin-page.component.html',
  
  styles: `
    .entry-panel,
    .result-panel {
      overflow-wrap: anywhere;
    }
    form {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .code-field {
      flex: 1 1 320px;
      min-width: 0;
    }
    form > button {
      margin-top: 8px;
      white-space: nowrap;
    }
    .code,
    input {
      font-variant-numeric: tabular-nums;
    }
    .result-panel {
      border-top: 4px solid var(--app-success);
      background: linear-gradient(var(--app-success-soft), var(--app-panel) 180px);
    }
    .result-panel h2 {
      color: var(--app-success);
      margin-bottom: 12px;
    }
    dl {
      margin-bottom: 0;
    }
    dl > div {
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr);
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--app-line);
    }
    dt {
      color: var(--app-muted);
    }
    dd {
      margin: 0;
    }
    .form-notice p:last-child {
      margin-bottom: 0;
    }
    .ready {
      margin-top: 24px;
    }
    @media (max-width: 768px) {
      dl > div {
        grid-template-columns: 1fr;
        gap: 4px;
      }
      form > button {
        margin-top: 0;
      }
    }
  `,
})
export class OrganizerCheckInPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(OrganizerApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('ticketCodeInput');
  protected readonly session = inject(SessionService);
  protected readonly ticketCode = new FormControl('', { nonNullable: true });
  protected readonly form = new FormGroup({ ticketCode: this.ticketCode });
  protected readonly submittedCode = signal('');
  protected readonly busy = signal(false);
  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly error = signal('');
  protected readonly uncertainCode = signal<string | null>(null);

  constructor() {
    this.focusInput();
  }

  protected clearResult(): void {
    if (this.busy() || this.uncertainCode()) return;
    this.ticket.set(null);
    this.error.set('');
    this.submittedCode.set('');
  }

  protected nextTicket(): void {
    if (this.busy()) return;
    this.ticket.set(null);
    this.error.set('');
    this.uncertainCode.set(null);
    this.submittedCode.set('');
    this.ticketCode.reset('');
    this.focusInput();
  }

  protected submit(): void {
    if (this.busy() || this.uncertainCode() || !this.session.isOrganizer()) return;
    this.ticket.set(null);
    this.error.set('');
    this.submittedCode.set('');
    const code = this.ticketCode.value.trim();
    if (!code || code.length > 40) {
      this.error.set('Vui lòng nhập mã vé từ 1 đến 40 ký tự, không chỉ gồm khoảng trắng.');
      this.focusInput();
      return;
    }
    this.send(code);
  }

  protected retryUncertain(): void {
    const code = this.uncertainCode();
    if (!code || this.busy() || !this.session.isOrganizer()) return;
    // Chỉ gửi lại khi người dùng chủ động xác nhận; tuyệt đối không retry POST tự động.
    this.uncertainCode.set(null);
    this.send(code);
  }

  private send(code: string): void {
    this.submittedCode.set(code);
    this.ticketCode.setValue(code);
    this.ticket.set(null);
    this.error.set('');
    this.busy.set(true);
    this.api
      .checkIn(code)
      .pipe(
        timeout(20000),
        finalize(() => {
          this.busy.set(false);
          this.focusInput();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (ticket) => {
          if (
            !ticket ||
            ticket.status !== 'USED' ||
            !ticket.checkedInAt ||
            !Number.isFinite(Date.parse(ticket.checkedInAt)) ||
            ticket.ticketCode !== code
          ) {
            this.error.set('Phản hồi máy chủ không đủ thông tin xác nhận vé đã được check-in.');
            this.uncertainCode.set(code);
            return;
          }
          this.ticket.set(ticket);
          this.feedback.success('Đã xác nhận check-in vé.');
        },
        error: (error: unknown) => {
          const problem = this.feedback.problem(
            error,
            'Không xác nhận được check-in. Vui lòng kiểm tra kết nối và đối soát tại cổng.',
          );
          this.error.set(problem.fields['ticketCode'] || problem.message);
          if (uncertainWrite(error)) this.uncertainCode.set(code);
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.error.set(
              'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại; thao tác check-in không được tự gửi lại.',
            );
          }
        },
      });
  }

  private focusInput(): void {
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      () => {
        if (this.destroyRef.destroyed) return;
        const input = this.input().nativeElement;
        input.focus();
        input.select();
      },
      { injector: this.injector },
    );
  }
}

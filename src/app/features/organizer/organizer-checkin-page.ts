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
import { PageHeader } from '../../shared/page-header';
import { StatusBadge } from '../../shared/status-badge';
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
  template: `
    <app-page-header
      title="Check-in vé"
      subtitle="Nhập mã vé để xác nhận khách vào sự kiện của bạn."
    >
      <a mat-stroked-button routerLink="/organizer">Sự kiện của tôi</a>
    </app-page-header>
    <section class="panel entry-panel" aria-labelledby="entry-title">
      <h2 id="entry-title">Nhập mã vé</h2>
      <p id="ticket-code-help" class="muted">
        Dùng mã trên vé điện tử, tối đa 40 ký tự. Nhấn Enter hoặc nút Check-in để gửi. Mã được kiểm
        tra đúng như đã nhập, chỉ bỏ khoảng trắng hai đầu.
      </p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field appearance="outline" class="code-field">
          <mat-label>Mã vé</mat-label>
          <input
            #ticketCodeInput
            matInput
            type="text"
            formControlName="ticketCode"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            [readonly]="busy() || !!uncertainCode()"
            (input)="clearResult()"
            aria-describedby="ticket-code-help"
            [attr.aria-invalid]="!!error()"
          />
        </mat-form-field>
        <button
          mat-flat-button
          type="submit"
          [disabled]="busy() || !!uncertainCode() || !session.isOrganizer()"
          [attr.aria-busy]="busy()"
        >
          {{ busy() ? 'Đang check-in…' : 'Check-in' }}
        </button>
      </form>
      @if (busy()) {
        <p role="status">
          Đang xác nhận mã {{ submittedCode() }}. Không gửi lại hoặc cho khách qua cổng khi chưa có
          kết quả.
        </p>
      }
      @if (error()) {
        <div class="form-notice error" role="alert">
          <h3>Chưa xác nhận check-in</h3>
          @if (submittedCode()) {
            <p class="code">Mã vừa gửi: {{ submittedCode() }}</p>
          }
          <p>{{ error() }}</p>
          <p>Không sử dụng kết quả check-in trước đó cho mã vé này.</p>
        </div>
      }
      @if (uncertainCode(); as code) {
        <div class="form-notice warning" role="alert">
          <h3>Chưa rõ kết quả xử lý</h3>
          <p class="code">Mã cần đối soát: {{ code }}</p>
          <p>
            Yêu cầu có thể đã được máy chủ xử lý dù chưa nhận được phản hồi. Không tự xác nhận khách
            đã check-in.
          </p>
          <p>
            Nếu gửi lại và nhận “vé đã dùng”, cần đối soát tại cổng; phản hồi đó không chứng minh
            lần gửi trước của bạn đã thành công.
          </p>
          <div class="form-actions">
            <button mat-stroked-button type="button" (click)="retryUncertain()" [disabled]="busy()">
              Gửi lại để xác minh
            </button>
            <button mat-stroked-button type="button" (click)="nextTicket()" [disabled]="busy()">
              Nhập mã khác
            </button>
          </div>
        </div>
      }
    </section>
    @if (ticket(); as ticket) {
      <section
        class="panel result-panel"
        aria-labelledby="checkin-result-title"
        role="status"
        aria-live="polite"
      >
        <h2 id="checkin-result-title">Check-in thành công</h2>
        <p>
          Máy chủ đã xác nhận vé được sử dụng. Kiểm tra tên sự kiện trước khi cho khách qua cổng.
        </p>
        <app-status-badge [status]="ticket.status" />
        <dl>
          <div>
            <dt>Mã vé</dt>
            <dd class="code">{{ ticket.ticketCode }}</dd>
          </div>
          <div>
            <dt>Sự kiện</dt>
            <dd>{{ ticket.eventTitle }}</dd>
          </div>
          <div>
            <dt>Hạng vé</dt>
            <dd>{{ ticket.ticketTypeName }}</dd>
          </div>
          <div>
            <dt>Thời gian sự kiện</dt>
            <dd>{{ ticket.startTime | dateTime }} đến {{ ticket.endTime | dateTime }}</dd>
          </div>
          <div>
            <dt>Check-in lúc</dt>
            <dd>{{ ticket.checkedInAt | dateTime }} (giờ Việt Nam)</dd>
          </div>
        </dl>
        <div class="form-actions">
          <button mat-flat-button type="button" (click)="nextTicket()">Nhập vé tiếp theo</button>
          <a mat-stroked-button [routerLink]="['/organizer/events', ticket.eventId]">Xem sự kiện</a>
        </div>
      </section>
    } @else if (!error() && !busy() && !uncertainCode()) {
      <p class="muted ready" role="status">
        Sẵn sàng nhận mã vé. Chỉ kết quả được máy chủ xác nhận mới được hiển thị là thành công.
      </p>
    }
  `,
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
      border-top: 4px solid var(--app-ink);
    }
    .result-panel h2 {
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

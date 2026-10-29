import { FocusOnShow } from '../../shared/focus-on-show';
import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import {
  Subscription,
  distinctUntilChanged,
  finalize,
  forkJoin,
  interval,
  map,
  timeout,
} from 'rxjs';
import { OrganizerApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { EventItem, EventStatus, TicketType } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header.component';
import { StatusBadge } from '../../shared/status-badge.component';
import { positiveId } from './organizer-utils';
import { TicketTypeEditor } from './ticket-type-editor.component';

@Component({
  selector: 'app-organizer-event-detail-page',
  imports: [
    FocusOnShow,
    LoadingState,
    RouterLink,
    MatButton,
    DateTimePipe,
    MoneyPipe,
    PageHeader,
    StatusBadge,
    TicketTypeEditor,
  ],
  templateUrl: './organizer-event-detail-page.component.html',
  
  styles: `
    .panel {
      overflow-wrap: anywhere;
    }
    .event-info h2 {
      margin-top: 16px;
    }
    .description {
      white-space: pre-line;
    }
    .section-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .type-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 16px;
      border-top: 1px solid var(--app-line);
      padding: 20px 0;
    }
    .type-row p {
      margin-bottom: 0.4rem;
    }
    @media (max-width: 768px) {
      .type-row {
        grid-template-columns: 1fr;
      }
      .type-row button {
        justify-self: start;
      }
    }
  `,
})
export class OrganizerEventDetailPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(OrganizerApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readRequest?: Subscription;
  private writeRequest?: Subscription;
  private readonly now = signal(Date.now());
  protected readonly id = signal<number | null>(null);
  protected readonly event = signal<EventItem | null>(null);
  protected readonly types = signal<TicketType[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly editorBusy = signal(false);
  protected readonly needsRefresh = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly editing = signal<TicketType | null | undefined>(undefined);
  protected readonly confirmStatus = signal<EventStatus | null>(null);
  protected readonly allocated = computed(() =>
    this.types().reduce((sum, t) => sum + t.totalQuantity, 0),
  );
  protected readonly blocked = computed(
    () => this.loading() || this.busy() || this.editorBusy() || this.needsRefresh(),
  );

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((value) => {
        this.readRequest?.unsubscribe();
        this.writeRequest?.unsubscribe();
        this.id.set(positiveId(value));
        this.event.set(null);
        this.types.set([]);
        this.editing.set(undefined);
        this.editorBusy.set(false);
        this.notice.set('');
        if (!this.id()) {
          this.loading.set(false);
          this.error.set('Đường dẫn sự kiện không hợp lệ.');
          return;
        }
        this.load();
      });
  }

  protected load(): void {
    const id = this.id();
    if (!id || this.busy() || this.editorBusy()) return;
    this.readRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.editing.set(undefined);
    this.confirmStatus.set(null);
    this.readRequest = forkJoin({
      event: this.api.getEvent(id),
      types: this.api.listTicketTypes(id),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.event.set(result.event);
          this.types.set(result.types);
          this.needsRefresh.set(false);
        },
        error: (error) => {
          this.error.set(this.feedback.problem(error, 'Không tải được cấu hình sự kiện.').message);
          this.needsRefresh.set(true);
        },
      });
  }

  protected canTransition(status: EventStatus): boolean {
    const ev = this.event();
    if (!ev || this.blocked()) return false;
    if (status === 'PUBLISHED')
      return (
        ev.status === 'DRAFT' && this.types().length > 0 && Date.parse(ev.startTime) > this.now()
      );
    if (status === 'CANCELLED') return ev.status === 'DRAFT' || ev.status === 'PUBLISHED';
    if (status === 'ENDED')
      return ev.status === 'PUBLISHED' && Date.parse(ev.endTime) <= this.now();
    return false;
  }

  protected changeStatus(status: EventStatus): void {
    const id = this.id();
    if (!id || this.confirmStatus() !== status || !this.canTransition(status)) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    this.writeRequest = this.api
      .changeStatus(id, status)
      .pipe(
        timeout(20000),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (ev) => {
          this.event.set(ev);
          this.confirmStatus.set(null);
          this.editing.set(undefined);
          this.notice.set('Đã cập nhật trạng thái sự kiện.');
          this.feedback.success(this.notice());
        },
        error: (error) => {
          this.error.set(
            this.feedback.problem(
              error,
              'Chưa xác nhận được kết quả đổi trạng thái. Hãy cập nhật sự kiện trước khi thử lại.',
            ).message,
          );
          this.needsRefresh.set(true);
          this.confirmStatus.set(null);
        },
      });
  }

  protected ticketSaved(ticket: TicketType): void {
    this.types.update((types) =>
      types.some((t) => t.id === ticket.id)
        ? types.map((t) => (t.id === ticket.id ? ticket : t))
        : [...types, ticket],
    );
    this.editing.set(undefined);
    this.editorBusy.set(false);
    this.notice.set('Đã lưu hạng vé.');
    this.feedback.success(this.notice());
  }
}

import { FocusOnShow } from '../../shared/focus-on-show';
import { LoadingState } from '../../shared/loading-state';
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
import { PageHeader } from '../../shared/page-header';
import { StatusBadge } from '../../shared/status-badge';
import { positiveId } from './organizer-utils';
import { TicketTypeEditor } from './ticket-type-editor';

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
  template: `
    <app-page-header title="Quản lý sự kiện" subtitle="Thông tin, trạng thái và cấu hình hạng vé.">
      <a mat-stroked-button routerLink="/organizer">Sự kiện của tôi</a>
    </app-page-header>
    @if (error()) {
      <p class="form-notice error" role="alert">{{ error() }}</p>
    }
    @if (notice()) {
      <p class="form-notice success" role="status">{{ notice() }}</p>
    }
    @if (loading()) {
      <app-loading-state label="Đang tải sự kiện và hạng vé…" />
    } @else if (event(); as ev) {
      <section class="panel event-info">
        <app-status-badge [status]="ev.status" />
        <h2>{{ ev.title }}</h2>
        <p>{{ ev.startTime | dateTime }} đến {{ ev.endTime | dateTime }} (giờ Việt Nam)</p>
        <p>
          Mở bán: {{ ev.salesStartTime | dateTime }}. Tự động ngừng bán khi sự kiện bắt đầu lúc
          {{ ev.startTime | dateTime }}.
        </p>
        <p>{{ ev.category.name }} · {{ ev.venue.name }}</p>
        <p class="muted">
          {{ ev.venue.address }}, {{ ev.venue.city }}. Sức chứa: {{ ev.venue.capacity }} chỗ.
        </p>
        @if (ev.description) {
          <p class="description">{{ ev.description }}</p>
        }
        @if (ev.bannerUrl) {
          <p class="muted">URL banner: {{ ev.bannerUrl }}</p>
        }
        <div class="form-actions">
          @if (ev.status === 'DRAFT' && !blocked()) {
            <a mat-stroked-button [routerLink]="['/organizer/events', ev.id, 'edit']"
              >Sửa thông tin</a
            >
          }
          <a mat-stroked-button [routerLink]="['/organizer/events', ev.id, 'report']"
            >Báo cáo doanh thu</a
          >
          @if (ev.status === 'PUBLISHED') {
            <a [routerLink]="['/events', ev.id]">Xem trang công khai</a>
          }
        </div>
      </section>
      <section class="panel" aria-labelledby="status-title">
        <h2 id="status-title">Trạng thái sự kiện</h2>
        @if (ev.status === 'DRAFT') {
          <p class="muted">
            Phát hành sau khi đã thêm ít nhất một hạng vé và giờ bắt đầu còn ở tương lai. Sau khi
            phát hành không thể sửa thông tin/hạng vé hoặc đưa về nháp.
          </p>
        } @else if (ev.status === 'PUBLISHED') {
          <p class="muted">
            Có thể hủy sự kiện; chỉ được kết thúc khi đã qua giờ kết thúc trên lịch.
          </p>
        } @else {
          <p class="muted">
            Sự kiện đã {{ ev.status === 'ENDED' ? 'kết thúc' : 'hủy' }}. Không có thao tác chuyển
            trạng thái tiếp theo.
          </p>
        }
        @if (needsRefresh()) {
          <p class="form-notice warning" role="status">
            Cần cập nhật lại sự kiện để xác nhận cấu hình/trạng thái trước khi thao tác tiếp.
          </p>
        }
        <div class="form-actions">
          @if (ev.status === 'DRAFT') {
            <button
              mat-flat-button
              type="button"
              (click)="confirmStatus.set('PUBLISHED')"
              [disabled]="!canTransition('PUBLISHED')"
            >
              Phát hành
            </button>
          }
          @if (ev.status === 'DRAFT' || ev.status === 'PUBLISHED') {
            <button
              mat-stroked-button
              type="button"
              (click)="confirmStatus.set('CANCELLED')"
              [disabled]="blocked()"
            >
              Hủy sự kiện
            </button>
          }
          @if (ev.status === 'PUBLISHED') {
            <button
              mat-stroked-button
              type="button"
              (click)="confirmStatus.set('ENDED')"
              [disabled]="!canTransition('ENDED')"
            >
              Kết thúc sự kiện
            </button>
          }
        </div>
        @if (confirmStatus(); as status) {
          <div class="form-notice" role="group" appFocusOnShow aria-label="Xác nhận đổi trạng thái">
            <p>
              {{
                status === 'PUBLISHED'
                  ? 'Phát hành sự kiện và khóa chỉnh sửa thông tin/hạng vé?'
                  : status === 'CANCELLED'
                    ? 'Hủy sự kiện và ngừng nhận đặt vé/thanh toán? Thao tác này không tự xử lý hoàn tiền.'
                    : 'Đánh dấu sự kiện đã kết thúc?'
              }}
            </p>
            <div class="form-actions">
              <button
                mat-flat-button
                type="button"
                (click)="changeStatus(status)"
                [disabled]="!canTransition(status)"
                [attr.aria-busy]="busy()"
              >
                {{ busy() ? 'Đang cập nhật…' : 'Xác nhận' }}
              </button>
              <button
                mat-stroked-button
                type="button"
                (click)="confirmStatus.set(null)"
                [disabled]="busy()"
              >
                Quay lại
              </button>
            </div>
          </div>
        }
      </section>
      <section class="panel" aria-labelledby="types-title">
        <div class="section-top">
          <h2 id="types-title">Hạng vé</h2>
          @if (ev.status === 'DRAFT') {
            <button
              mat-stroked-button
              type="button"
              (click)="editing.set(null)"
              [disabled]="blocked()"
            >
              Thêm hạng vé
            </button>
          }
        </div>
        <p class="muted">
          Đã phân bổ {{ allocated() }} / {{ ev.venue.capacity }} chỗ. Số “đã bán/giữ chỗ” bao gồm cả
          đơn chưa thanh toán; số vé bán thực tế xem tại báo cáo.
        </p>
        @if (!types().length) {
          <p>Chưa có hạng vé. Thêm hạng vé trước khi phát hành.</p>
        }
        @for (tt of types(); track tt.id) {
          <article class="type-row">
            <div>
              <h3>{{ tt.name }}</h3>
              <p>
                {{ tt.price | money }} · {{ tt.totalQuantity }} vé · tối đa {{ tt.maxPerOrder }}/đơn
              </p>
              <p class="muted">
                Đã bán/giữ chỗ: {{ tt.soldQuantity }}. Còn: {{ tt.availableQuantity }}.
              </p>
            </div>
            @if (ev.status === 'DRAFT') {
              <button
                mat-stroked-button
                type="button"
                (click)="editing.set(tt)"
                [disabled]="blocked()"
              >
                Sửa hạng vé
              </button>
            }
          </article>
        }
        @if (ev.status !== 'DRAFT') {
          <p class="muted">Hạng vé chỉ được cấu hình khi sự kiện còn nháp.</p>
        }
      </section>
      @if (editing() !== undefined && ev.status === 'DRAFT') {
        <app-ticket-type-editor
          [event]="ev"
          [ticketType]="editing() ?? null"
          [allTypes]="types()"
          (saved)="ticketSaved($event)"
          (closed)="editing.set(undefined)"
          (busyChange)="editorBusy.set($event)"
          (refreshRequired)="needsRefresh.set(true)"
        />
      }
      <div class="form-actions">
        <button
          mat-stroked-button
          type="button"
          (click)="load()"
          [disabled]="busy() || editorBusy()"
        >
          Cập nhật sự kiện
        </button>
      </div>
    } @else if (id()) {
      <button mat-stroked-button type="button" (click)="load()">Thử lại</button>
    }
  `,
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

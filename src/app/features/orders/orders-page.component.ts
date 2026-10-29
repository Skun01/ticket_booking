import { LoadingState } from '../../shared/loading-state.component';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { Subscription } from 'rxjs';
import { OrderApi } from '../../core/api/catalog.api';
import { FeedbackService } from '../../shared/feedback.service';
import { OrderStatus, OrderSummary } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { EmptyState } from '../../shared/empty-state.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header.component';
import { Paginator } from '../../shared/paginator.component';
import { StatusBadge } from '../../shared/status-badge.component';

@Component({
  selector: 'app-orders-page',
  imports: [
    LoadingState,
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    DateTimePipe,
    EmptyState,
    MoneyPipe,
    PageHeader,
    Paginator,
    StatusBadge,
  ],
  templateUrl: './orders-page.component.html',
  
  styles: `
    :host {
      display: block;
      padding-top: 32px;
    }
    .order-list {
      border-top: 1px solid var(--app-line);
    }
    .order-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      padding: 24px 0;
      border-bottom: 1px solid var(--app-line);
    }
    .order-row h2 {
      font-size: 1rem;
      overflow-wrap: anywhere;
    }
    .order-row p {
      margin-bottom: 0.35rem;
    }
    .order-summary {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    @media (max-width: 768px) {
      .order-row {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
  `,
})
export class OrdersPage {
  private readonly feedback = inject(FeedbackService);
  private readonly api = inject(OrderApi);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly orders = signal<OrderSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly page = signal(0);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly status = new FormControl<OrderStatus | ''>('', { nonNullable: true });
  protected readonly filter = signal<OrderStatus | ''>('');
  protected readonly visible = computed(() =>
    this.orders().filter((order) => !this.filter() || order.status === this.filter()),
  );

  constructor() {
    this.load(0);
  }

  protected load(page: number): void {
    this.request?.unsubscribe();
    this.page.set(page);
    this.loading.set(true);
    this.error.set('');
    this.request = this.api
      .listOwn({ page, size: 12 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.orders.set(result.content);
          this.page.set(result.page);
          this.total.set(result.totalElements);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(this.feedback.problem(error, 'Không thể tải đơn vé của bạn.').message);
          this.loading.set(false);
        },
      });
  }
}

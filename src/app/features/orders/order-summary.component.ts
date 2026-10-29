import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../../core/api/models';
import { DateTimePipe } from '../../shared/date-time.pipe';
import { Icon } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { StatusBadge } from '../../shared/status-badge.component';

@Component({
  selector: 'app-order-summary',
  imports: [RouterLink, DateTimePipe, Icon, MoneyPipe, StatusBadge],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.scss',
})
export class OrderSummaryCard {
  readonly order = input.required<Order>();
  readonly expired = input(false);
  readonly remaining = input(0);
  readonly countdown = input('00:00');
  protected readonly subtotal = computed(() =>
    this.order().items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  protected readonly ticketCount = computed(() =>
    this.order().items.reduce((sum, item) => sum + item.quantity, 0),
  );
}

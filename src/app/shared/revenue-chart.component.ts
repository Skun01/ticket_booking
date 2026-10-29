import {
  Component,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  input,
  viewChild,
} from '@angular/core';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { DailyRevenue } from '../core/api/models';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

@Component({
  selector: 'app-revenue-chart',
  templateUrl: './revenue-chart.component.html',
  
  styles: `
    .chart-container {
      position: relative;
      width: 100%;
      height: 300px;
    }
  `,
})
export class RevenueChart implements OnDestroy {
  readonly rows = input.required<DailyRevenue[]>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart<'bar', number[], string>;

  constructor() {
    // Chỉ khởi tạo sau khi canvas được render; hủy chart trước khi vẽ lại hoặc rời trang.
    afterRenderEffect(() => {
      const rows = [...this.rows()].sort((a, b) => a.date.localeCompare(b.date));
      const canvas = this.canvas().nativeElement;
      this.chart?.destroy();
      this.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: rows.map((row) => row.date),
          datasets: [
            {
              label: 'Doanh thu (VND)',
              data: rows.map((row) => row.revenue),
              backgroundColor: '#515151',
              borderRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) =>
                  new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(Number(value)),
              },
            },
            x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 12 } },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (item) =>
                  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                    item.parsed.y ?? 0,
                  ),
              },
            },
          },
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}

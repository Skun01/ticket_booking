import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import {
  Category,
  CreateOrderRequest,
  EventDetail,
  EventFilter,
  EventItem,
  EventRequest,
  EventReport,
  EventStatus,
  EventSummary,
  Order,
  OrderSummary,
  PageResponse,
  PayOrderRequest,
  RevenueReport,
  Ticket,
  TicketType,
  TicketTypeRequest,
  Venue,
  CategoryRequest,
  VenueRequest,
} from './models';

interface PageQuery {
  page?: number;
  size?: number;
}

function toParams(values: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** API công khai: sự kiện, danh mục, địa điểm (không cần đăng nhập). */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL).replace(/\/$/, '');

  listEvents(
    filter: EventFilter = {},
    page: PageQuery = {},
  ): Observable<PageResponse<EventSummary>> {
    return this.http.get<PageResponse<EventSummary>>(`${this.base}/events`, {
      params: toParams({ ...filter, page: page.page, size: page.size }),
    });
  }

  getEvent(id: number): Observable<EventDetail> {
    return this.http.get<EventDetail>(`${this.base}/events/${id}`);
  }

  listCategories(page: PageQuery = {}): Observable<PageResponse<Category>> {
    return this.http.get<PageResponse<Category>>(`${this.base}/categories`, {
      params: toParams({ page: page.page, size: page.size }),
    });
  }

  listVenues(page: PageQuery = {}): Observable<PageResponse<Venue>> {
    return this.http.get<PageResponse<Venue>>(`${this.base}/venues`, {
      params: toParams({ page: page.page, size: page.size }),
    });
  }
}

/** API khách hàng: đơn vé và thanh toán. */
@Injectable({ providedIn: 'root' })
export class OrderApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL).replace(/\/$/, '');

  create(request: CreateOrderRequest): Observable<Order> {
    return this.http.post<Order>(`${this.base}/orders`, request);
  }

  pay(id: number, request: PayOrderRequest): Observable<Order> {
    return this.http.post<Order>(`${this.base}/orders/${id}/pay`, request);
  }

  cancel(id: number): Observable<Order> {
    return this.http.post<Order>(`${this.base}/orders/${id}/cancel`, {});
  }

  listOwn(page: PageQuery = {}): Observable<PageResponse<OrderSummary>> {
    return this.http.get<PageResponse<OrderSummary>>(`${this.base}/orders/my`, {
      params: toParams({ page: page.page, size: page.size }),
    });
  }

  getOwn(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.base}/orders/${id}`);
  }
}

/** API khách hàng: vé của tôi và tải PDF. */
@Injectable({ providedIn: 'root' })
export class TicketApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL).replace(/\/$/, '');

  listOwn(page: PageQuery = {}): Observable<PageResponse<Ticket>> {
    return this.http.get<PageResponse<Ticket>>(`${this.base}/tickets/my`, {
      params: toParams({ page: page.page, size: page.size }),
    });
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/tickets/${id}/pdf`, { responseType: 'blob' });
  }
}

/** API nhà tổ chức: quản lý sự kiện, hạng vé, check-in, báo cáo. */
@Injectable({ providedIn: 'root' })
export class OrganizerApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL).replace(/\/$/, '');

  listEvents(page: PageQuery = {}): Observable<PageResponse<EventItem>> {
    return this.http.get<PageResponse<EventItem>>(`${this.base}/organizer/events`, {
      params: toParams({ page: page.page, size: page.size }),
    });
  }

  getEvent(id: number): Observable<EventItem> {
    return this.http.get<EventItem>(`${this.base}/organizer/events/${id}`);
  }

  createEvent(request: EventRequest): Observable<EventItem> {
    return this.http.post<EventItem>(`${this.base}/organizer/events`, request);
  }

  updateEvent(id: number, request: EventRequest): Observable<EventItem> {
    return this.http.put<EventItem>(`${this.base}/organizer/events/${id}`, request);
  }

  changeStatus(id: number, status: EventStatus): Observable<EventItem> {
    return this.http.patch<EventItem>(`${this.base}/organizer/events/${id}/status`, { status });
  }

  listTicketTypes(eventId: number): Observable<TicketType[]> {
    return this.http.get<TicketType[]>(`${this.base}/organizer/events/${eventId}/ticket-types`);
  }

  createTicketType(eventId: number, request: TicketTypeRequest): Observable<TicketType> {
    return this.http.post<TicketType>(
      `${this.base}/organizer/events/${eventId}/ticket-types`,
      request,
    );
  }

  updateTicketType(id: number, request: TicketTypeRequest): Observable<TicketType> {
    return this.http.put<TicketType>(`${this.base}/ticket-types/${id}`, request);
  }

  checkIn(ticketCode: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.base}/organizer/checkin`, { ticketCode });
  }

  report(eventId: number): Observable<EventReport> {
    return this.http.get<EventReport>(`${this.base}/organizer/events/${eventId}/report`);
  }

  reportPdf(eventId: number): Observable<Blob> {
    return this.http.get(`${this.base}/organizer/events/${eventId}/report/pdf`, {
      responseType: 'blob',
    });
  }
}

/** API quản trị: danh mục, địa điểm, báo cáo doanh thu. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL).replace(/\/$/, '');

  listCategories(page: PageQuery = {}): Observable<PageResponse<Category>> {
    return this.http.get<PageResponse<Category>>(`${this.base}/admin/categories`, {
      params: toParams({ page: page.page, size: page.size }),
    });
  }

  getCategory(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.base}/admin/categories/${id}`);
  }

  createCategory(request: CategoryRequest): Observable<Category> {
    return this.http.post<Category>(`${this.base}/admin/categories`, request);
  }

  updateCategory(id: number, request: CategoryRequest): Observable<Category> {
    return this.http.put<Category>(`${this.base}/admin/categories/${id}`, request);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/categories/${id}`);
  }

  listVenues(page: PageQuery = {}): Observable<PageResponse<Venue>> {
    return this.http.get<PageResponse<Venue>>(`${this.base}/admin/venues`, {
      params: toParams({ page: page.page, size: page.size }),
    });
  }

  getVenue(id: number): Observable<Venue> {
    return this.http.get<Venue>(`${this.base}/admin/venues/${id}`);
  }

  createVenue(request: VenueRequest): Observable<Venue> {
    return this.http.post<Venue>(`${this.base}/admin/venues`, request);
  }

  updateVenue(id: number, request: VenueRequest): Observable<Venue> {
    return this.http.put<Venue>(`${this.base}/admin/venues/${id}`, request);
  }

  deleteVenue(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/venues/${id}`);
  }

  revenueReport(from: string, to: string): Observable<RevenueReport> {
    return this.http.get<RevenueReport>(`${this.base}/admin/reports/revenue`, {
      params: toParams({ from, to }),
    });
  }
}

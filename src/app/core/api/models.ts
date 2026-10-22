// Kiểu dữ liệu khớp DTO backend (com.example.base.dto).
// Instant được serialize thành chuỗi ISO-8601; BigDecimal thành number.

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'ENDED';
export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED';
export type PaymentMethod = 'MOCK';
export type Role = 'ADMIN' | 'ORGANIZER' | 'CUSTOMER';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Venue {
  id: number;
  name: string;
  address: string;
  city: string;
  capacity: number;
}

export interface TicketType {
  id: number;
  eventId: number;
  name: string;
  price: number;
  totalQuantity: number;
  soldQuantity: number;
  availableQuantity: number;
  maxPerOrder: number;
  saleStart: string | null;
  saleEnd: string | null;
}

export interface EventSummary {
  id: number;
  title: string;
  bannerUrl: string | null;
  startTime: string;
  endTime: string;
  category: Category;
  venue: Venue;
}

export interface EventDetail {
  id: number;
  title: string;
  description: string | null;
  bannerUrl: string | null;
  startTime: string;
  endTime: string;
  category: Category;
  venue: Venue;
  ticketTypes: TicketType[];
}

export interface EventItem {
  id: number;
  organizerId: number;
  category: Category;
  venue: Venue;
  title: string;
  description: string | null;
  bannerUrl: string | null;
  startTime: string;
  endTime: string;
  status: EventStatus;
  createdAt: string;
}

export interface OrderItem {
  id: number;
  ticketTypeId: number;
  ticketTypeName: string;
  eventId: number;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: number;
  orderCode: string;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  expiresAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderSummary {
  id: number;
  orderCode: string;
  status: OrderStatus;
  totalAmount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketCode: string;
  status: TicketStatus;
  checkedInAt: string | null;
  orderId: number;
  eventId: number;
  eventTitle: string;
  startTime: string;
  endTime: string;
  ticketTypeId: number;
  ticketTypeName: string;
}

export interface DailyRevenue {
  date: string;
  paidOrders: number;
  revenue: number;
}

export interface TopEvent {
  eventId: number;
  eventTitle: string;
  ticketsSold: number;
  revenue: number;
}

export interface EventReport {
  eventId: number;
  eventTitle: string;
  paidOrders: number;
  ticketsSold: number;
  revenue: number;
  dailyRevenue: DailyRevenue[];
}

export interface RevenueReport {
  from: string;
  to: string;
  paidOrders: number;
  revenue: number;
  dailyRevenue: DailyRevenue[];
  topEvents: TopEvent[];
}

// ----- Request payloads -----

export interface EventFilter {
  categoryId?: number | null;
  city?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface CreateOrderRequest {
  ticketTypeId: number;
  quantity: number;
}

export interface PayOrderRequest {
  method: PaymentMethod;
  simulateFailure: boolean;
}

export interface EventRequest {
  categoryId: number;
  venueId: number;
  title: string;
  description?: string | null;
  bannerUrl?: string | null;
  startTime: string;
  endTime: string;
}

export interface TicketTypeRequest {
  name: string;
  price: number;
  totalQuantity: number;
  maxPerOrder: number;
  saleStart?: string | null;
  saleEnd?: string | null;
}

export interface CategoryRequest {
  name: string;
  slug: string;
}

export interface VenueRequest {
  name: string;
  address: string;
  city: string;
  capacity: number;
}

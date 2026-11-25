export type Role = 'CUSTOMER' | 'SUPPORT' | 'ADMIN';

export type OrderStatus = 'PLACED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketCategory =
  | 'ORDER_ISSUE'
  | 'RETURN_REFUND'
  | 'PAYMENT'
  | 'PRODUCT_QUESTION'
  | 'OTHER';

export type SenderType = 'CUSTOMER' | 'AGENT' | 'AI' | 'STAFF' | 'SYSTEM';

export type RefundStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'PROCESSED'
  | 'FAILED';

export type EscalationDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface OrderItem {
  name: string;
  category: string;
  qty: number;
  unitPrice: number;
}

export interface RefundSummary {
  id: string;
  orderId: string;
  ticketId: string | null;
  amount: number;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  reviewedBy: string | null;
  idempotencyKey: string;
  paymentRef: string | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    displayId: string;
    totalAmount: number;
    status: OrderStatus;
    deliveryDate?: string | null;
    customer?: { id: string; name: string; email: string };
  };
  ticket?: { id: string; subject: string; status: TicketStatus; priority?: Priority } | null;
  reviewer?: { id: string; name: string; email: string } | null;
}

export interface Order {
  id: string;
  displayId: string;
  customerId: string;
  status: OrderStatus;
  deliveryDate: string | null;
  totalAmount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; email: string };
  refunds?: RefundSummary[];
  tickets?: Array<{
    id: string;
    subject: string;
    status: TicketStatus;
    priority: Priority;
    createdAt: string;
  }>;
}

export interface OrderEligibility {
  eligible: boolean;
  reasons: string[];
  returnWindowDays: number;
  daysSinceDelivery: number | null;
  refundableAmount: number;
}

export interface MessageItem {
  id: string;
  ticketId: string;
  senderId: string | null;
  senderType: SenderType;
  content: string;
  createdAt: string;
  sender?: { id: string; name: string; role: Role } | null;
}

export interface InternalNoteItem {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author?: { id: string; name: string; email: string; role: Role };
}

export interface EscalationItem {
  id: string;
  ticketId: string;
  summary: string;
  priority: Priority;
  assignedToId: string | null;
  decision: EscalationDecision;
  internalNote?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { id: string; name: string; email: string } | null;
  ticket?: TicketDetail;
}

export interface TicketSummary {
  id: string;
  customerId: string;
  orderId: string | null;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: Priority;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; email: string };
  assignee?: { id: string; name: string; email: string } | null;
  order?: { id: string; displayId: string; status: OrderStatus; totalAmount: number } | null;
  _count?: { messages: number; refunds: number; escalations: number };
}

export interface TicketDetail extends TicketSummary {
  order: Order | null;
  messages: MessageItem[];
  refunds: RefundSummary[];
  escalations: EscalationItem[];
  notes?: InternalNoteItem[];
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ChatResponse {
  reply: string;
  ticketId: string;
  actions: Array<{ type: string; summary: string }>;
}

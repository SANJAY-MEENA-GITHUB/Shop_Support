import {
  EscalationDecision,
  OrderStatus,
  Priority,
  RefundStatus,
  TicketStatus,
} from '../lib/types';

type AnyStatus = OrderStatus | TicketStatus | RefundStatus | EscalationDecision | Priority;

function getTone(status: AnyStatus): 'signal' | 'amber' | 'red' | 'muted' {
  switch (status) {
    case 'DELIVERED':
    case 'RESOLVED':
    case 'APPROVED':
    case 'PROCESSED':
    case 'LOW':
      return 'signal';
    case 'OPEN':
    case 'IN_PROGRESS':
    case 'ESCALATED':
    case 'PENDING_REVIEW':
    case 'PENDING':
    case 'NEEDS_INFO':
    case 'SHIPPED':
    case 'PLACED':
    case 'MEDIUM':
    case 'HIGH':
      return 'amber';
    case 'REJECTED':
    case 'FAILED':
    case 'CANCELLED':
    case 'URGENT':
      return 'red';
    case 'CLOSED':
    case 'RETURNED':
    default:
      return 'muted';
  }
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const tone = getTone(status);
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" aria-hidden="true" />
      <span>{status.replace(/_/g, ' ')}</span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <StatusBadge status={priority} />;
}

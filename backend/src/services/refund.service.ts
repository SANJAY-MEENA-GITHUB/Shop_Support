import {
  EscalationDecision,
  OrderStatus,
  Priority,
  RefundStatus,
  Role,
  SenderType,
  TicketCategory,
  TicketStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError, businessRule, conflict, notFound } from '../lib/errors';
import { isStaff } from '../middleware/auth';
import { logAudit } from './audit.service';
import { SimulatedPaymentService } from './payment.simulated';
import { getPaginationParams } from '../utils/pagination';

export const RETURN_WINDOW_DAYS = 14;
export const ESCALATION_THRESHOLD = 5000;

const ACTIVE_REFUND_STATUSES: RefundStatus[] = [
  RefundStatus.PENDING_REVIEW,
  RefundStatus.APPROVED,
  RefundStatus.ESCALATED,
  RefundStatus.PROCESSED,
];

const VALID_REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  PENDING_REVIEW: [RefundStatus.APPROVED, RefundStatus.REJECTED, RefundStatus.ESCALATED],
  ESCALATED: [RefundStatus.APPROVED, RefundStatus.REJECTED],
  APPROVED: [RefundStatus.PROCESSED, RefundStatus.FAILED],
  FAILED: [RefundStatus.APPROVED],
  REJECTED: [],
  PROCESSED: [],
};

export function serializeRefund(refund: {
  id: string;
  orderId: string;
  ticketId: string | null;
  amount: unknown;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  reviewedBy: string | null;
  idempotencyKey: string;
  paymentRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  order?: {
    id: string;
    displayId: string;
    totalAmount: unknown;
    status: OrderStatus;
    customerId: string;
  };
}) {
  return {
    ...refund,
    amount: Number(refund.amount),
    order: refund.order
      ? {
          ...refund.order,
          totalAmount: Number(refund.order.totalAmount),
        }
      : undefined,
  };
}

export async function findOrderForRequester(
  orderIdOrDisplayId: string,
  requesterId: string,
  requesterRole: Role
) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderIdOrDisplayId }, { displayId: orderIdOrDisplayId.toUpperCase() }],
    },
    include: {
      refunds: true,
    },
  });

  if (!order) {
    throw notFound('Order not found');
  }

  if (!isStaff(requesterRole) && order.customerId !== requesterId) {
    throw notFound('Order not found');
  }

  return order;
}

export async function validateEligibility(
  orderIdOrDisplayId: string,
  requesterId: string,
  requesterRole: Role,
  requestedAmount?: number
) {
  const order = await findOrderForRequester(orderIdOrDisplayId, requesterId, requesterRole);

  const activeRefunds = order.refunds.filter((r) =>
    ACTIVE_REFUND_STATUSES.includes(r.status)
  );
  const refundedSum = activeRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const refundableAmount = Math.max(0, Number(order.totalAmount) - refundedSum);

  let daysSinceDelivery: number | null = null;
  let withinWindow = false;

  if (order.deliveryDate) {
    const msDiff = Date.now() - order.deliveryDate.getTime();
    daysSinceDelivery = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
    withinWindow = msDiff <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  }

  const reasons: string[] = [];

  if (order.status !== OrderStatus.DELIVERED) {
    reasons.push('Order has not been delivered');
  } else if (!order.deliveryDate || !withinWindow) {
    reasons.push(
      `Return window of ${RETURN_WINDOW_DAYS} days has expired` +
        (daysSinceDelivery !== null ? ` (delivered ${daysSinceDelivery} days ago)` : '')
    );
  }

  if (activeRefunds.length > 0) {
    reasons.push('A refund is already in progress or processed for this order');
  }

  if (refundableAmount <= 0) {
    reasons.push('No refundable balance remaining');
  } else if (
    requestedAmount !== undefined &&
    (requestedAmount <= 0 || requestedAmount > refundableAmount)
  ) {
    reasons.push('Amount exceeds refundable balance');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    returnWindowDays: RETURN_WINDOW_DAYS,
    daysSinceDelivery,
    refundableAmount,
    order,
    hasActiveRefund: activeRefunds.length > 0,
  };
}

export async function executeRefund(
  refundId: string,
  actorId: string,
  reasonOverride?: string
) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { order: true },
  });

  if (!refund) {
    throw notFound('Refund not found');
  }

  if (!VALID_REFUND_TRANSITIONS[refund.status].includes(RefundStatus.PROCESSED)) {
    throw businessRule(`Cannot execute refund in status ${refund.status}`);
  }

  let result;
  try {
    result = await SimulatedPaymentService.execute(
      Number(refund.amount),
      refund.idempotencyKey,
      reasonOverride ?? refund.reason
    );
  } catch (err) {
    result = {
      success: false,
      error: err instanceof Error ? err.message : 'Payment gateway error',
    };
  }

  if (!result.success) {
    const failed = await prisma.refund.update({
      where: { id: refund.id },
      data: { status: RefundStatus.FAILED },
      include: { order: true },
    });

    if (refund.ticketId) {
      await prisma.message.create({
        data: {
          ticketId: refund.ticketId,
          senderType: SenderType.SYSTEM,
          content: `Refund execution failed for ₹${Number(refund.amount).toFixed(2)}. Marked FAILED for staff retry.`,
        },
      });
    }

    void logAudit(actorId, 'REFUND_FAILED', 'Refund', refund.id, {
      orderId: refund.orderId,
      amount: Number(refund.amount),
      error: result.error,
    });

    throw new ApiError(
      502,
      'PAYMENT_FAILED',
      result.error || 'Simulated payment gateway failed to process the refund'
    );
  }

  const processed = await prisma.$transaction(async (tx) => {
    const updated = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: RefundStatus.PROCESSED,
        paymentRef: result.paymentRef,
      },
      include: { order: true },
    });

    if (refund.ticketId) {
      await tx.message.create({
        data: {
          ticketId: refund.ticketId,
          senderType: SenderType.SYSTEM,
          content: `Refund of ₹${Number(refund.amount).toFixed(2)} processed successfully. Reference: ${result.paymentRef}`,
        },
      });

      await tx.ticket.updateMany({
        where: {
          id: refund.ticketId,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED] },
        },
        data: { status: TicketStatus.RESOLVED },
      });
    }

    return updated;
  });

  void logAudit(actorId, 'REFUND_EXECUTED', 'Refund', processed.id, {
    orderId: processed.orderId,
    amount: Number(processed.amount),
    paymentRef: processed.paymentRef,
  });

  return serializeRefund(processed);
}

export async function requestRefund(input: {
  orderId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  ticketId?: string;
  requestedBy: string;
  requesterRole: Role;
  viaAgent?: boolean;
}) {
  // R6: Check idempotency key first
  const existingByKey = await prisma.refund.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { order: true },
  });

  if (existingByKey) {
    if (!isStaff(input.requesterRole) && existingByKey.order.customerId !== input.requestedBy) {
      throw notFound('Order not found');
    }

    const sameOrder =
      existingByKey.orderId === input.orderId ||
      existingByKey.order.displayId === input.orderId.toUpperCase();
    const sameAmount = Number(existingByKey.amount) === Number(input.amount);
    const sameReason = existingByKey.reason === input.reason;

    if (sameOrder && sameAmount && sameReason) {
      return {
        refund: serializeRefund(existingByKey),
        isReplay: true,
      };
    }

    throw conflict('Idempotency key already used with a different refund payload');
  }

  // R1 & eligibility: fetch order once and evaluate balance/window
  const eligibility = await validateEligibility(
    input.orderId,
    input.requestedBy,
    input.requesterRole,
    input.amount
  );
  const order = eligibility.order;

  // Verify ticket ownership if ticketId provided
  if (input.ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: input.ticketId },
    });
    if (!ticket || (!isStaff(input.requesterRole) && ticket.customerId !== input.requestedBy)) {
      throw notFound('Ticket not found');
    }
  }

  // R5: Duplicate active refund
  if (eligibility.hasActiveRefund) {
    throw conflict('A refund is already in progress or processed for this order');
  }

  // R2: Must be DELIVERED
  if (order.status !== OrderStatus.DELIVERED) {
    throw businessRule('Order has not been delivered');
  }

  // R3: Return window check (14 days)
  const msDiff = order.deliveryDate ? Date.now() - order.deliveryDate.getTime() : Infinity;
  if (!order.deliveryDate || msDiff > RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    const windowMessage =
      `Return window of ${RETURN_WINDOW_DAYS} days has expired` +
      (eligibility.daysSinceDelivery !== null
        ? ` (order delivered ${eligibility.daysSinceDelivery} days ago)`
        : '');

    if (input.viaAgent) {
      const rejected = await prisma.refund.create({
        data: {
          orderId: order.id,
          ticketId: input.ticketId ?? null,
          amount: input.amount,
          reason: input.reason,
          status: RefundStatus.REJECTED,
          requestedBy: input.requestedBy,
          idempotencyKey: input.idempotencyKey,
        },
        include: { order: true },
      });

      if (input.ticketId) {
        await prisma.message.create({
          data: {
            ticketId: input.ticketId,
            senderType: SenderType.SYSTEM,
            content: `Refund request rejected: ${windowMessage}`,
          },
        });
      }

      void logAudit(input.requestedBy, 'REFUND_REJECTED', 'Refund', rejected.id, {
        orderId: order.id,
        reason: windowMessage,
      });

      return {
        refund: serializeRefund(rejected),
        isReplay: false,
        rejectedReason: windowMessage,
      };
    }

    throw businessRule(windowMessage);
  }

  // R4: Amount <= refundable balance
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > eligibility.refundableAmount) {
    throw businessRule(
      `Amount exceeds refundable balance of ₹${eligibility.refundableAmount.toFixed(2)}`
    );
  }

  // R7: Amount > ₹5,000 -> Escalate for human review (never auto-process)
  if (input.amount > ESCALATION_THRESHOLD) {
    const { refund, escalation } = await prisma.$transaction(async (tx) => {
      let targetTicketId = input.ticketId;

      if (!targetTicketId) {
        const createdTicket = await tx.ticket.create({
          data: {
            customerId: order.customerId,
            orderId: order.id,
            category: TicketCategory.RETURN_REFUND,
            subject: `Refund escalation for ${order.displayId}`,
            description: input.reason.length >= 20 ? input.reason : `${input.reason} — High-value refund review`,
            status: TicketStatus.ESCALATED,
            priority: Priority.HIGH,
          },
        });
        targetTicketId = createdTicket.id;
      } else {
        await tx.ticket.update({
          where: { id: targetTicketId },
          data: {
            status: TicketStatus.ESCALATED,
            priority: Priority.HIGH,
            orderId: order.id,
          },
        });
      }

      const createdRefund = await tx.refund.create({
        data: {
          orderId: order.id,
          ticketId: targetTicketId,
          amount: input.amount,
          reason: input.reason,
          status: RefundStatus.ESCALATED,
          requestedBy: input.requestedBy,
          idempotencyKey: input.idempotencyKey,
        },
        include: { order: true },
      });

      const createdEscalation = await tx.escalation.create({
        data: {
          ticketId: targetTicketId,
          summary: `Refund of ₹${input.amount.toFixed(2)} for ${order.displayId} exceeds ₹${ESCALATION_THRESHOLD} auto-approval limit. Reason: ${input.reason}`,
          priority: Priority.HIGH,
          decision: EscalationDecision.PENDING,
        },
      });

      await tx.message.create({
        data: {
          ticketId: targetTicketId,
          senderType: SenderType.SYSTEM,
          content: `Refund request of ₹${input.amount.toFixed(2)} for ${order.displayId} exceeds ₹5,000 and has been escalated for human review.`,
        },
      });

      return { refund: createdRefund, escalation: createdEscalation };
    });

    void logAudit(input.requestedBy, 'REFUND_REQUESTED', 'Refund', refund.id, {
      orderId: order.id,
      amount: input.amount,
      status: RefundStatus.ESCALATED,
    });
    void logAudit(input.requestedBy, 'ESCALATION_CREATED', 'Escalation', escalation.id, {
      ticketId: refund.ticketId,
      refundId: refund.id,
      amount: input.amount,
    });

    return {
      refund: serializeRefund(refund),
      escalation,
      isReplay: false,
    };
  }

  // R8: Eligible and <= ₹5,000 -> Create APPROVED and execute via simulated payment
  const approved = await prisma.refund.create({
    data: {
      orderId: order.id,
      ticketId: input.ticketId ?? null,
      amount: input.amount,
      reason: input.reason,
      status: RefundStatus.APPROVED,
      requestedBy: input.requestedBy,
      idempotencyKey: input.idempotencyKey,
    },
    include: { order: true },
  });

  void logAudit(input.requestedBy, 'REFUND_REQUESTED', 'Refund', approved.id, {
    orderId: order.id,
    amount: input.amount,
    status: RefundStatus.APPROVED,
  });
  void logAudit(input.requestedBy, 'REFUND_APPROVED', 'Refund', approved.id, {
    orderId: order.id,
    autoApproved: true,
  });

  const processed = await executeRefund(approved.id, input.requestedBy, input.reason);

  return {
    refund: processed,
    isReplay: false,
  };
}

export async function listRefunds(
  requesterId: string,
  requesterRole: Role,
  filters: { status?: RefundStatus; orderSearch?: string; page?: number; limit?: number }
) {
  const { page, limit, skip, take } = getPaginationParams(filters.page, filters.limit);

  const where: Record<string, unknown> = {};
  if (!isStaff(requesterRole)) {
    where.order = { customerId: requesterId };
  } else if (filters.orderSearch) {
    where.order = {
      OR: [
        { displayId: { contains: filters.orderSearch, mode: 'insensitive' } },
        { customer: { name: { contains: filters.orderSearch, mode: 'insensitive' } } },
        { customer: { email: { contains: filters.orderSearch, mode: 'insensitive' } } },
      ],
    };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const [rows, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            displayId: true,
            totalAmount: true,
            status: true,
            customerId: true,
            customer: { select: { id: true, name: true, email: true } },
          },
        },
        ticket: { select: { id: true, subject: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.refund.count({ where }),
  ]);

  return {
    data: rows.map((r) => serializeRefund(r)),
    page,
    limit,
    total,
  };
}

export async function getRefundById(
  refundId: string,
  requesterId: string,
  requesterRole: Role
) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      order: {
        select: {
          id: true,
          displayId: true,
          totalAmount: true,
          status: true,
          deliveryDate: true,
          customerId: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      },
      ticket: {
        select: { id: true, subject: true, status: true, priority: true },
      },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!refund) {
    throw notFound('Refund not found');
  }

  if (!isStaff(requesterRole) && refund.order.customerId !== requesterId) {
    throw notFound('Refund not found');
  }

  return serializeRefund(refund);
}

export async function reviewRefund(
  refundId: string,
  reviewerId: string,
  input: { decision: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO'; note?: string }
) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { order: true },
  });

  if (!refund) {
    throw notFound('Refund not found');
  }

  if (
    refund.status !== RefundStatus.PENDING_REVIEW &&
    refund.status !== RefundStatus.ESCALATED &&
    refund.status !== RefundStatus.FAILED
  ) {
    throw businessRule(`Cannot review refund in status ${refund.status}`);
  }

  if (input.decision === 'NEEDS_INFO') {
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.PENDING_REVIEW,
          reviewedBy: reviewerId,
        },
        include: { order: true },
      });

      if (refund.ticketId) {
        await tx.message.create({
          data: {
            ticketId: refund.ticketId,
            senderId: reviewerId,
            senderType: SenderType.STAFF,
            content: input.note
              ? `More information requested for your refund: ${input.note}`
              : 'Support staff requested additional information before processing your refund.',
          },
        });
      }
      return r;
    });

    void logAudit(reviewerId, 'REFUND_NEEDS_INFO', 'Refund', refund.id, { note: input.note });
    return serializeRefund(updated);
  }

  if (input.decision === 'REJECTED') {
    const rejected = await prisma.$transaction(async (tx) => {
      const r = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.REJECTED,
          reviewedBy: reviewerId,
        },
        include: { order: true },
      });

      if (refund.ticketId) {
        await tx.escalation.updateMany({
          where: { ticketId: refund.ticketId, decision: EscalationDecision.PENDING },
          data: {
            decision: EscalationDecision.REJECTED,
            assignedToId: reviewerId,
            internalNote: input.note ?? null,
          },
        });

        await tx.message.create({
          data: {
            ticketId: refund.ticketId,
            senderId: reviewerId,
            senderType: SenderType.STAFF,
            content: input.note
              ? `Refund request rejected: ${input.note}`
              : 'Refund request has been rejected after staff review.',
          },
        });
      }

      return r;
    });

    void logAudit(reviewerId, 'REFUND_REJECTED', 'Refund', refund.id, { note: input.note });
    return serializeRefund(rejected);
  }

  // APPROVED -> transition to APPROVED and execute simulated payment
  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: RefundStatus.APPROVED,
        reviewedBy: reviewerId,
      },
    });

    if (refund.ticketId) {
      await tx.escalation.updateMany({
        where: { ticketId: refund.ticketId, decision: EscalationDecision.PENDING },
        data: {
          decision: EscalationDecision.APPROVED,
          assignedToId: reviewerId,
          internalNote: input.note ?? null,
        },
      });
    }
  });

  void logAudit(reviewerId, 'REFUND_APPROVED', 'Refund', refund.id, { note: input.note });
  return executeRefund(refund.id, reviewerId);
}

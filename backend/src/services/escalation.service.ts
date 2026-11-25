import {
  EscalationDecision,
  Priority,
  RefundStatus,
  Role,
  SenderType,
  TicketStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { businessRule, notFound } from '../lib/errors';
import { isStaff } from '../middleware/auth';
import { getPaginationParams } from '../utils/pagination';
import { logAudit } from './audit.service';
import { executeRefund, serializeRefund } from './refund.service';

export async function createEscalation(input: {
  ticketId: string;
  summary: string;
  priority: Priority;
  actorId: string;
  actorRole: Role;
  internalNote?: string;
}) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
  });

  if (!ticket) {
    throw notFound('Ticket not found');
  }

  if (!isStaff(input.actorRole) && ticket.customerId !== input.actorId) {
    throw notFound('Ticket not found');
  }

  if (ticket.status === TicketStatus.CLOSED) {
    throw businessRule('Cannot escalate a closed ticket');
  }

  const escalation = await prisma.$transaction(async (tx) => {
    const created = await tx.escalation.create({
      data: {
        ticketId: ticket.id,
        summary: input.summary.trim(),
        priority: input.priority,
        decision: EscalationDecision.PENDING,
        internalNote: input.internalNote?.trim() ?? null,
      },
    });

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.ESCALATED,
        priority: input.priority,
      },
    });

    await tx.message.create({
      data: {
        ticketId: ticket.id,
        senderType: SenderType.SYSTEM,
        content: `Ticket escalated (${input.priority}): ${input.summary.trim()}`,
      },
    });

    return created;
  });

  void logAudit(input.actorId, 'ESCALATION_CREATED', 'Escalation', escalation.id, {
    ticketId: ticket.id,
    priority: input.priority,
  });

  return escalation;
}

export async function listEscalations(filters: {
  decision?: EscalationDecision;
  priority?: Priority;
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = getPaginationParams(filters.page, filters.limit);

  const where: Record<string, unknown> = {};
  if (filters.decision) where.decision = filters.decision;
  if (filters.priority) where.priority = filters.priority;

  const [rows, total] = await Promise.all([
    prisma.escalation.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        ticket: {
          select: {
            id: true,
            subject: true,
            status: true,
            priority: true,
            category: true,
            customer: { select: { id: true, name: true, email: true } },
            order: { select: { id: true, displayId: true, totalAmount: true, status: true } },
            refunds: {
              select: { id: true, amount: true, status: true, paymentRef: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.escalation.count({ where }),
  ]);

  return {
    data: rows.map((e) => ({
      ...e,
      ticket: {
        ...e.ticket,
        order: e.ticket.order
          ? { ...e.ticket.order, totalAmount: Number(e.ticket.order.totalAmount) }
          : null,
        refunds: e.ticket.refunds.map((r) => ({ ...r, amount: Number(r.amount) })),
      },
    })),
    page,
    limit,
    total,
  };
}

export async function getEscalationById(escalationId: string) {
  const escalation = await prisma.escalation.findUnique({
    where: { id: escalationId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      ticket: {
        include: {
          customer: { select: { id: true, name: true, email: true } },
          order: true,
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { id: true, name: true, role: true } } },
          },
          refunds: { orderBy: { createdAt: 'desc' } },
          notes: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });

  if (!escalation) {
    throw notFound('Escalation not found');
  }

  return {
    ...escalation,
    ticket: {
      ...escalation.ticket,
      order: escalation.ticket.order
        ? {
            ...escalation.ticket.order,
            totalAmount: Number(escalation.ticket.order.totalAmount),
          }
        : null,
      refunds: escalation.ticket.refunds.map((r) => serializeRefund(r)),
    },
  };
}

export async function decideEscalation(
  escalationId: string,
  staffId: string,
  input: {
    decision: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';
    internalNote?: string;
    assignedToId?: string;
  }
) {
  const escalation = await prisma.escalation.findUnique({
    where: { id: escalationId },
    include: {
      ticket: {
        include: { refunds: true },
      },
    },
  });

  if (!escalation) {
    throw notFound('Escalation not found');
  }

  if (
    escalation.decision !== EscalationDecision.PENDING &&
    escalation.decision !== EscalationDecision.NEEDS_INFO
  ) {
    throw businessRule(`Escalation has already been decided (${escalation.decision})`);
  }

  const pendingRefunds = escalation.ticket.refunds.filter(
    (r) => r.status === RefundStatus.ESCALATED || r.status === RefundStatus.PENDING_REVIEW
  );

  const updatedEscalation = await prisma.$transaction(async (tx) => {
    const esc = await tx.escalation.update({
      where: { id: escalation.id },
      data: {
        decision: input.decision,
        internalNote: input.internalNote?.trim() ?? escalation.internalNote,
        assignedToId: input.assignedToId ?? staffId,
      },
    });

    if (input.decision === 'APPROVED') {
      for (const r of pendingRefunds) {
        await tx.refund.update({
          where: { id: r.id },
          data: { status: RefundStatus.APPROVED, reviewedBy: staffId },
        });
      }

      if (pendingRefunds.length === 0) {
        await tx.ticket.update({
          where: { id: escalation.ticketId },
          data: { status: TicketStatus.RESOLVED },
        });
        await tx.message.create({
          data: {
            ticketId: escalation.ticketId,
            senderId: staffId,
            senderType: SenderType.STAFF,
            content: 'Escalated case approved by support staff.',
          },
        });
      }
    } else if (input.decision === 'REJECTED') {
      for (const r of pendingRefunds) {
        await tx.refund.update({
          where: { id: r.id },
          data: { status: RefundStatus.REJECTED, reviewedBy: staffId },
        });
      }

      await tx.ticket.update({
        where: { id: escalation.ticketId },
        data: { status: TicketStatus.RESOLVED },
      });

      await tx.message.create({
        data: {
          ticketId: escalation.ticketId,
          senderId: staffId,
          senderType: SenderType.STAFF,
          content: input.internalNote
            ? `Escalated request rejected by support staff. Note: ${input.internalNote}`
            : 'Escalated request was reviewed and rejected by support staff.',
        },
      });
    } else {
      await tx.ticket.update({
        where: { id: escalation.ticketId },
        data: { status: TicketStatus.IN_PROGRESS },
      });

      await tx.message.create({
        data: {
          ticketId: escalation.ticketId,
          senderId: staffId,
          senderType: SenderType.STAFF,
          content: input.internalNote
            ? `Support staff requested more information: ${input.internalNote}`
            : 'Support staff requested additional information to continue reviewing your case.',
        },
      });
    }

    return esc;
  });

  // Execute approved refunds outside the escalation tx so payment failures are persisted cleanly
  if (input.decision === 'APPROVED') {
    for (const r of pendingRefunds) {
      void logAudit(staffId, 'REFUND_APPROVED', 'Refund', r.id, {
        escalationId: escalation.id,
      });
      await executeRefund(r.id, staffId);
    }
  } else if (input.decision === 'REJECTED') {
    for (const r of pendingRefunds) {
      void logAudit(staffId, 'REFUND_REJECTED', 'Refund', r.id, {
        escalationId: escalation.id,
      });
    }
  }

  void logAudit(staffId, 'ESCALATION_DECIDED', 'Escalation', escalation.id, {
    decision: input.decision,
    ticketId: escalation.ticketId,
  });

  return getEscalationById(updatedEscalation.id);
}

import {
  EscalationDecision,
  Priority,
  Role,
  SenderType,
  TicketCategory,
  TicketStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { businessRule, notFound } from '../lib/errors';
import { isStaff } from '../middleware/auth';
import { getPaginationParams } from '../utils/pagination';
import { logAudit } from './audit.service';
import { findOrderForRequester, serializeRefund } from './refund.service';

const VALID_TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED, TicketStatus.RESOLVED],
  IN_PROGRESS: [TicketStatus.RESOLVED, TicketStatus.ESCALATED],
  ESCALATED: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  RESOLVED: [TicketStatus.CLOSED],
  CLOSED: [],
};

export async function createTicket(input: {
  customerId: string;
  category: TicketCategory;
  subject: string;
  description: string;
  orderId?: string;
}) {
  let resolvedOrderId: string | null = null;
  if (input.orderId) {
    const order = await findOrderForRequester(
      input.orderId,
      input.customerId,
      Role.CUSTOMER
    );
    resolvedOrderId = order.id;
  }

  const trimmedSubject = input.subject.trim();
  const trimmedDescription = input.description.trim();

  const ticket = await prisma.ticket.create({
    data: {
      customerId: input.customerId,
      orderId: resolvedOrderId,
      category: input.category,
      subject: trimmedSubject,
      description: trimmedDescription,
      status: TicketStatus.OPEN,
      priority: Priority.MEDIUM,
      messages: {
        create: {
          senderId: input.customerId,
          senderType: SenderType.CUSTOMER,
          content: trimmedDescription,
        },
      },
    },
    include: {
      order: { select: { id: true, displayId: true, status: true, totalAmount: true } },
    },
  });

  return {
    ...ticket,
    order: ticket.order
      ? { ...ticket.order, totalAmount: Number(ticket.order.totalAmount) }
      : null,
  };
}

export async function listTickets(
  requesterId: string,
  requesterRole: Role,
  filters: {
    search?: string;
    status?: TicketStatus;
    priority?: Priority;
    category?: TicketCategory;
    assigneeId?: string;
    sort?: 'newest' | 'oldest' | 'priority';
    page?: number;
    limit?: number;
  }
) {
  const { page, limit, skip, take } = getPaginationParams(filters.page, filters.limit);

  const where: Record<string, unknown> = {};
  if (!isStaff(requesterRole)) {
    where.customerId = requesterId;
  }

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.category) where.category = filters.category;
  if (filters.assigneeId && isStaff(requesterRole)) {
    where.assigneeId = filters.assigneeId;
  }

  if (filters.search) {
    where.OR = [
      { id: { contains: filters.search, mode: 'insensitive' } },
      { subject: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { order: { displayId: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const orderBy =
    filters.sort === 'oldest'
      ? { createdAt: 'asc' as const }
      : filters.sort === 'priority'
        ? [{ priority: 'desc' as const }, { createdAt: 'desc' as const }]
        : { createdAt: 'desc' as const };

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, displayId: true, status: true, totalAmount: true } },
        _count: { select: { messages: true, refunds: true, escalations: true } },
      },
      orderBy,
      skip,
      take,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    data: rows.map((t) => ({
      ...t,
      order: t.order ? { ...t.order, totalAmount: Number(t.order.totalAmount) } : null,
    })),
    page,
    limit,
    total,
  };
}

export async function getTicketDetail(
  ticketId: string,
  requesterId: string,
  requesterRole: Role
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      order: {
        select: {
          id: true,
          displayId: true,
          status: true,
          deliveryDate: true,
          totalAmount: true,
          items: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
      refunds: {
        orderBy: { createdAt: 'desc' },
      },
      escalations: {
        orderBy: { createdAt: 'desc' },
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!ticket) {
    throw notFound('Ticket not found');
  }

  if (!isStaff(requesterRole) && ticket.customerId !== requesterId) {
    throw notFound('Ticket not found');
  }

  return {
    ...ticket,
    order: ticket.order
      ? { ...ticket.order, totalAmount: Number(ticket.order.totalAmount) }
      : null,
    refunds: ticket.refunds.map((r) => serializeRefund(r)),
    escalations: isStaff(requesterRole)
      ? ticket.escalations
      : ticket.escalations.map(({ internalNote: _hidden, ...rest }) => rest),
  };
}

export async function updateTicketStatus(
  ticketId: string,
  actorId: string,
  input: {
    status: TicketStatus;
    priority?: Priority;
    assigneeId?: string | null;
  }
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw notFound('Ticket not found');
  }

  if (input.status !== ticket.status) {
    const allowed = VALID_TICKET_TRANSITIONS[ticket.status];
    if (!allowed.includes(input.status)) {
      throw businessRule(
        `Invalid ticket status transition from ${ticket.status} to ${input.status}`
      );
    }
  }

  if (input.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: input.assigneeId },
      select: { id: true, role: true },
    });
    if (!assignee || !isStaff(assignee.role)) {
      throw businessRule('Assignee must be a support or admin user');
    }
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: input.status,
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  void logAudit(actorId, 'TICKET_STATUS_CHANGED', 'Ticket', ticket.id, {
    fromStatus: ticket.status,
    toStatus: input.status,
    priority: input.priority ?? ticket.priority,
    assigneeId: updated.assigneeId,
  });

  return updated;
}

export async function addTicketMessage(
  ticketId: string,
  senderId: string,
  senderRole: Role,
  content: string
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw notFound('Ticket not found');
  }

  if (!isStaff(senderRole) && ticket.customerId !== senderId) {
    throw notFound('Ticket not found');
  }

  if (
    !isStaff(senderRole) &&
    (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED)
  ) {
    throw businessRule(
      'Cannot reply to a resolved or closed ticket. Please open a new ticket.'
    );
  }

  const senderType = isStaff(senderRole) ? SenderType.STAFF : SenderType.CUSTOMER;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        ticketId: ticket.id,
        senderId,
        senderType,
        content: content.trim(),
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    // If customer replies while an escalation is NEEDS_INFO, reopen escalation to PENDING
    if (!isStaff(senderRole)) {
      await tx.escalation.updateMany({
        where: { ticketId: ticket.id, decision: EscalationDecision.NEEDS_INFO },
        data: { decision: EscalationDecision.PENDING },
      });
    } else if (ticket.status === TicketStatus.OPEN) {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.IN_PROGRESS },
      });
    }

    return created;
  });

  return message;
}

export async function listTicketMessages(
  ticketId: string,
  requesterId: string,
  requesterRole: Role,
  page = 1,
  limit = 50
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, customerId: true },
  });

  if (!ticket) {
    throw notFound('Ticket not found');
  }

  if (!isStaff(requesterRole) && ticket.customerId !== requesterId) {
    throw notFound('Ticket not found');
  }

  const { page: p, limit: l, skip, take } = getPaginationParams(page, limit);
  const [rows, total] = await Promise.all([
    prisma.message.findMany({
      where: { ticketId },
      include: { sender: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
    prisma.message.count({ where: { ticketId } }),
  ]);

  return { data: rows, page: p, limit: l, total };
}

export async function addInternalNote(
  ticketId: string,
  authorId: string,
  content: string
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!ticket) {
    throw notFound('Ticket not found');
  }

  return prisma.internalNote.create({
    data: {
      ticketId,
      authorId,
      content: content.trim(),
    },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
    },
  });
}

export async function listInternalNotes(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!ticket) {
    throw notFound('Ticket not found');
  }

  const notes = await prisma.internalNote.findMany({
    where: { ticketId },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return { data: notes };
}

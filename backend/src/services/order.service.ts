import { OrderStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isStaff } from '../middleware/auth';
import { getPaginationParams } from '../utils/pagination';
import { findOrderForRequester, validateEligibility } from './refund.service';

export function serializeOrder<T extends { totalAmount: unknown }>(order: T) {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
  };
}

export async function listOrders(
  requesterId: string,
  requesterRole: Role,
  filters: {
    status?: OrderStatus;
    customerSearch?: string;
    page?: number;
    limit?: number;
  }
) {
  const { page, limit, skip, take } = getPaginationParams(filters.page, filters.limit);

  const where: Record<string, unknown> = {};
  if (!isStaff(requesterRole)) {
    where.customerId = requesterId;
  } else if (filters.customerSearch) {
    where.OR = [
      { displayId: { contains: filters.customerSearch, mode: 'insensitive' } },
      { customer: { name: { contains: filters.customerSearch, mode: 'insensitive' } } },
      { customer: { email: { contains: filters.customerSearch, mode: 'insensitive' } } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        refunds: {
          select: { id: true, amount: true, status: true, paymentRef: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: rows.map((o) => ({
      ...serializeOrder(o),
      refunds: o.refunds.map((r) => ({ ...r, amount: Number(r.amount) })),
    })),
    page,
    limit,
    total,
  };
}

export async function getOrderDetail(
  orderIdOrDisplayId: string,
  requesterId: string,
  requesterRole: Role
) {
  const baseOrder = await findOrderForRequester(
    orderIdOrDisplayId,
    requesterId,
    requesterRole
  );

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: baseOrder.id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      refunds: {
        orderBy: { createdAt: 'desc' },
      },
      tickets: {
        select: { id: true, subject: true, status: true, priority: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return {
    ...serializeOrder(order),
    refunds: order.refunds.map((r) => ({ ...r, amount: Number(r.amount) })),
  };
}

export async function getOrderEligibility(
  orderIdOrDisplayId: string,
  requesterId: string,
  requesterRole: Role
) {
  const result = await validateEligibility(
    orderIdOrDisplayId,
    requesterId,
    requesterRole
  );

  return {
    eligible: result.eligible,
    reasons: result.reasons,
    returnWindowDays: result.returnWindowDays,
    daysSinceDelivery: result.daysSinceDelivery,
    refundableAmount: result.refundableAmount,
  };
}

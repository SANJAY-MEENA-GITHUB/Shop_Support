import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { getPaginationParams } from '../utils/pagination';
import { logAudit } from './audit.service';

export async function listUsers(page = 1, limit = 20) {
  const { page: p, limit: l, skip, take } = getPaginationParams(page, limit);
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count(),
  ]);

  return { data: rows, page: p, limit: l, total };
}

export async function updateUserRole(
  targetUserId: string,
  role: Role,
  actorId: string
) {
  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });

  if (!existing) {
    throw notFound('User not found');
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  void logAudit(actorId, 'ROLE_CHANGED', 'User', updated.id, {
    fromRole: existing.role,
    toRole: role,
  });

  return updated;
}

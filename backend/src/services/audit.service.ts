import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'REFUND_REQUESTED'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED'
  | 'REFUND_NEEDS_INFO'
  | 'REFUND_EXECUTED'
  | 'REFUND_FAILED'
  | 'ESCALATION_CREATED'
  | 'ESCALATION_DECIDED'
  | 'TICKET_STATUS_CHANGED'
  | 'ROLE_CHANGED'
  | 'PROMPT_INJECTION_DETECTED';

export async function logAudit(
  userId: string | null | undefined,
  action: AuditAction,
  entity: string,
  entityId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId,
        details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (err) {
    logger.warn({ err, action, entity, entityId }, 'Failed to write audit log');
  }
}

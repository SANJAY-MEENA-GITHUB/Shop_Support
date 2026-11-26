import crypto from 'crypto';
import { Type, FunctionDeclaration } from '@google/genai';
import { Priority, Role } from '@prisma/client';
import { ApiError } from '../lib/errors';
import { requestRefund, validateEligibility } from '../services/refund.service';
import { createEscalation } from '../services/escalation.service';
import { searchReturnPolicy } from './policy';

export interface AgentToolContext {
  userId: string;
  role: Role;
  ticketId: string;
}

export interface AgentActionLog {
  type: string;
  summary: string;
}

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_order_details',
    description:
      'Retrieve order status, delivery date, item category, price, and refund eligibility for the authenticated customer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderId: {
          type: Type.STRING,
          description: 'Order UUID or display ID such as ORD-1001',
        },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'search_return_policy',
    description:
      'Retrieve relevant return, refund, order, or escalation policy rules from local policy documents.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: 'Product or ticket category (e.g. Electronics, Clothing, RETURN_REFUND)',
        },
        query: {
          type: Type.STRING,
          description: 'Search query describing the policy question',
        },
      },
      required: ['category', 'query'],
    },
  },
  {
    name: 'process_refund',
    description:
      'Request and process a refund for an order. Backend enforces ownership, delivery status, 14-day window, balance, and ₹5,000 escalation threshold.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderId: {
          type: Type.STRING,
          description: 'Order UUID or display ID such as ORD-1001',
        },
        amount: {
          type: Type.NUMBER,
          description: 'Refund amount in INR (₹)',
        },
        reason: {
          type: Type.STRING,
          description: 'Customer reason for the refund (at least 10 characters)',
        },
        idempotencyKey: {
          type: Type.STRING,
          description: 'Unique UUID key for this refund request',
        },
      },
      required: ['orderId', 'amount', 'reason', 'idempotencyKey'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Create an escalation with structured context for human support staff review.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticketId: {
          type: Type.STRING,
          description: 'Ticket ID to escalate',
        },
        summary: {
          type: Type.STRING,
          description: 'Concise summary of the issue and context for support staff',
        },
        priority: {
          type: Type.STRING,
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'Escalation priority level',
        },
      },
      required: ['ticketId', 'summary', 'priority'],
    },
  },
];

export const agentTools = {
  async get_order_details(ctx: AgentToolContext, args: { orderId: string }) {
    try {
      const eligibility = await validateEligibility(args.orderId, ctx.userId, ctx.role);
      const { order } = eligibility;
      return {
        orderId: order.displayId,
        id: order.id,
        status: order.status,
        deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString() : null,
        totalAmount: Number(order.totalAmount),
        items: order.items,
        refundableAmount: eligibility.refundableAmount,
        daysSinceDelivery: eligibility.daysSinceDelivery,
        eligible: eligibility.eligible,
        eligibilityReasons: eligibility.reasons,
      };
    } catch (err) {
      if (err instanceof ApiError) {
        return { error: err.code, message: err.message };
      }
      return { error: 'INTERNAL', message: 'Unable to retrieve order details' };
    }
  },

  async search_return_policy(
    _ctx: AgentToolContext,
    args: { category: string; query: string }
  ) {
    return searchReturnPolicy(args.category || 'RETURN_REFUND', args.query || 'return window');
  },

  async process_refund(
    ctx: AgentToolContext,
    args: {
      orderId: string;
      amount: number;
      reason: string;
      idempotencyKey?: string;
    }
  ) {
    try {
      const rawKey = args.idempotencyKey;
      const isUuid =
        typeof rawKey === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawKey);
      const idempotencyKey = isUuid ? rawKey : crypto.randomUUID();
      const safeReason =
        args.reason && args.reason.trim().length >= 10
          ? args.reason.trim()
          : 'Customer requested refund via support chat';

      const result = await requestRefund({
        orderId: args.orderId,
        amount: Number(args.amount),
        reason: safeReason,
        idempotencyKey,
        ticketId: ctx.ticketId,
        requestedBy: ctx.userId,
        requesterRole: ctx.role,
        viaAgent: true,
      });

      if (result.rejectedReason) {
        return {
          refundId: result.refund.id,
          status: 'REJECTED',
          message: result.rejectedReason,
        };
      }

      if (result.refund.status === 'ESCALATED') {
        return {
          refundId: result.refund.id,
          status: 'ESCALATED',
          message:
            'Refund exceeds ₹5,000 and has been escalated for human support review.',
        };
      }

      return {
        refundId: result.refund.id,
        status: result.refund.status,
        paymentRef: result.refund.paymentRef,
        message: `Refund of ₹${result.refund.amount} processed successfully.`,
      };
    } catch (err) {
      if (err instanceof ApiError) {
        return { error: err.code, message: err.message };
      }
      return { error: 'INTERNAL', message: 'Failed to process refund request' };
    }
  },

  async escalate_to_human(
    ctx: AgentToolContext,
    args: {
      ticketId?: string;
      summary: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    }
  ) {
    try {
      const priority =
        args.priority && args.priority in Priority
          ? (args.priority as Priority)
          : Priority.MEDIUM;

      const escalation = await createEscalation({
        ticketId: ctx.ticketId,
        summary: args.summary || 'Customer requested human support review.',
        priority,
        actorId: ctx.userId,
        actorRole: ctx.role,
      });

      return {
        escalationId: escalation.id,
        message: 'Your case has been escalated to a human support specialist.',
      };
    } catch (err) {
      if (err instanceof ApiError) {
        return { error: err.code, message: err.message };
      }
      return { error: 'INTERNAL', message: 'Failed to create escalation' };
    }
  },
};

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentToolContext
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'get_order_details':
      return agentTools.get_order_details(ctx, args as { orderId: string });
    case 'search_return_policy':
      return agentTools.search_return_policy(
        ctx,
        args as { category: string; query: string }
      );
    case 'process_refund':
      return agentTools.process_refund(
        ctx,
        args as {
          orderId: string;
          amount: number;
          reason: string;
          idempotencyKey?: string;
        }
      );
    case 'escalate_to_human':
      return agentTools.escalate_to_human(
        ctx,
        args as {
          ticketId?: string;
          summary: string;
          priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        }
      );
    default:
      return { error: 'UNKNOWN_TOOL', message: `Tool ${name} is not permitted` };
  }
}

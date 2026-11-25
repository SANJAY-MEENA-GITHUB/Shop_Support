import crypto from 'crypto';
import { logAudit } from '../services/audit.service';
import { AgentActionLog, AgentToolContext, agentTools } from './tools';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+|store\s+|your\s+)?(policy|policies|rules|instructions)/i,
  /bypass\s+(policy|rules|checks|validation|limit|threshold)/i,
  /override\s+(policy|rules|system|threshold)/i,
  /reveal\s+(your\s+)?system\s*prompt/i,
  /approve\s+.*(regardless|anyway|without\s+checking|outside\s+policy)/i,
];

function isPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

function extractOrderId(texts: string[]): string | null {
  for (const text of texts) {
    const ordMatch = text.match(/\b(ORD-\d+)\b/i);
    if (ordMatch) return ordMatch[1].toUpperCase();

    const uuidMatch = text.match(
      /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i
    );
    if (uuidMatch) return uuidMatch[1];
  }
  return null;
}

function extractAmount(text: string): number | null {
  const cleaned = text
    .replace(/\bORD-\d+\b/gi, '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '');
  const match = cleaned.match(/(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const num = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

export async function runMockAgent(params: {
  message: string;
  historyContents: string[];
  linkedOrderDisplayId?: string | null;
  ctx: AgentToolContext;
}): Promise<{ reply: string; actions: AgentActionLog[] }> {
  const { message, historyContents, linkedOrderDisplayId, ctx } = params;
  const actions: AgentActionLog[] = [];
  const lower = message.toLowerCase();

  // 1. Prompt injection defense
  if (isPromptInjection(message)) {
    void logAudit(ctx.userId, 'PROMPT_INJECTION_DETECTED', 'Ticket', ctx.ticketId, {
      messageLength: message.length,
    });
    return {
      reply:
        'I cannot ignore or override store refund policies, authorization rules, or the ₹5,000 approval limit. If you believe your case needs an exception, please ask to escalate to a human support specialist.',
      actions,
    };
  }

  // 2. Explicit request for human / escalation
  if (/\b(human|agent|escalate|supervisor|representative)\b/i.test(lower)) {
    const res = await agentTools.escalate_to_human(ctx, {
      ticketId: ctx.ticketId,
      summary: `Customer requested human assistance: ${message.slice(0, 200)}`,
      priority: 'MEDIUM',
    });
    actions.push({ type: 'escalate_to_human', summary: res.message });
    return {
      reply:
        'I have escalated this ticket to a human support specialist. They will review your conversation and follow up shortly.',
      actions,
    };
  }

  const orderId =
    extractOrderId([message, ...[...historyContents].reverse()]) ??
    linkedOrderDisplayId ??
    null;

  // 3. General policy question (when no order ID is provided and user asks about policy/rules)
  if (
    !orderId &&
    /\b(policy|window|rules|eligibility)\b/i.test(lower) &&
    !/\b(want|request|issue|process|give)\s+(a\s+)?refund\b/i.test(lower)
  ) {
    const policy = await agentTools.search_return_policy(ctx, {
      category: 'RETURN_REFUND',
      query: message,
    });
    actions.push({
      type: 'search_return_policy',
      summary: `Retrieved ${policy.chunks.length} policy chunks`,
    });
    const snippet = policy.chunks[0]?.text ?? 'Returns are accepted within 14 days of delivery.';
    return {
      reply: `Here is our policy summary: ${snippet.slice(0, 260)}`,
      actions,
    };
  }

  const wantsRefund = /\b(refund|return|money\s*back)\b/i.test(lower);

  // 4. Refund requested WITHOUT an order ID -> ask for order ID, NO tool calls
  if (wantsRefund && !orderId) {
    return {
      reply:
        'I can help check your refund eligibility. Could you please share your order ID (for example, ORD-1001)?',
      actions,
    };
  }

  // 4. Refund requested WITH an order ID -> check order, policy, then process_refund
  if (wantsRefund && orderId) {
    const orderResult = await agentTools.get_order_details(ctx, { orderId });
    if ('error' in orderResult) {
      actions.push({ type: 'get_order_details', summary: String(orderResult.message) });
      return {
        reply: `I could not find order ${orderId} under your account. Please double-check the order ID and try again.`,
        actions,
      };
    }

    actions.push({
      type: 'get_order_details',
      summary: `Checked ${orderResult.orderId} (${orderResult.status})`,
    });

    const items = Array.isArray(orderResult.items)
      ? (orderResult.items as Array<{ category?: string }>)
      : [];
    const category = items[0]?.category ?? 'RETURN_REFUND';
    const policy = await agentTools.search_return_policy(ctx, {
      category,
      query: 'return window refund limit',
    });
    actions.push({
      type: 'search_return_policy',
      summary: `Retrieved ${policy.chunks.length} policy chunks`,
    });

    const requestedAmount =
      extractAmount(message) ??
      (Number(orderResult.refundableAmount) > 0
        ? Number(orderResult.refundableAmount)
        : Number(orderResult.totalAmount));

    const refundResult = await agentTools.process_refund(ctx, {
      orderId: orderResult.orderId,
      amount: requestedAmount,
      reason: message.length >= 10 ? message : `Customer requested refund for ${orderResult.orderId}`,
      idempotencyKey: crypto.randomUUID(),
    });

    if ('error' in refundResult) {
      actions.push({ type: 'process_refund', summary: String(refundResult.message) });
      return {
        reply: `Per our return policy (14-day window for delivered orders), I could not process this refund: ${refundResult.message}`,
        actions,
      };
    }

    actions.push({
      type: 'process_refund',
      summary: `${refundResult.status}: ${refundResult.message}`,
    });

    if (refundResult.status === 'REJECTED') {
      return {
        reply: `Under our 14-day return policy, this refund request was rejected: ${refundResult.message}`,
        actions,
      };
    }

    if (refundResult.status === 'ESCALATED') {
      return {
        reply: `Refunds above ₹5,000 require human approval. I have created an escalation for order ${orderResult.orderId} (₹${requestedAmount}) so a support specialist can review it.`,
        actions,
      };
    }

    return {
      reply: `Your refund of ₹${requestedAmount} for order ${orderResult.orderId} has been approved and processed under our 14-day return policy (Ref: ${refundResult.paymentRef}).`,
      actions,
    };
  }

  // 5. Order inquiry without refund
  if (orderId) {
    const orderResult = await agentTools.get_order_details(ctx, { orderId });
    if ('error' in orderResult) {
      actions.push({ type: 'get_order_details', summary: String(orderResult.message) });
      return {
        reply: `I could not find order ${orderId} under your account. Please verify your order ID.`,
        actions,
      };
    }
    actions.push({
      type: 'get_order_details',
      summary: `Checked ${orderResult.orderId} (${orderResult.status})`,
    });
    const deliveredText = orderResult.deliveryDate
      ? `delivered on ${new Date(orderResult.deliveryDate).toLocaleDateString('en-IN')}`
      : 'not yet delivered';
    return {
      reply: `Order ${orderResult.orderId} is currently ${orderResult.status} (${deliveredText}), total ₹${orderResult.totalAmount}. ${orderResult.eligible ? 'It is eligible for return within the 14-day window.' : orderResult.eligibilityReasons[0] ?? ''}`,
      actions,
    };
  }

  // 6. General policy question
  if (/\b(policy|window|days|eligible|eligibility)\b/i.test(lower)) {
    const policy = await agentTools.search_return_policy(ctx, {
      category: 'RETURN_REFUND',
      query: message,
    });
    actions.push({
      type: 'search_return_policy',
      summary: `Retrieved ${policy.chunks.length} policy chunks`,
    });
    const snippet = policy.chunks[0]?.text ?? 'Returns are accepted within 14 days of delivery.';
    return {
      reply: `Here is our policy summary: ${snippet.slice(0, 260)}`,
      actions,
    };
  }

  // 7. Fallback helpful greeting
  return {
    reply:
      'Hello! I can help check order status, explain our 14-day return policy, process eligible refunds, or escalate to a human specialist. Please share your order ID to get started.',
    actions,
  };
}

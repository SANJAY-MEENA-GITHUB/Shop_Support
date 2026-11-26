import { GoogleGenAI, Content, Part } from '@google/genai';
import { Priority, Role, SenderType, TicketCategory, TicketStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { businessRule, notFound } from '../lib/errors';
import { isStaff } from '../middleware/auth';
import { createEscalation } from '../services/escalation.service';
import { SYSTEM_PROMPT } from './systemPrompt';
import { AgentActionLog, AgentToolContext, executeAgentTool, toolDeclarations } from './tools';
import { runMockAgent } from './mockAgent';

export function getAiMode(): 'gemini' | 'mock' {
  return env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0 ? 'gemini' : 'mock';
}

function inferCategory(message: string): TicketCategory {
  const lower = message.toLowerCase();
  if (/\b(refund|return|damaged|broken)\b/.test(lower)) return TicketCategory.RETURN_REFUND;
  if (/\b(payment|charge|card|upi|billing)\b/.test(lower)) return TicketCategory.PAYMENT;
  if (/\b(order|delivery|ship|track)\b/.test(lower)) return TicketCategory.ORDER_ISSUE;
  if (/\b(product|spec|size|warranty)\b/.test(lower)) return TicketCategory.PRODUCT_QUESTION;
  return TicketCategory.OTHER;
}

async function runGeminiAgent(params: {
  message: string;
  history: Array<{ senderType: SenderType; content: string }>;
  linkedOrderDisplayId?: string | null;
  ctx: AgentToolContext;
}): Promise<{ reply: string; actions: AgentActionLog[] }> {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const actions: AgentActionLog[] = [];
  const systemInstruction = params.linkedOrderDisplayId
    ? `${SYSTEM_PROMPT}\nContext: This ticket is linked to order ${params.linkedOrderDisplayId}.`
    : SYSTEM_PROMPT;

  const contents: Content[] = params.history
    .filter((m) => m.senderType !== SenderType.SYSTEM)
    .map((m) => ({
      role: m.senderType === SenderType.CUSTOMER ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

  contents.push({
    role: 'user',
    parts: [{ text: params.message }],
  });

  for (let round = 0; round < 3; round++) {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 1024,
        tools: [{ functionDeclarations: toolDeclarations }],
        abortSignal: AbortSignal.timeout(20_000),
      },
    });

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      const text = response.text?.trim();
      if (text) {
        return { reply: text, actions };
      }
      break;
    }

    const modelParts: Part[] = response.candidates?.[0]?.content?.parts ?? [];
    if (modelParts.length > 0) {
      contents.push({ role: 'model', parts: modelParts });
    }

    const responseParts: Part[] = [];
    for (const call of functionCalls) {
      const toolName = call.name ?? '';
      const toolArgs = (call.args ?? {}) as Record<string, unknown>;
      const result = await executeAgentTool(toolName, toolArgs, params.ctx);
      actions.push({
        type: toolName,
        summary:
          typeof result.message === 'string'
            ? result.message
            : `Executed ${toolName}`,
      });
      responseParts.push({
        functionResponse: {
          name: toolName,
          response: result,
        },
      });
    }

    contents.push({ role: 'user', parts: responseParts });
  }

  // Force a final text reply after max tool rounds
  const finalResponse = await ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents,
    config: {
      systemInstruction,
      temperature: 0.2,
      maxOutputTokens: 1024,
      abortSignal: AbortSignal.timeout(20_000),
    },
  });

  return {
    reply:
      finalResponse.text?.trim() ||
      'I have reviewed your request. Please let me know if you need anything else or would like to speak with a specialist.',
    actions,
  };
}

export async function handleChat(input: {
  userId: string;
  role: Role;
  ticketId?: string;
  message: string;
}): Promise<{ reply: string; ticketId: string; actions: AgentActionLog[] }> {
  const trimmedMessage = input.message.trim();
  let ticket;
  let orderedHistory: Array<{ senderType: SenderType; content: string }> = [];

  if (input.ticketId) {
    ticket = await prisma.ticket.findUnique({
      where: { id: input.ticketId },
      include: { order: { select: { displayId: true } } },
    });
    if (!ticket || (!isStaff(input.role) && ticket.customerId !== input.userId)) {
      throw notFound('Ticket not found');
    }
    if (
      !isStaff(input.role) &&
      (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED)
    ) {
      throw businessRule(
        'Cannot reply to a resolved or closed ticket. Please open a new ticket.'
      );
    }

    const history = await prisma.message.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { senderType: true, content: true },
    });
    orderedHistory = history.reverse();

    await prisma.message.create({
      data: {
        ticketId: ticket.id,
        senderId: input.userId,
        senderType: SenderType.CUSTOMER,
        content: trimmedMessage,
      },
    });
  } else {
    const rawSubject = trimmedMessage.slice(0, 60);
    const subject = rawSubject.length >= 5 ? rawSubject : `Support chat: ${rawSubject}`;
    const description =
      trimmedMessage.length >= 20
        ? trimmedMessage
        : `${trimmedMessage} (created via support chat)`;

    ticket = await prisma.ticket.create({
      data: {
        customerId: input.userId,
        category: inferCategory(trimmedMessage),
        subject,
        description,
        status: TicketStatus.OPEN,
        priority: Priority.MEDIUM,
        messages: {
          create: {
            senderId: input.userId,
            senderType: SenderType.CUSTOMER,
            content: trimmedMessage,
          },
        },
      },
      include: { order: { select: { displayId: true } } },
    });
  }

  const ctx: AgentToolContext = {
    userId: input.userId,
    role: input.role,
    ticketId: ticket.id,
  };

  let result: { reply: string; actions: AgentActionLog[] };
  const mode = getAiMode();

  if (mode === 'gemini') {
    try {
      result = await runGeminiAgent({
        message: trimmedMessage,
        history: orderedHistory,
        linkedOrderDisplayId: ticket.order?.displayId ?? null,
        ctx,
      });
    } catch (err) {
      logger.error({ err, ticketId: ticket.id, userId: input.userId }, 'Gemini agent error');
      if (ticket.status !== TicketStatus.CLOSED) {
        await createEscalation({
          ticketId: ticket.id,
          summary: 'AI agent encountered an upstream error; escalated for human review.',
          priority: Priority.HIGH,
          actorId: input.userId,
          actorRole: input.role,
        });
      }
      result = {
        reply:
          "I'm having trouble processing that automatically right now. I have escalated your ticket so a human support specialist will review it shortly.",
        actions: [{ type: 'escalate_to_human', summary: 'Auto-escalated due to AI error' }],
      };
    }
  } else {
    result = await runMockAgent({
      message: trimmedMessage,
      historyContents: orderedHistory
        .filter((m) => m.senderType === SenderType.CUSTOMER)
        .map((m) => m.content),
      linkedOrderDisplayId: ticket.order?.displayId ?? null,
      ctx,
    });
  }

  // Persist AI reply
  await prisma.message.create({
    data: {
      ticketId: ticket.id,
      senderType: SenderType.AI,
      content: result.reply,
    },
  });

  return {
    reply: result.reply,
    ticketId: ticket.id,
    actions: result.actions,
  };
}

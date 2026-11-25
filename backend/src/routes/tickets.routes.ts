import { Router, Request, Response, NextFunction } from 'express';
import { Priority, Role, TicketCategory, TicketStatus } from '@prisma/client';
import { z } from 'zod';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationQuerySchema } from '../utils/pagination';
import {
  addInternalNote,
  addTicketMessage,
  createTicket,
  getTicketDetail,
  listInternalNotes,
  listTicketMessages,
  listTickets,
  updateTicketStatus,
} from '../services/ticket.service';
import { createEscalation } from '../services/escalation.service';

const router = Router();

const createTicketSchema = z.object({
  category: z.nativeEnum(TicketCategory),
  subject: z.string().trim().min(5, 'Subject must be 5–120 characters').max(120),
  description: z.string().trim().min(20, 'Description must be 20–2000 characters').max(2000),
  orderId: z.string().trim().min(1).optional(),
});

const listTicketsQuery = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assigneeId: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest', 'priority']).default('newest'),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

const messageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(2000),
});

const escalateSchema = z.object({
  summary: z.string().trim().min(5, 'Summary must be at least 5 characters').max(500),
  priority: z.nativeEnum(Priority).default(Priority.HIGH),
});

router.use(auth);

router.post(
  '/',
  validate({ body: createTicketSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await createTicket({
        customerId: req.user!.id,
        ...req.body,
      });
      res.status(201).json(ticket);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  validate({ query: listTicketsQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof listTicketsQuery>;
      const result = await listTickets(req.user!.id, req.user!.role, q);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = await getTicketDetail(req.params.id, req.user!.id, req.user!.role);
    res.status(200).json(ticket);
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/status',
  requireRole(Role.SUPPORT, Role.ADMIN),
  validate({ body: updateStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await updateTicketStatus(req.params.id, req.user!.id, req.body);
      res.status(200).json(ticket);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/messages',
  validate({ body: messageSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const msg = await addTicketMessage(
        req.params.id,
        req.user!.id,
        req.user!.role,
        req.body.content
      );
      res.status(201).json(msg);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/messages',
  validate({ query: paginationQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof paginationQuerySchema>;
      const result = await listTicketMessages(
        req.params.id,
        req.user!.id,
        req.user!.role,
        q.page,
        q.limit
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/notes',
  requireRole(Role.SUPPORT, Role.ADMIN),
  validate({ body: messageSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await addInternalNote(req.params.id, req.user!.id, req.body.content);
      res.status(201).json(note);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/notes',
  requireRole(Role.SUPPORT, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notes = await listInternalNotes(req.params.id);
      res.status(200).json(notes);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/escalate',
  validate({ body: escalateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const escalation = await createEscalation({
        ticketId: req.params.id,
        summary: req.body.summary,
        priority: req.body.priority,
        actorId: req.user!.id,
        actorRole: req.user!.role,
      });
      res.status(201).json(escalation);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

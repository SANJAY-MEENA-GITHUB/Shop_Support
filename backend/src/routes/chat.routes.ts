import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationQuerySchema } from '../utils/pagination';
import { handleChat } from '../ai/agent';
import { listTicketMessages } from '../services/ticket.service';

const router = Router();

const chatSchema = z.object({
  ticketId: z.string().uuid().optional(),
  message: z.string().trim().min(1, 'Message cannot be empty').max(2000),
});

router.use(auth);

router.post(
  '/',
  validate({ body: chatSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await handleChat({
        userId: req.user!.id,
        role: req.user!.role,
        ticketId: req.body.ticketId,
        message: req.body.message,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/history/:ticketId',
  validate({ query: paginationQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof paginationQuerySchema>;
      const result = await listTicketMessages(
        req.params.ticketId,
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

export default router;

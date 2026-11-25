import { Router, Request, Response, NextFunction } from 'express';
import { EscalationDecision, Priority, Role } from '@prisma/client';
import { z } from 'zod';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationQuerySchema } from '../utils/pagination';
import {
  decideEscalation,
  getEscalationById,
  listEscalations,
} from '../services/escalation.service';

const router = Router();

const listEscalationsQuery = paginationQuerySchema.extend({
  decision: z.nativeEnum(EscalationDecision).optional(),
  priority: z.nativeEnum(Priority).optional(),
});

const decideSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'NEEDS_INFO']),
  internalNote: z.string().trim().max(1000).optional(),
  assignedToId: z.string().uuid().optional(),
});

router.use(auth, requireRole(Role.SUPPORT, Role.ADMIN));

router.get(
  '/',
  validate({ query: listEscalationsQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof listEscalationsQuery>;
      const result = await listEscalations(q);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const esc = await getEscalationById(req.params.id);
    res.status(200).json(esc);
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/decision',
  validate({ body: decideSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await decideEscalation(req.params.id, req.user!.id, req.body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { RefundStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationQuerySchema } from '../utils/pagination';
import {
  getRefundById,
  listRefunds,
  requestRefund,
  reviewRefund,
} from '../services/refund.service';

const router = Router();

const createRefundSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
  amount: z.coerce
    .number()
    .positive('Amount must be greater than 0')
    .max(10_000_000, 'Amount too large')
    .refine((n) => Math.round(n * 100) === n * 100, 'Amount may have at most 2 decimal places'),
  reason: z.string().trim().min(10, 'Reason must be 10–500 characters').max(500),
  idempotencyKey: z.string().uuid('idempotencyKey must be a valid UUID'),
  ticketId: z.string().uuid().optional(),
});

const listRefundsQuery = paginationQuerySchema.extend({
  status: z.nativeEnum(RefundStatus).optional(),
  orderSearch: z.string().trim().max(100).optional(),
});

const reviewRefundSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'NEEDS_INFO']),
  note: z.string().trim().max(1000).optional(),
});

router.use(auth);

router.post(
  '/',
  validate({ body: createRefundSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await requestRefund({
        ...req.body,
        requestedBy: req.user!.id,
        requesterRole: req.user!.role,
      });
      res.status(result.isReplay ? 200 : 201).json({
        ...result.refund,
        ...(result.escalation ? { escalation: result.escalation } : {}),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  validate({ query: listRefundsQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof listRefundsQuery>;
      const result = await listRefunds(req.user!.id, req.user!.role, q);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refund = await getRefundById(req.params.id, req.user!.id, req.user!.role);
    res.status(200).json(refund);
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/review',
  requireRole(Role.SUPPORT, Role.ADMIN),
  validate({ body: reviewRefundSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await reviewRefund(req.params.id, req.user!.id, req.body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

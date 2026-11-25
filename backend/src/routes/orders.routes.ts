import { Router, Request, Response, NextFunction } from 'express';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationQuerySchema } from '../utils/pagination';
import { getOrderDetail, getOrderEligibility, listOrders } from '../services/order.service';

const router = Router();

const listOrdersQuery = paginationQuerySchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  customerSearch: z.string().trim().max(100).optional(),
});

router.use(auth);

router.get(
  '/',
  validate({ query: listOrdersQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof listOrdersQuery>;
      const result = await listOrders(req.user!.id, req.user!.role, q);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await getOrderDetail(req.params.id, req.user!.id, req.user!.role);
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/eligibility', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getOrderEligibility(req.params.id, req.user!.id, req.user!.role);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

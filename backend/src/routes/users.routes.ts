import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationQuerySchema } from '../utils/pagination';
import { getCurrentUser } from '../services/auth.service';
import { listUsers, updateUserRole } from '../services/user.service';

const router = Router();

const roleSchema = z.object({
  role: z.nativeEnum(Role),
});

router.use(auth);

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/',
  requireRole(Role.ADMIN),
  validate({ query: paginationQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof paginationQuerySchema>;
      const result = await listUsers(q.page, q.limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/role',
  requireRole(Role.ADMIN),
  validate({ body: roleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await updateUserRole(req.params.id, req.body.role, req.user!.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerUser, loginUser, getCurrentUser } from '../services/auth.service';
import { logAudit } from '../services/audit.service';

const router = Router();

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().email('Invalid email address').max(254),
    password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').max(254),
    password: z.string().min(1, 'Password is required').max(72),
  })
  .strict();

router.post(
  '/register',
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await registerUser(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await loginUser(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/logout', auth, (req: Request, res: Response) => {
  void logAudit(req.user!.id, 'LOGOUT', 'User', req.user!.id);
  res.status(200).json({ message: 'Logged out successfully' });
});

router.get('/me', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;

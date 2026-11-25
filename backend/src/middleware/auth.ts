import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { unauthorized, forbidden } from '../lib/errors';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload {
  sub: string;
  role: Role;
}

export function auth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(unauthorized('Missing or invalid authorization header'));
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    next(unauthorized('Missing bearer token'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;

    if (!decoded.sub || !decoded.role) {
      next(unauthorized('Invalid token payload'));
      return;
    }

    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized('Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden('Insufficient permissions'));
      return;
    }
    next();
  };
}

export function isStaff(role: Role): boolean {
  return role === Role.SUPPORT || role === Role.ADMIN;
}

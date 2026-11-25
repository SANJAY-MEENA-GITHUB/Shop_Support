import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/errors';
import { logger } from '../lib/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as unknown as { id?: string }).id;

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'A record with this unique value already exists',
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Requested record was not found',
        },
      });
      return;
    }
  }

  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON request body',
      },
    });
    return;
  }

  logger.error(
    {
      err,
      requestId,
      route: req.originalUrl,
      userId: req.user?.id,
    },
    'Unhandled error'
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'An unexpected error occurred',
    },
  });
}

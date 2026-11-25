import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { badRequest } from '../lib/errors';

interface ValidateSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

function formatZodError(err: ZodError) {
  return err.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));
}

export function validate(schemas: ValidateSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(badRequest('Validation failed', formatZodError(err)));
        return;
      }
      next(err);
    }
  };
}

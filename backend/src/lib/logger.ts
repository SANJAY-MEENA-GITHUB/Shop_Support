import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'authorization',
      'GEMINI_API_KEY',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.authorization',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

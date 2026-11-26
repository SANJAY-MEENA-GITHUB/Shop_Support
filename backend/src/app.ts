import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import { getAiMode } from './ai/agent';
import authRoutes from './routes/auth.routes';
import ordersRoutes from './routes/orders.routes';
import ticketsRoutes from './routes/tickets.routes';
import refundsRoutes from './routes/refunds.routes';
import escalationsRoutes from './routes/escalations.routes';
import chatRoutes from './routes/chat.routes';
import usersRoutes from './routes/users.routes';

function loadOpenApiSpec(): Record<string, unknown> {
  const candidates = [
    path.resolve(process.cwd(), 'openapi/openapi.yaml'),
    path.resolve(__dirname, '../openapi/openapi.yaml'),
    path.resolve(__dirname, '../../openapi/openapi.yaml'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return yaml.load(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    }
  }
  return {
    openapi: '3.0.3',
    info: { title: 'E-Commerce Support Platform API', version: '1.0.0' },
    paths: {},
  };
}

export function createApp() {
  const app = express();

  const allowedOrigins = new Set(
    [
      env.FRONTEND_URL,
      ...(env.NODE_ENV !== 'production'
        ? ['http://localhost:5173', 'http://127.0.0.1:5173']
        : []),
    ].filter(Boolean)
  );

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) =>
        (req.headers['x-request-id'] as string) || crypto.randomUUID(),
      customProps: (req) => ({
        userId: (req as express.Request).user?.id,
      }),
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    })
  );

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts.' },
    },
  });

  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => (req as express.Request).user?.id || req.ip || 'anonymous',
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many chat requests. Please slow down.' },
    },
  });

  app.use('/api', globalLimiter);

  const openApiSpec = loadOpenApiSpec();
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.get('/api/health', async (_req, res) => {
    let db: 'connected' | 'error' = 'connected';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    res.status(db === 'connected' ? 200 : 503).json({
      status: db === 'connected' ? 'ok' : 'degraded',
      db,
      aiMode: getAiMode(),
    });
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/tickets', ticketsRoutes);
  app.use('/api/refunds', refundsRoutes);
  app.use('/api/escalations', escalationsRoutes);
  app.use('/api/chat', chatLimiter, chatRoutes);
  app.use('/api/users', usersRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'API route not found' },
    });
  });

  app.use(errorHandler);

  return app;
}

import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { createApp } from './app';
import { getAiMode } from './ai/agent';
import { policyStore } from './ai/policy';

async function bootstrap() {
  await prisma.$connect();
  policyStore.load();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, aiMode: getAiMode() },
      'Backend server listening'
    );
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        { port: env.PORT, err },
        `Port ${env.PORT} is already in use. Stop the existing process or set a different PORT.`
      );
    } else {
      logger.error({ err }, 'HTTP server error');
    }
    void prisma.$disconnect().finally(() => process.exit(1));
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start backend server');
  process.exit(1);
});

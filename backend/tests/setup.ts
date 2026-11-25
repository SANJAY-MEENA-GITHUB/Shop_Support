import { beforeAll, afterAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.GEMINI_API_KEY = '';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  process.env.DATABASE_URL ||
  'postgresql://support:support@localhost:5432/supportdb';

import { prisma } from '../src/lib/prisma';

export async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.internalNote.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

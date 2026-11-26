import './initEnv';
import { beforeAll, afterAll } from 'vitest';
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

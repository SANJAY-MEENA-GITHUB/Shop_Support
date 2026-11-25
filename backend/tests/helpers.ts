import bcrypt from 'bcryptjs';
import request from 'supertest';
import { OrderStatus, Role } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { createApp } from '../src/app';

export const app = createApp();

export async function createUser(
  role: Role = Role.CUSTOMER,
  overrides: { name?: string; email?: string; password?: string } = {}
) {
  const password = overrides.password ?? 'Password@123';
  const passwordHash = await bcrypt.hash(password, 10);
  const email =
    overrides.email ??
    `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `${role} User`,
      email,
      passwordHash,
      role,
    },
  });

  return { user, password };
}

export async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

export async function seedOrder(
  customerId: string,
  overrides: {
    displayId?: string;
    status?: OrderStatus;
    deliveryDaysAgo?: number | null;
    totalAmount?: number;
    category?: string;
    itemName?: string;
  } = {}
) {
  const days = overrides.deliveryDaysAgo;
  const deliveryDate =
    days === null
      ? null
      : new Date(Date.now() - (days ?? 2) * 24 * 60 * 60 * 1000);

  const total = overrides.totalAmount ?? 2499;
  const displayId =
    overrides.displayId ?? `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  return prisma.order.create({
    data: {
      displayId,
      customerId,
      status: overrides.status ?? OrderStatus.DELIVERED,
      deliveryDate,
      totalAmount: total,
      items: [
        {
          name: overrides.itemName ?? 'Test Electronics Item',
          category: overrides.category ?? 'Electronics',
          qty: 1,
          unitPrice: total,
        },
      ],
    },
  });
}

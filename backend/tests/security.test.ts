import crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { OrderStatus, Role } from '@prisma/client';
import { resetDatabase } from './setup';
import { app, createUser, loginAs, seedOrder } from './helpers';

describe('Security & Authorization Hardening (T8+)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('enforces server-side amount cap against order total even if client tampers', async () => {
    const { user: cust, password } = await createUser(Role.CUSTOMER);
    const token = await loginAs(cust.email, password);
    const order = await seedOrder(cust.id, {
      displayId: 'ORD-9001',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 2,
      totalAmount: 2499,
    });

    const res = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        amount: 50000,
        reason: 'Trying to tamper refund amount beyond order total',
        idempotencyKey: crypto.randomUUID(),
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
  });

  it('hides cross-customer orders with 404 and blocks staff routes with 403', async () => {
    const { user: custA, password: passA } = await createUser(Role.CUSTOMER);
    const { user: custB } = await createUser(Role.CUSTOMER);
    const tokenA = await loginAs(custA.email, passA);

    const orderB = await seedOrder(custB.id, { displayId: 'ORD-9002' });

    const crossOrder = await request(app)
      .get(`/api/orders/${orderB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(crossOrder.status).toBe(404);

    const escalationsRoute = await request(app)
      .get('/api/escalations')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(escalationsRoute.status).toBe(403);

    const usersRoute = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(usersRoute.status).toBe(403);
  });

  it('reports database and mock AI mode on /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      db: 'connected',
      aiMode: 'mock',
    });
  });
});

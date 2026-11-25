import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Role, TicketCategory } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { resetDatabase } from './setup';
import { app, createUser, loginAs } from './helpers';

describe('Authentication & Access Control (T1)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('blocks unauthenticated requests to protected endpoints', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('registers, logs in, and returns current user without passwordHash', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Alice Customer',
      email: 'alice@example.com',
      password: 'Password@123',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();
    expect(reg.body.user.email).toBe('alice@example.com');
    expect(reg.body.user.passwordHash).toBeUndefined();

    const badLogin = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'WrongPassword',
    });
    expect(badLogin.status).toBe(401);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('alice@example.com');
  });

  it('blocks cross-customer ticket access with 404 and staff route with 403', async () => {
    const { user: custA, password: passA } = await createUser(Role.CUSTOMER);
    const { user: custB, password: passB } = await createUser(Role.CUSTOMER);
    const tokenA = await loginAs(custA.email, passA);
    const tokenB = await loginAs(custB.email, passB);

    const ticketB = await prisma.ticket.create({
      data: {
        customerId: custB.id,
        category: TicketCategory.ORDER_ISSUE,
        subject: 'Customer B private ticket',
        description: 'This belongs strictly to customer B.',
      },
    });

    const crossRead = await request(app)
      .get(`/api/tickets/${ticketB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(crossRead.status).toBe(404);

    const staffActionAsCust = await request(app)
      .patch(`/api/tickets/${ticketB.id}/status`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'IN_PROGRESS' });
    expect(staffActionAsCust.status).toBe(403);
  });
});

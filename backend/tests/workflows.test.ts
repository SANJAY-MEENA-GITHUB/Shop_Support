import crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { OrderStatus, Role } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { resetDatabase } from './setup';
import { app, createUser, loginAs, seedOrder } from './helpers';

describe('Full Workflows, Staff Operations & Coverage', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('covers orders list, detail, eligibility, and staff customerSearch', async () => {
    const { user: cust, password: custPass } = await createUser(Role.CUSTOMER, {
      name: 'Priya Test',
      email: 'priya-t@example.com',
    });
    const { user: staff, password: staffPass } = await createUser(Role.SUPPORT);
    const custToken = await loginAs(cust.email, custPass);
    const staffToken = await loginAs(staff.email, staffPass);

    const ord1 = await seedOrder(cust.id, {
      displayId: 'ORD-3001',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 2,
      totalAmount: 2499,
    });
    const ord2 = await seedOrder(cust.id, {
      displayId: 'ORD-3002',
      status: OrderStatus.SHIPPED,
      deliveryDaysAgo: null,
      totalAmount: 999,
    });

    const listCust = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${custToken}`);
    expect(listCust.status).toBe(200);
    expect(listCust.body.total).toBe(2);

    const detail = await request(app)
      .get(`/api/orders/${ord1.id}`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.displayId).toBe('ORD-3001');

    const elig1 = await request(app)
      .get(`/api/orders/${ord1.id}/eligibility`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(elig1.status).toBe(200);
    expect(elig1.body.eligible).toBe(true);

    const elig2 = await request(app)
      .get(`/api/orders/${ord2.id}/eligibility`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(elig2.status).toBe(200);
    expect(elig2.body.eligible).toBe(false);

    const staffSearch = await request(app)
      .get('/api/orders?customerSearch=Priya&status=DELIVERED')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffSearch.status).toBe(200);
    expect(staffSearch.body.total).toBe(1);
  });

  it('covers refund listing, review (NEEDS_INFO & REJECTED), and deterministic payment failure', async () => {
    const { user: cust, password: custPass } = await createUser(Role.CUSTOMER);
    const { user: staff, password: staffPass } = await createUser(Role.SUPPORT);
    const custToken = await loginAs(cust.email, custPass);
    const staffToken = await loginAs(staff.email, staffPass);

    const orderHigh = await seedOrder(cust.id, {
      displayId: 'ORD-4001',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 2,
      totalAmount: 7500,
    });

    const escRefund = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        orderId: orderHigh.id,
        amount: 7500,
        reason: 'Smart watch screen defect',
        idempotencyKey: crypto.randomUUID(),
      });
    expect(escRefund.status).toBe(201);
    const refundId = escRefund.body.id as string;

    const listCust = await request(app)
      .get('/api/refunds')
      .set('Authorization', `Bearer ${custToken}`);
    expect(listCust.status).toBe(200);
    expect(listCust.body.total).toBe(1);

    const getOne = await request(app)
      .get(`/api/refunds/${refundId}`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(getOne.status).toBe(200);

    const needsInfo = await request(app)
      .patch(`/api/refunds/${refundId}/review`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ decision: 'NEEDS_INFO', note: 'Please share serial number' });
    expect(needsInfo.status).toBe(200);

    const rejected = await request(app)
      .patch(`/api/refunds/${refundId}/review`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ decision: 'REJECTED', note: 'Physical damage excluded' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('REJECTED');

    // Deterministic .99 + FAIL hook
    const orderFail = await seedOrder(cust.id, {
      displayId: 'ORD-4002',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 1,
      totalAmount: 199.99,
    });
    const failRes = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        orderId: orderFail.id,
        amount: 199.99,
        reason: 'Trigger FAIL simulation path',
        idempotencyKey: crypto.randomUUID(),
      });
    expect(failRes.status).toBe(502);
  });

  it('covers escalation queue, NEEDS_INFO/REJECTED decisions, ticket filters, and admin user roles', async () => {
    const { user: admin, password: adminPass } = await createUser(Role.ADMIN);
    const { user: staff, password: staffPass } = await createUser(Role.SUPPORT);
    const { user: cust, password: custPass } = await createUser(Role.CUSTOMER);
    const adminToken = await loginAs(admin.email, adminPass);
    const staffToken = await loginAs(staff.email, staffPass);
    const custToken = await loginAs(cust.email, custPass);

    const t = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        category: 'PAYMENT',
        subject: 'Double charge inquiry',
        description: 'My card appears to have two pending authorizations for one order.',
      });
    expect(t.status).toBe(201);
    const ticketId = t.body.id as string;

    const escRes = await request(app)
      .post(`/api/tickets/${ticketId}/escalate`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ summary: 'Need billing specialist review', priority: 'HIGH' });
    expect(escRes.status).toBe(201);
    const escId = escRes.body.id as string;

    const escList = await request(app)
      .get('/api/escalations?decision=PENDING')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(escList.status).toBe(200);
    expect(escList.body.total).toBe(1);

    const needsInfo = await request(app)
      .patch(`/api/escalations/${escId}/decision`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ decision: 'NEEDS_INFO', internalNote: 'Provide bank ref' });
    expect(needsInfo.status).toBe(200);
    expect(needsInfo.body.decision).toBe('NEEDS_INFO');

    // Customer reply reopens NEEDS_INFO escalation back to PENDING
    const custReply = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ content: 'Here is my bank reference number 12345' });
    expect(custReply.status).toBe(201);

    const escReject = await request(app)
      .patch(`/api/escalations/${escId}/decision`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ decision: 'REJECTED', internalNote: 'Duplicate auth already reversed' });
    expect(escReject.status).toBe(200);
    expect(escReject.body.decision).toBe('REJECTED');

    const staffTickets = await request(app)
      .get('/api/tickets?search=Double&sort=priority')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffTickets.status).toBe(200);
    expect(staffTickets.body.total).toBe(1);

    const notesList = await request(app)
      .get(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(notesList.status).toBe(200);

    // Admin user listing & role change + logout + /users/me
    const usersList = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(usersList.status).toBe(200);
    expect(usersList.body.total).toBe(3);

    const roleUpdate = await request(app)
      .patch(`/api/users/${cust.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SUPPORT' });
    expect(roleUpdate.status).toBe(200);
    expect(roleUpdate.body.user.role).toBe('SUPPORT');

    const meAlias = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(meAlias.status).toBe(200);

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logoutRes.status).toBe(200);
  });

  it('covers AI mock chat paths: expired order, >₹5000 escalation, human handoff, order inquiry, policy', async () => {
    const { user: cust, password } = await createUser(Role.CUSTOMER);
    const token = await loginAs(cust.email, password);

    await seedOrder(cust.id, {
      displayId: 'ORD-5001',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 30,
      totalAmount: 1899,
      category: 'Clothing',
    });
    await seedOrder(cust.id, {
      displayId: 'ORD-5002',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 3,
      totalAmount: 8500,
    });

    // Expired order via chat -> REJECTED refund recorded
    const expiredChat = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Please refund ORD-5001' });
    expect(expiredChat.status).toBe(200);
    expect(expiredChat.body.reply.toLowerCase()).toContain('14-day');

    // >₹5000 via chat -> ESCALATED
    const highChat = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Refund ORD-5002 please' });
    expect(highChat.status).toBe(200);
    expect(highChat.body.reply.toLowerCase()).toContain('escalat');

    // Order status check without refund
    const statusChat = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Where is my order ORD-5002?' });
    expect(statusChat.status).toBe(200);
    expect(statusChat.body.reply).toContain('ORD-5002');

    // Policy query
    const policyChat = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What is your return policy window?' });
    expect(policyChat.status).toBe(200);
    expect(policyChat.body.reply.toLowerCase()).toContain('14 days');

    // Human handoff
    const humanChat = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Let me talk to a human agent' });
    expect(humanChat.status).toBe(200);
    expect(humanChat.body.reply.toLowerCase()).toContain('human');

    // History endpoint alias
    const hist = await request(app)
      .get(`/api/chat/history/${humanChat.body.ticketId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(hist.status).toBe(200);
    expect(hist.body.data.length).toBeGreaterThanOrEqual(2);

    const escCount = await prisma.escalation.count();
    expect(escCount).toBeGreaterThanOrEqual(2);
  });
});

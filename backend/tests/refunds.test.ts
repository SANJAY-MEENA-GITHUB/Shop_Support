import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { OrderStatus, Role } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { RETURN_WINDOW_DAYS } from '../src/services/refund.service';
import { SimulatedPaymentService } from '../src/services/payment.simulated';
import { resetDatabase } from './setup';
import { app, createUser, loginAs, seedOrder } from './helpers';

describe('Refund Business Rules & Execution (T4, T5, T6, T7, T9, T10)', () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.restoreAllMocks();
  });

  it('T4: processes an eligible refund ≤ ₹5,000 via simulated payment', async () => {
    const { user: cust, password } = await createUser(Role.CUSTOMER);
    const token = await loginAs(cust.email, password);
    const order = await seedOrder(cust.id, {
      displayId: 'ORD-1001',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 2,
      totalAmount: 2499,
    });

    const res = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        amount: 2499,
        reason: 'Earbuds stopped charging after one day',
        idempotencyKey: crypto.randomUUID(),
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PROCESSED');
    expect(res.body.paymentRef).toMatch(/^SIM-/);

    const count = await prisma.refund.count({ where: { orderId: order.id } });
    expect(count).toBe(1);
  });

  it('T5: rejects refund when 14-day return window has expired', async () => {
    const { user: cust, password } = await createUser(Role.CUSTOMER);
    const token = await loginAs(cust.email, password);
    const order = await seedOrder(cust.id, {
      displayId: 'ORD-1002',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 30,
      totalAmount: 1899,
      category: 'Clothing',
    });

    const res = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        amount: 1899,
        reason: 'Item does not fit properly anymore',
        idempotencyKey: crypto.randomUUID(),
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
    expect(res.body.error.message.toLowerCase()).toContain('window');

    const processedCount = await prisma.refund.count({
      where: { orderId: order.id, status: 'PROCESSED' },
    });
    expect(processedCount).toBe(0);
  });

  it('T6: escalates refunds > ₹5,000 and processes only after staff approval', async () => {
    const { user: cust, password: custPass } = await createUser(Role.CUSTOMER);
    const { user: staff, password: staffPass } = await createUser(Role.SUPPORT);
    const custToken = await loginAs(cust.email, custPass);
    const staffToken = await loginAs(staff.email, staffPass);

    const order = await seedOrder(cust.id, {
      displayId: 'ORD-1003',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 3,
      totalAmount: 8500,
    });

    const res = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        orderId: order.id,
        amount: 8500,
        reason: 'Smart watch screen flickers continuously',
        idempotencyKey: crypto.randomUUID(),
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ESCALATED');
    expect(res.body.paymentRef).toBeNull();
    expect(res.body.escalation).toBeTruthy();

    const escId = res.body.escalation.id as string;
    const escCount = await prisma.escalation.count({ where: { id: escId } });
    expect(escCount).toBe(1);

    const approveRes = await request(app)
      .patch(`/api/escalations/${escId}/decision`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ decision: 'APPROVED', internalNote: 'Verified high-value defect' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.decision).toBe('APPROVED');
    expect(approveRes.body.ticket.refunds[0].status).toBe('PROCESSED');
    expect(approveRes.body.ticket.refunds[0].paymentRef).toMatch(/^SIM-/);
  });

  it('T7: enforces idempotency on duplicate submission and 409 on payload mismatch', async () => {
    const { user: cust, password } = await createUser(Role.CUSTOMER);
    const token = await loginAs(cust.email, password);
    const order = await seedOrder(cust.id, {
      displayId: 'ORD-1005',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 1,
      totalAmount: 2000,
    });

    const key = crypto.randomUUID();
    const payload = {
      orderId: order.id,
      amount: 2000,
      reason: 'Defective speaker on delivery',
      idempotencyKey: key,
    };

    const first = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(first.status).toBe(201);

    const replay = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(first.body.id);

    const count = await prisma.refund.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);

    const mismatch = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, amount: 1500 });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe('CONFLICT');
  });

  it('T9: marks refund FAILED and returns clear error when payment service fails', async () => {
    const { user: cust, password } = await createUser(Role.CUSTOMER);
    const token = await loginAs(cust.email, password);
    const order = await seedOrder(cust.id, {
      displayId: 'ORD-1006',
      status: OrderStatus.DELIVERED,
      deliveryDaysAgo: 1,
      totalAmount: 1500,
    });

    vi.spyOn(SimulatedPaymentService, 'execute').mockResolvedValueOnce({
      success: false,
      error: 'Simulated gateway timeout',
    });

    const res = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        amount: 1500,
        reason: 'Product damaged during shipping',
        idempotencyKey: crypto.randomUUID(),
      });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PAYMENT_FAILED');

    const dbRefund = await prisma.refund.findFirst({ where: { orderId: order.id } });
    expect(dbRefund?.status).toBe('FAILED');
  });

  it('T10: backend RETURN_WINDOW_DAYS matches policy document', () => {
    const policyPath = path.resolve(process.cwd(), 'policy/return-policy.md');
    const content = fs.readFileSync(policyPath, 'utf-8');
    expect(content).toContain(`${RETURN_WINDOW_DAYS} days`);
  });
});

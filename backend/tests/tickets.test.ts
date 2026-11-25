import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { resetDatabase } from './setup';
import { app, createUser, loginAs, seedOrder } from './helpers';

describe('Tickets & Conversations (T2)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates a ticket, posts messages, and enforces staff notes & transitions', async () => {
    const { user: cust, password: custPass } = await createUser(Role.CUSTOMER);
    const { user: staff, password: staffPass } = await createUser(Role.SUPPORT);
    const custToken = await loginAs(cust.email, custPass);
    const staffToken = await loginAs(staff.email, staffPass);

    const order = await seedOrder(cust.id, { displayId: 'ORD-2001' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        category: 'RETURN_REFUND',
        subject: 'Item arrived with minor scratch',
        description: 'The outer casing has a visible scratch upon opening the package.',
        orderId: order.id,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();
    expect(createRes.body.status).toBe('OPEN');
    const ticketId = createRes.body.id as string;

    const msgRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ content: 'Can I exchange or return this item?' });
    expect(msgRes.status).toBe(201);

    const listMsgs = await request(app)
      .get(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(listMsgs.status).toBe(200);
    expect(listMsgs.body.data.length).toBe(2);
    expect(listMsgs.body.data[1].content).toBe('Can I exchange or return this item?');

    // Staff internal note is forbidden to customer
    const noteCreate = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ content: 'Verified customer history; eligible for return.' });
    expect(noteCreate.status).toBe(201);

    const custReadNotes = await request(app)
      .get(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(custReadNotes.status).toBe(403);

    // Invalid status transition OPEN -> CLOSED directly should fail with 422
    const invalidTransition = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'CLOSED' });
    expect(invalidTransition.status).toBe(422);

    // Valid transition OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
    const p1 = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'IN_PROGRESS' });
    expect(p1.status).toBe(200);
  });
});

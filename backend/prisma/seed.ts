import { PrismaClient, Role, OrderStatus, TicketCategory, TicketStatus, Priority, SenderType, EscalationDecision } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function main() {
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const supportPassword = await bcrypt.hash('Support@123', 12);
  const customerPassword = await bcrypt.hash('Customer@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@shop.local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@shop.local',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const support = await prisma.user.upsert({
    where: { email: 'support@shop.local' },
    update: {},
    create: {
      name: 'Support Agent',
      email: 'support@shop.local',
      passwordHash: supportPassword,
      role: Role.SUPPORT,
    },
  });

  const priya = await prisma.user.upsert({
    where: { email: 'priya@example.com' },
    update: {},
    create: {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      passwordHash: customerPassword,
      role: Role.CUSTOMER,
    },
  });

  const rahul = await prisma.user.upsert({
    where: { email: 'rahul@example.com' },
    update: {},
    create: {
      name: 'Rahul Verma',
      email: 'rahul@example.com',
      passwordHash: customerPassword,
      role: Role.CUSTOMER,
    },
  });

  const ord1001 = await prisma.order.upsert({
    where: { displayId: 'ORD-1001' },
    update: {},
    create: {
      displayId: 'ORD-1001',
      customerId: priya.id,
      status: OrderStatus.DELIVERED,
      deliveryDate: daysAgo(2),
      totalAmount: 2499.0,
      items: [{ name: 'Wireless Earbuds', category: 'Electronics', qty: 1, unitPrice: 2499 }],
    },
  });

  await prisma.order.upsert({
    where: { displayId: 'ORD-1002' },
    update: {},
    create: {
      displayId: 'ORD-1002',
      customerId: priya.id,
      status: OrderStatus.DELIVERED,
      deliveryDate: daysAgo(30),
      totalAmount: 1899.0,
      items: [{ name: 'Cotton T-Shirt', category: 'Clothing', qty: 1, unitPrice: 1899 }],
    },
  });

  const ord1003 = await prisma.order.upsert({
    where: { displayId: 'ORD-1003' },
    update: {},
    create: {
      displayId: 'ORD-1003',
      customerId: rahul.id,
      status: OrderStatus.DELIVERED,
      deliveryDate: daysAgo(3),
      totalAmount: 8500.0,
      items: [{ name: 'Smart Watch', category: 'Electronics', qty: 1, unitPrice: 8500 }],
    },
  });

  await prisma.order.upsert({
    where: { displayId: 'ORD-1004' },
    update: {},
    create: {
      displayId: 'ORD-1004',
      customerId: rahul.id,
      status: OrderStatus.SHIPPED,
      deliveryDate: null,
      totalAmount: 999.0,
      items: [{ name: 'Paperback Novel', category: 'Books', qty: 1, unitPrice: 999 }],
    },
  });

  const existingTickets = await prisma.ticket.count();
  if (existingTickets === 0) {
    const t1 = await prisma.ticket.create({
      data: {
        customerId: priya.id,
        orderId: ord1001.id,
        category: TicketCategory.RETURN_REFUND,
        subject: 'Refund for earbuds',
        description: 'Left earbud stops charging intermittently. Requesting return details.',
        status: TicketStatus.OPEN,
        priority: Priority.MEDIUM,
      },
    });

    await prisma.message.create({
      data: {
        ticketId: t1.id,
        senderId: priya.id,
        senderType: SenderType.CUSTOMER,
        content: 'Hi, the left earbud on my Wireless Earbuds (ORD-1001) stopped charging. Can you help?',
      },
    });

    const t2 = await prisma.ticket.create({
      data: {
        customerId: rahul.id,
        orderId: ord1003.id,
        category: TicketCategory.RETURN_REFUND,
        subject: 'Return smart watch',
        description: 'Smart Watch display has flickering issue after 2 days of use.',
        status: TicketStatus.ESCALATED,
        priority: Priority.HIGH,
        assigneeId: support.id,
      },
    });

    await prisma.message.create({
      data: {
        ticketId: t2.id,
        senderId: rahul.id,
        senderType: SenderType.CUSTOMER,
        content: 'My Smart Watch screen flickers. I would like to speak with a specialist about a return.',
      },
    });

    await prisma.escalation.create({
      data: {
        ticketId: t2.id,
        summary: 'High-value Smart Watch (ORD-1003, ₹8,500) hardware defect return inquiry.',
        priority: Priority.HIGH,
        assignedToId: support.id,
        decision: EscalationDecision.PENDING,
        internalNote: 'Awaiting support agent verification before initiating refund.',
      },
    });
  }

  console.log(`Seed complete. Users: ${admin.email}, ${support.email}, ${priya.email}, ${rahul.email}`);
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

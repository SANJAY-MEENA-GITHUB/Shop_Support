import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { conflict, unauthorized } from '../lib/errors';
import { logAudit } from './audit.service';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '24h',
  });
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: SafeUser; token: string }> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    throw conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: Role.CUSTOMER,
    },
    select: userSelect,
  });

  const token = signToken(user.id, user.role);
  void logAudit(user.id, 'REGISTER', 'User', user.id, { role: user.role });

  return { user, token };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ user: SafeUser; token: string }> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const record = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!record) {
    throw unauthorized('Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, record.passwordHash);
  if (!valid) {
    throw unauthorized('Invalid email or password');
  }

  const user: SafeUser = {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
  };

  const token = signToken(user.id, user.role);
  void logAudit(user.id, 'LOGIN', 'User', user.id, { role: user.role });

  return { user, token };
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    throw unauthorized('User account no longer exists');
  }

  return user;
}

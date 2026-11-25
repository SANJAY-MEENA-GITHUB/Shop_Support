import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Load local .env file in non-test environments without overwriting existing env vars
if (process.env.NODE_ENV !== 'test') {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
      break;
    }
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;

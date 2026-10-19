import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  // HS256 needs a key at least as long as its 256-bit output to be safe.
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  // Namespaces the queue's Redis keys, so tests never share a queue with the dev worker.
  QUEUE_PREFIX: z.string().default('bull'),
  // Shared by the API (serves files) and the worker (writes them). Relative to the api/ folder.
  REPORTS_DIR: z.string().default('storage/reports'),
});

export type Env = z.infer<typeof envSchema>;

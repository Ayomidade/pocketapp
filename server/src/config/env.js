require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_BASE_URL: z.string().url().default('http://localhost:4000'),
  MOBILE_DEEP_LINK_SCHEME: z.string().min(1).default('pocketops'),

  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/pocketops_dev'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev_access_secret_replace_in_production_32ch'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev_refresh_secret_replace_in_production_32ch'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CREDENTIALS_ENCRYPTION_KEY: z.string().default('MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='),

  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_OAUTH_CALLBACK_URL: z.string().default('http://localhost:4000/api/v1/auth/github/callback'),
  GITHUB_APP_ID: z.string().default(''),
  GITHUB_APP_SLUG: z.string().default('pocketops-relay'),
  GITHUB_APP_PRIVATE_KEY: z.string().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),

  RENDER_API_BASE_URL: z.string().url().default('https://api.render.com/v1'),
  RENDER_WEBHOOK_SECRET: z.string().default(''),
  EXPO_ACCESS_TOKEN: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = parsed.data;

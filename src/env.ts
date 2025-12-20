import { z } from 'zod/v4'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.url(),
  PORT: z.string().default('3333').transform(Number),
  JWT_SECRET: z.string().min(6, 'JWT_SECRET deve ter no mínimo 06 caracteres'),
  GOOGLE_OAUTH_CLIENT_ID: z.string(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string(),
  GOOGLE_OAUTH_CLIENT_REDIRECT_URI: z.url(),

  CLOUDFARE_ENDPOINT: z.url(),
  CLOUDFARE_PUBLIC_URL: z.url(),
  CLOUDFARE_SECRET_ACCESS_KEY: z.string(),
  CLOUDFARE_ACCESS_KEY_ID: z.string(),
  CLOUDFARE_BUCKET_NAME: z.string(),
  CLOUDFARE_R2_TOKEN: z.string(),

  MAILERSEND_API_KEY: z.string(),
  OWNER_EMAIL: z.email(),

})

export const env = envSchema.parse(process.env)

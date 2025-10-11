import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().email().optional(),
    WEBHOOK_SECRET: z.string().min(1),
    SENTRY_DSN: z.string().url().optional(),
    PROXY_ENABLED: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .default(false),
    PROXY_HOST: z.string().min(1).optional(),
    PROXY_PORT: z.coerce.number().positive().optional(),
    PROXY_USERNAME: z.string().min(1).optional(),
    PROXY_PASSWORD: z.string().min(1).optional(),
    PROXY_PROTOCOL: z.enum(["http", "https", "socks5"]).default("http"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_MAPKIT_TOKEN: z.string().min(1),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    NEXT_PUBLIC_MAPKIT_TOKEN: process.env.NEXT_PUBLIC_MAPKIT_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    PROXY_ENABLED: process.env.PROXY_ENABLED,
    PROXY_HOST: process.env.PROXY_HOST,
    PROXY_PORT: process.env.PROXY_PORT,
    PROXY_USERNAME: process.env.PROXY_USERNAME,
    PROXY_PASSWORD: process.env.PROXY_PASSWORD,
    PROXY_PROTOCOL: process.env.PROXY_PROTOCOL,
  },
});

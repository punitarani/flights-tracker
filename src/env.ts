import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().min(1),

    // Authentication
    SUPABASE_SECRET_KEY: z.string().min(1),

    // Email & Notifications
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().email().optional(),

    // Security
    WEBHOOK_SECRET: z.string().min(1),

    // External APIs
    SEATS_AERO_API_KEY: z.string().min(1),

    // Monitoring
    SENTRY_DSN: z.string().url().optional(),

    // Proxy Configuration
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
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),

    // Maps
    NEXT_PUBLIC_MAPKIT_TOKEN: z.string().min(1),

    // Monitoring
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    // Server - Database
    DATABASE_URL: process.env.DATABASE_URL,

    // Server - Authentication
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,

    // Server - Email & Notifications
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,

    // Server - Security
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,

    // Server - External APIs
    SEATS_AERO_API_KEY: process.env.SEATS_AERO_API_KEY,

    // Server - Monitoring
    SENTRY_DSN: process.env.SENTRY_DSN,

    // Server - Proxy Configuration
    PROXY_ENABLED: process.env.PROXY_ENABLED,
    PROXY_HOST: process.env.PROXY_HOST,
    PROXY_PORT: process.env.PROXY_PORT,
    PROXY_USERNAME: process.env.PROXY_USERNAME,
    PROXY_PASSWORD: process.env.PROXY_PASSWORD,
    PROXY_PROTOCOL: process.env.PROXY_PROTOCOL,

    // Client - Supabase
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,

    // Client - Maps
    NEXT_PUBLIC_MAPKIT_TOKEN: process.env.NEXT_PUBLIC_MAPKIT_TOKEN,

    // Client - Monitoring
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
});

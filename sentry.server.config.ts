import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

const parseSampleRate = (value: string | undefined, fallback: number) => {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.min(Math.max(parsed, 0), 1);
  }

  return fallback;
};

const nodeEnv = process.env.NODE_ENV ?? "development";

const defaultTraceSampleRate = nodeEnv === "production" ? 0.2 : 1;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? nodeEnv,
  tracesSampleRate: parseSampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
    defaultTraceSampleRate,
  ),
  profilesSampleRate: parseSampleRate(
    process.env.SENTRY_PROFILES_SAMPLE_RATE,
    nodeEnv === "production" ? 0 : 1,
  ),
  sendDefaultPii: true,
  debug: nodeEnv === "development",
});

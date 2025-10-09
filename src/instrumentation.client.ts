"use client";

import * as Sentry from "@sentry/nextjs";

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

const environment =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
  process.env.NODE_ENV ??
  "development";

const tracesSampleRate = parseSampleRate(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  environment === "production" ? 0.2 : 1,
);

const replaysSessionSampleRate = parseSampleRate(
  process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  environment === "production" ? 0.05 : 0.1,
);

const replaysOnErrorSampleRate = parseSampleRate(
  process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  1,
);

const integrations = [Sentry.browserTracingIntegration()];

if (replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0) {
  integrations.push(
    Sentry.replayIntegration({
      blockAllMedia: false,
      maskAllText: false,
    }),
  );
}

integrations.push(
  Sentry.feedbackIntegration({
    colorScheme: "system",
  }),
);

const tracePropagationTargets: Array<string | RegExp> = ["localhost", /^\//];

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  tracePropagationTargets.push(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment,
  integrations,
  tracesSampleRate,
  tracePropagationTargets,
  replaysSessionSampleRate,
  replaysOnErrorSampleRate,
});

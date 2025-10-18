// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://360cf3c5b4a5e31c07a8be5a44402b55@o4510157245448192.ingest.us.sentry.io/4510157247348736",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Send user data for better debugging
  sendDefaultPii: true,

  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    // Vercel AI SDK integration for agent monitoring
    Sentry.vercelAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

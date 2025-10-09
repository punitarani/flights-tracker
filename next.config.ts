import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

const sentryWebpackPluginOptions: Parameters<typeof withSentryConfig>[1] = {
  silent: true,
};

if (process.env.SENTRY_ORG) {
  sentryWebpackPluginOptions.org = process.env.SENTRY_ORG;
}

if (process.env.SENTRY_PROJECT) {
  sentryWebpackPluginOptions.project = process.env.SENTRY_PROJECT;
}

const sentryBuildOptions: Parameters<typeof withSentryConfig>[2] = {
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

export default withSentryConfig(
  nextConfig,
  sentryWebpackPluginOptions,
  sentryBuildOptions,
);

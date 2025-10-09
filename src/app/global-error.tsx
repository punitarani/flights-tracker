"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              Something unexpected happened
            </h1>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              An unexpected error occurred while loading the page. Please try
              again or return to the dashboard.
            </p>
            {error.digest ? (
              <p className="text-xs text-muted-foreground/70">
                Reference ID: <code>{error.digest}</code>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-md border border-border px-5 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}

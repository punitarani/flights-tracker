"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AlertCreatedToast() {
  return (
    <Alert>
      <AlertTitle>Alert created</AlertTitle>
      <AlertDescription>
        <p className="inline-flex flex-wrap items-center gap-1">
          <span>Your flight alert is ready.</span>
          <Link
            href="/alerts"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
          >
            View alerts
            <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function renderAlertCreatedToast(_toastId: number | string) {
  return <AlertCreatedToast />;
}

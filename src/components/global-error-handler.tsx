"use client";

import { useEffect } from "react";

/**
 * Global error handler that silently catches AbortError rejections
 * while logging other unhandled promise rejections for debugging.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;

      // Check if it's an AbortError or contains abort-related messages
      if (
        (reason instanceof DOMException && reason.name === "AbortError") ||
        reason?.name === "AbortError" ||
        reason?.message?.includes("AbortError") ||
        reason?.message?.includes("aborted") ||
        reason?.message?.includes("user aborted") ||
        reason?.message?.includes("The user aborted a request")
      ) {
        // Silently prevent the unhandled rejection for AbortError
        // This is expected behavior when users navigate away or cancel requests
        event.preventDefault();
        return;
      }

      // Log other unhandled promise rejections for debugging
      console.error("Unhandled promise rejection:", reason);

      // Let Sentry or other error reporting handle the actual error
      // Don't prevent the event for other types of errors
    };

    const handleError = (event: ErrorEvent) => {
      const error = event.error;

      // Check if it's an AbortError
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        error?.name === "AbortError" ||
        error?.message?.includes("AbortError") ||
        error?.message?.includes("aborted") ||
        error?.message?.includes("user aborted") ||
        error?.message?.includes("The user aborted a request")
      ) {
        // Silently prevent the error from bubbling for AbortError
        event.preventDefault();
        return;
      }

      // Log other errors for debugging
      console.error("Global error:", error);
    };

    // Add event listeners
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
}

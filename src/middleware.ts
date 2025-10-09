import * as Sentry from "@sentry/nextjs";
import { captureRequestError, wrapMiddlewareWithSentry } from "@sentry/nextjs";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const middleware = wrapMiddlewareWithSentry(
  async (request: NextRequest) => {
    return await updateSession(request);
  },
);

export const onRequestError = captureRequestError((error, request) => {
  Sentry.captureException(error, {
    tags: { "middleware.request.method": request.method },
    extra: { url: request.url },
  });
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

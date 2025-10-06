import { createServerClient } from "@supabase/ssr";
import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";

import { env } from "@/env";

type SupabaseCookie = {
  name: string;
  value: string;
  options: {
    maxAge?: number;
    expires?: string | Date;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "lax" | "strict" | "none" | string;
  };
};

function parseRequestCookies(
  cookieHeader: string | undefined,
): Array<{ name: string; value: string }> {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(";")
    .reduce<Array<{ name: string; value: string }>>((acc, part) => {
      const [rawName, ...rest] = part.trim().split("=");
      if (!rawName) {
        return acc;
      }
      const name = rawName.trim();
      const value = rest.join("=");
      if (!name) {
        return acc;
      }
      acc.push({ name, value });
      return acc;
    }, []);
}

function serializeCookie({ name, value, options }: SupabaseCookie): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  const opts = options ?? {};

  if (opts.maxAge !== undefined) {
    segments.push(`Max-Age=${opts.maxAge}`);
  }

  const expires = opts.expires;
  if (expires) {
    const expiry =
      typeof expires === "string"
        ? expires
        : expires instanceof Date
          ? expires.toUTCString()
          : undefined;
    if (expiry) {
      segments.push(`Expires=${expiry}`);
    }
  }

  if (opts.domain) {
    segments.push(`Domain=${opts.domain}`);
  }

  segments.push(`Path=${opts.path ?? "/"}`);

  if (opts.secure) {
    segments.push("Secure");
  }

  if (opts.httpOnly) {
    segments.push("HttpOnly");
  }

  if (opts.sameSite) {
    segments.push(`SameSite=${opts.sameSite}`);
  }

  return segments.join("; ");
}

export const createContext = (opts?: CreateNextContextOptions) => {
  const req = opts?.req;
  const res = opts?.res;

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return parseRequestCookies(req?.headers.cookie).map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll(cookiesToSet) {
          if (!res) {
            return;
          }

          const existing = res.getHeader("Set-Cookie");
          const serialized = cookiesToSet.map((cookie) =>
            serializeCookie(cookie),
          );

          if (Array.isArray(existing)) {
            res.setHeader("Set-Cookie", [...existing, ...serialized]);
          } else if (typeof existing === "string" && existing.length > 0) {
            res.setHeader("Set-Cookie", [existing, ...serialized]);
          } else {
            res.setHeader("Set-Cookie", serialized);
          }
        },
      },
    },
  );

  return {
    req,
    res,
    supabase,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;

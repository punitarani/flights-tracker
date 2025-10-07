const PUBLIC_STATIC_PATHS = new Set([
  "/",
  "/login",
  "/auth",
  "/error",
  "/search",
]);

const PUBLIC_PATH_PREFIXES = ["/api/", "/auth/", "/error/"] as const;

function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) {
    return "";
  }

  const withoutFragment = pathname.split("#")[0] ?? pathname;
  const withoutQuery = withoutFragment.split("?")[0] ?? withoutFragment;

  if (withoutQuery === "/") {
    return "/";
  }

  if (withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }

  return withoutQuery;
}

export function isPublicRoute(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname);

  if (!normalized) {
    return false;
  }

  if (PUBLIC_STATIC_PATHS.has(normalized)) {
    return true;
  }

  return PUBLIC_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isSecureRoute(pathname: string | null | undefined): boolean {
  return !isPublicRoute(pathname);
}

export function getPublicRoutes(): readonly string[] {
  return Array.from(PUBLIC_STATIC_PATHS);
}

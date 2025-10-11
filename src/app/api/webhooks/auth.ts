import { env } from "@/env";

export function isAuthenticated(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    if (token === env.WEBHOOK_SECRET) {
      return true;
    }
  }

  const signature = request.headers.get("x-signature");
  if (signature && signature === env.WEBHOOK_SECRET) {
    return true;
  }

  return false;
}

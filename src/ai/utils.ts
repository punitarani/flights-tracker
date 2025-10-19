import { geolocation } from "@vercel/functions";

/**
 * Extract user context from the request.
 * Uses Vercel's geolocation for location data.
 * @param request - The incoming request
 * @param user - Optional user data from Supabase auth
 */
export function getUserContext(
  request: Request,
  user?: {
    id: string;
    email?: string;
    user_metadata?: {
      name?: string;
      full_name?: string;
    };
  },
): {
  id: string;
  name: string;
  email: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
} {
  const location = geolocation(request);

  return {
    id: user?.id ?? "anonymous",
    name:
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "Guest",
    email: user?.email ?? "guest@example.com",
    city: location.city ?? "Unknown",
    state: location.region ?? "Unknown",
    country: location.country ?? "US",
    zipCode: location.postalCode ?? "Unknown",
  };
}

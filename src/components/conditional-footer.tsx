"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";

/**
 * Conditionally renders the footer based on the current route.
 * Hides footer on routes where it shouldn't appear (e.g., /planner).
 */
export function ConditionalFooter() {
  const pathname = usePathname();

  // Hide footer on planner page
  if (pathname?.startsWith("/planner")) {
    return null;
  }

  return <Footer />;
}

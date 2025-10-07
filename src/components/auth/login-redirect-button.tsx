"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface LoginRedirectButtonProps {
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  fallbackRedirect?: string;
}

/**
 * Button component that redirects to login with current URL preserved
 */
export function LoginRedirectButton({
  children,
  variant = "default",
  size = "sm",
  className = "gap-2 font-semibold",
  fallbackRedirect = "/search",
}: LoginRedirectButtonProps) {
  const getCurrentUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.pathname + window.location.search;
    }
    return fallbackRedirect;
  };

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={`/login?redirectTo=${encodeURIComponent(getCurrentUrl())}`}>
        {children}
      </Link>
    </Button>
  );
}

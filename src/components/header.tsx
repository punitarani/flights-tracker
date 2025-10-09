"use client";

import { LogIn, Plane, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollPosition } from "@/hooks/use-scroll-position";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Planner", href: "/planner" },
  { label: "Alerts", href: "/alerts" },
];

interface HeaderProps {
  /**
   * Optional route information to display in collapsed state
   */
  route?: {
    origin?: string;
    destination?: string;
  };
}

export function Header({ route }: HeaderProps = {}) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const isScrolled = useScrollPosition({ threshold: 50 });
  const isMobile = useIsMobile();

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const renderDesktopNav = () => (
    <nav className="hidden items-center gap-2 md:flex">
      {NAV_ITEMS.map((item) => {
        if (item.href === "/alerts") {
          return (
            <Button
              key={item.label}
              asChild
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          );
        }

        return (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  disabled
                >
                  {item.label}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Coming soon</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );

  const isAuthenticated = Boolean(userEmail);
  const hasRoute = route?.origin && route?.destination;

  // Determine if we should show compact layout
  const isCompact = isScrolled && (isMobile || hasRoute);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-card/50 backdrop-blur-sm transition-all duration-200",
        isCompact && "shadow-sm",
      )}
    >
      <div
        className={cn(
          "container mx-auto flex items-center justify-between gap-4 px-4 transition-all duration-200",
          isCompact ? "py-2" : "py-4",
        )}
      >
        {/* Logo / Brand Section */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 transition-all duration-200",
            isCompact && isMobile && "gap-2",
          )}
        >
          <span
            className={cn(
              "text-2xl transition-all duration-200",
              isCompact && isMobile && "text-xl",
            )}
            role="img"
            aria-label="flight"
          >
            ✈️
          </span>
          {/* Hide brand name on mobile when scrolled */}
          <span
            className={cn(
              "text-2xl font-bold tracking-tight transition-all duration-200",
              isCompact && isMobile && "hidden",
              isCompact && !isMobile && "text-xl",
            )}
          >
            GrayPane
          </span>
        </Link>

        {/* Route Information (shown when scrolled and route exists) */}
        {isCompact && hasRoute && (
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate max-w-[80px] md:max-w-none">
              {route.origin}
            </span>
            <Plane
              className="h-3 w-3 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate max-w-[80px] md:max-w-none">
              {route.destination}
            </span>
          </div>
        )}

        {/* Navigation and Auth Section */}
        <div className="flex items-center gap-2">
          {/* Desktop nav - hide when mobile and scrolled */}
          {!(isCompact && isMobile) && renderDesktopNav()}

          {/* Auth Button/Menu */}
          {isAuthenticated ? (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size={isCompact ? "icon" : "sm"}
                  className={cn(
                    "gap-2",
                    !isCompact && "px-3",
                    isCompact && "h-8 w-8",
                  )}
                  aria-label={isCompact ? "User menu" : undefined}
                >
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  {!isCompact && (
                    <span className="max-w-[160px] truncate">{userEmail}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="space-y-2 p-3"
                style={{
                  width: isCompact
                    ? "240px"
                    : "var(--radix-popover-trigger-width)",
                  minWidth: isCompact
                    ? "240px"
                    : "var(--radix-popover-trigger-width)",
                }}
              >
                {/* Show user email in compact mode */}
                {isCompact && (
                  <div className="px-2 py-1 text-sm font-medium truncate border-b pb-2">
                    {userEmail}
                  </div>
                )}
                <div className="space-y-1 md:hidden">
                  {NAV_ITEMS.map((item) => {
                    if (item.href === "/alerts") {
                      return (
                        <Button
                          key={item.label}
                          asChild
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between gap-2"
                        >
                          <Link
                            href={item.href}
                            onClick={() => setIsPopoverOpen(false)}
                          >
                            <span>{item.label}</span>
                            <span className="text-xs text-muted-foreground">
                              View alerts
                            </span>
                          </Link>
                        </Button>
                      );
                    }

                    return (
                      <Button
                        key={item.label}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between gap-2"
                        disabled
                      >
                        <span>{item.label}</span>
                        <span className="text-xs text-muted-foreground">
                          Coming soon
                        </span>
                      </Button>
                    );
                  })}
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <Link href="/profile" onClick={() => setIsPopoverOpen(false)}>
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    <span>Profile</span>
                  </Link>
                </Button>
                <SignOutButton
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onSignOut={() => {
                    setIsPopoverOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              asChild
              variant="outline"
              size={isCompact ? "icon" : "sm"}
              className={cn(
                "gap-2",
                !isCompact && "px-3",
                isCompact && "h-8 w-8",
              )}
              aria-label={isCompact ? "Login" : undefined}
            >
              <Link href="/login">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {!isCompact && <span>Login</span>}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

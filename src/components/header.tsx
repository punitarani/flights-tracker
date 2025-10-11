"use client";

import { LogIn, UserRound } from "lucide-react";
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
import { useScroll } from "@/hooks/use-scroll";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Planner", href: "/planner" },
  { label: "Alerts", href: "/alerts" },
];

export type HeaderRoute = {
  origin?: {
    code: string;
    city: string;
    country: string;
  };
  destination?: {
    code: string;
    city: string;
    country: string;
  };
};

export type HeaderProps = {
  route?: HeaderRoute;
};

export function Header({ route }: HeaderProps = {}) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const isMobile = useIsMobile();
  const { isAtTop } = useScroll({ threshold: 20 });

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
  const showCompactHeader = isMobile && hasRoute && !isAtTop;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-card/50 backdrop-blur-sm transition-all duration-300",
        showCompactHeader ? "py-2" : "py-4",
      )}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4">
        {showCompactHeader ? (
          <>
            {/* Compact Mobile Header with Route */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg" role="img" aria-label="flight">
                ✈️
              </span>
            </Link>
            <div className="flex flex-1 items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>{route.origin?.code}</span>
                <span className="text-muted-foreground">→</span>
                <span>{route.destination?.code}</span>
              </div>
            </div>
            {isAuthenticated && (
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">User menu</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="space-y-2 p-3"
                  style={{
                    width: "var(--radix-popover-trigger-width)",
                    minWidth: "200px",
                  }}
                >
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
                    <Link
                      href="/profile"
                      onClick={() => setIsPopoverOpen(false)}
                    >
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
            )}
          </>
        ) : (
          <>
            {/* Full Header */}
            <Link href="/" className="flex items-center gap-3">
              <span className="text-2xl" role="img" aria-label="flight">
                ✈️
              </span>
              <span className="text-2xl font-bold tracking-tight">
                GrayPane
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {renderDesktopNav()}
              {isAuthenticated ? (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 px-3"
                    >
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                      <span className="max-w-[160px] truncate">
                        {userEmail}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="space-y-2 p-3"
                    style={{
                      width: "var(--radix-popover-trigger-width)",
                      minWidth: "var(--radix-popover-trigger-width)",
                    }}
                  >
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
                      <Link
                        href="/profile"
                        onClick={() => setIsPopoverOpen(false)}
                      >
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
                  size="sm"
                  className="gap-2 px-3"
                >
                  <Link href="/login">
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    <span>Login</span>
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

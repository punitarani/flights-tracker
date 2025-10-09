"use client";

import { Loader2, LogIn, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type HeaderCollapsedState = {
  isCollapsed: boolean;
  originCode?: string | null;
  originLabel?: string | null;
  destinationCode?: string | null;
  destinationLabel?: string | null;
  onExpand?: () => void;
  onReset?: () => void;
  onSearch?: () => void;
  isSearching?: boolean;
  isSearchDisabled?: boolean;
};

type HeaderProps = {
  collapsedState?: HeaderCollapsedState;
  children?: ReactNode;
};

const NAV_ITEMS = [
  { label: "Planner", href: "/planner" },
  { label: "Alerts", href: "/alerts" },
];

export function Header({ collapsedState, children }: HeaderProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const isCollapsed = collapsedState?.isCollapsed ?? false;

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

  const summaryPrimary = useMemo(() => {
    if (!collapsedState) {
      return null;
    }

    if (collapsedState.originCode && collapsedState.destinationCode) {
      return `${collapsedState.originCode} → ${collapsedState.destinationCode}`;
    }

    return "Search flights";
  }, [collapsedState]);

  const summarySecondary = useMemo(() => {
    if (!collapsedState) {
      return null;
    }

    if (collapsedState.originLabel && collapsedState.destinationLabel) {
      return `${collapsedState.originLabel} → ${collapsedState.destinationLabel}`;
    }

    return null;
  }, [collapsedState]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b bg-card/50 backdrop-blur transition-colors",
        isCollapsed ? "shadow-sm" : "shadow-none",
      )}
    >
      <div
        className={cn(
          "container mx-auto flex flex-col gap-3 px-4 transition-all duration-300",
          isCollapsed ? "py-2.5" : "py-4",
        )}
      >
        <div className="hidden items-center justify-between gap-3 md:flex">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <span
                className={cn(
                  "text-2xl transition-transform duration-300",
                  isCollapsed ? "scale-90" : "scale-100",
                )}
                role="img"
                aria-label="flight"
              >
                ✈️
              </span>
              <span className="text-2xl font-bold tracking-tight">
                GrayPane
              </span>
            </Link>
            {renderDesktopNav()}
          </div>
          <div className="flex items-center gap-2">
            {isCollapsed &&
            collapsedState?.onExpand &&
            collapsedState?.onReset &&
            collapsedState?.onSearch ? (
              <>
                <button
                  type="button"
                  className="flex items-center rounded-lg border border-border/60 bg-background/95 px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur transition-all duration-200 hover:bg-background"
                  onClick={collapsedState.onExpand}
                >
                  <span>{summaryPrimary ?? "Search flights"}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={collapsedState.onReset}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  className="h-9 gap-2 px-3"
                  disabled={collapsedState.isSearchDisabled}
                  onClick={collapsedState.onSearch}
                >
                  {collapsedState.isSearching ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="text-sm font-semibold">
                    {collapsedState.isSearching
                      ? "Searching..."
                      : "Search Flights"}
                  </span>
                </Button>
              </>
            ) : null}
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
                    <span className="max-w-[160px] truncate">{userEmail}</span>
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
        </div>

        <div className="md:hidden">
          {collapsedState?.isCollapsed ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="flex flex-1 items-center gap-2.5 rounded-full border border-border/60 bg-background/80 px-3 py-2 text-left shadow-sm backdrop-blur transition-all duration-300 hover:bg-background/90"
                onClick={collapsedState.onExpand}
              >
                <span className="text-xl" role="img" aria-label="flight">
                  ✈️
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {summaryPrimary ?? "Search flights"}
                  </span>
                  {summarySecondary ? (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {summarySecondary}
                    </span>
                  ) : null}
                </div>
              </button>
              {isAuthenticated ? (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                    >
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Open profile menu</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="space-y-2 p-3 w-56">
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
                  size="icon"
                  className="shrink-0"
                >
                  <Link href="/login" aria-label="Login">
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-3">
                <span className="text-xl" role="img" aria-label="flight">
                  ✈️
                </span>
                <span className="text-lg font-semibold">GrayPane</span>
              </Link>
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
                      <span className="max-w-[140px] truncate">
                        {userEmail}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="space-y-2 p-3 w-48">
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
          )}
        </div>

        {children ? (
          <div
            className={cn(
              "transition-all duration-300",
              isCollapsed ? "md:pt-0" : "",
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

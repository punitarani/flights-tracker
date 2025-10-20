"use client";

import { LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Search", href: "/search" },
  { label: "Planner", href: "/planner" },
  { label: "Alerts", href: "/alerts" },
];

export function Header() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const pathname = usePathname();

  const isPathActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  const navBaseClasses =
    "gap-2 relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 after:ease-out after:content-[''] hover:after:scale-x-100";

  const desktopExtras =
    "md:after:left-1/2 md:after:-translate-x-1/2 md:after:origin-center";

  const getNavClasses = (href: string, extra?: string) =>
    cn(
      navBaseClasses,
      desktopExtras,
      extra,
      isPathActive(href) && "after:scale-x-100",
    );

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth
      .getUser()
      .then(({ data }) => {
        setUserEmail(data.user?.email ?? null);
        setIsAuthLoading(false);
      })
      .catch(() => {
        setIsAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const renderDesktopNav = () => (
    <nav className="flex items-center gap-2">
      {NAV_ITEMS.map((item) => {
        if (
          item.href === "/search" ||
          item.href === "/alerts" ||
          item.href === "/planner"
        ) {
          return (
            <Button
              key={item.label}
              asChild
              type="button"
              variant="ghost"
              size="sm"
              className={getNavClasses(item.href)}
            >
              <Link href={item.href}>
                {item.href === "/planner" && (
                  <Badge variant="outline">AI</Badge>
                )}
                {item.label}
              </Link>
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

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4 relative">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-label="flight">
            ✈️
          </span>
          <span className="text-2xl font-bold tracking-tight">GrayPane</span>
        </Link>

        {/* Centered Navigation */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex">
          {renderDesktopNav()}
        </div>

        <div className="flex items-center gap-2 min-w-[160px] justify-end">
          {isAuthLoading ? (
            <Skeleton className="h-9 w-[140px]" />
          ) : isAuthenticated ? (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 px-3 min-w-[140px] justify-center"
                >
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  <span className="max-w-[160px] truncate">
                    {userEmail?.split("@")[0]}
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
                    if (item.href === "/search") {
                      return (
                        <Button
                          key={item.label}
                          asChild
                          variant="ghost"
                          size="sm"
                          className={getNavClasses(
                            item.href,
                            "w-full justify-start gap-2 after:-bottom-1",
                          )}
                        >
                          <Link
                            href={item.href}
                            onClick={() => setIsPopoverOpen(false)}
                          >
                            <span>{item.label}</span>
                          </Link>
                        </Button>
                      );
                    }

                    if (item.href === "/planner") {
                      return (
                        <Button
                          key={item.label}
                          asChild
                          variant="ghost"
                          size="sm"
                          className={getNavClasses(
                            item.href,
                            "w-full justify-start gap-2 after:-bottom-1",
                          )}
                        >
                          <Link
                            href={item.href}
                            onClick={() => setIsPopoverOpen(false)}
                          >
                            <Badge variant="outline">AI</Badge>
                            <span>{item.label}</span>
                          </Link>
                        </Button>
                      );
                    }

                    if (item.href === "/alerts") {
                      return (
                        <Button
                          key={item.label}
                          asChild
                          variant="ghost"
                          size="sm"
                          className={getNavClasses(
                            item.href,
                            "w-full justify-start gap-2 after:-bottom-1",
                          )}
                        >
                          <Link
                            href={item.href}
                            onClick={() => setIsPopoverOpen(false)}
                          >
                            <span>{item.label}</span>
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
                        className="w-full justify-start gap-2"
                        disabled
                      >
                        <span>{item.label}</span>
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
              size="sm"
              className="gap-2 px-3 min-w-[140px] justify-center"
            >
              <Link href="/login">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Login</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

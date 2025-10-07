"use client";

import { Loader2, LogOut } from "lucide-react";
import { type ComponentProps, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { isSecureRoute } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

type ButtonComponentProps = ComponentProps<typeof Button>;

type SignOutButtonProps = Pick<
  ButtonComponentProps,
  "variant" | "size" | "className"
> & {
  onSignOut?: () => void;
};

export function SignOutButton({
  className,
  size,
  variant,
  onSignOut,
}: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      onSignOut?.();
      const currentPath = window.location.pathname;
      if (isSecureRoute(currentPath)) {
        window.location.assign("/login");
      }
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleSignOut}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden="true" />
      )}
      <span>Sign out</span>
    </Button>
  );
}

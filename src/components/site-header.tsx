import { LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type SiteHeaderProps = {
  readonly signOutAction: () => Promise<void>;
};

export function SiteHeader({ signOutAction }: SiteHeaderProps) {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-label="flight">
            ✈️
          </span>
          <span className="text-2xl font-bold tracking-tight">
            Flights Tracker
          </span>
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="gap-2">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}

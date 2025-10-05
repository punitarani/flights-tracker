import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export function SiteHeader() {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-label="flight">
            ✈️
          </span>
          <span className="text-2xl font-bold tracking-tight">Fli</span>
        </Link>
        <SignOutButton variant="outline" className="gap-2" size="sm" />
      </div>
    </header>
  );
}

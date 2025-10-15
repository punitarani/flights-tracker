import { Github } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

type SocialLink = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const socialLinks: SocialLink[] = [
  {
    href: "https://x.com/punit_arani",
    label: "X (formerly Twitter) — @punit_arani",
    icon: XLogo,
  },
  {
    href: "https://github.com/punitarani/flights-tracker",
    label: "GitHub — punitarani/flights-tracker",
    icon: Github,
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/40 backdrop-blur">
      <div className="container mx-auto flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          <span className="relative h-6 w-6 overflow-hidden rounded-full bg-muted/20 ring-1 ring-border/50">
            <Image
              src="/globe.svg"
              alt="Graypane logo"
              fill
              sizes="24px"
              className="object-contain object-center"
            />
          </span>
          <span className="tracking-tight">GrayPane</span>
        </Link>

        <div className="flex items-center gap-3">
          {socialLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <span className="sr-only">{label}</span>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

function XLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M19.633 3.058l-6.4 7.261 7.2 10.128h-5.573l-4.54-5.931L6.01 20.447H2.036l6.407-7.417L1.4 3.058h5.565l4.109 5.33 4.727-5.33h3.832z"
      />
    </svg>
  );
}

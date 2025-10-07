import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type BentoGridProps = ComponentPropsWithoutRef<"div">;

export function BentoGrid({ className, ...props }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[minmax(14rem,_auto)] gap-4 sm:auto-rows-[minmax(16rem,_auto)] lg:auto-rows-[minmax(18rem,_auto)]",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      {...props}
    />
  );
}

type BentoCardProps = ComponentPropsWithoutRef<"div"> & {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
  background?: ReactNode;
  children?: ReactNode;
};

export function BentoCard({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  background,
  children,
  className,
  ...props
}: BentoCardProps) {
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/40",
        "bg-background/75 p-5 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.6)] transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-[0_36px_90px_-45px_rgba(37,99,235,0.35)]",
        className,
      )}
      {...props}
    >
      {background ? (
        <div className="pointer-events-none absolute inset-0 opacity-90 transition-opacity duration-500 group-hover:opacity-100">
          {background}
        </div>
      ) : null}

      <div className="relative z-10 flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            {eyebrow ? (
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/70">
                {eyebrow}
              </div>
            ) : null}

            <div className="flex items-center gap-2 text-foreground">
              {Icon ? <Icon className="h-5 w-5 text-primary" aria-hidden="true" /> : null}
              <h3 className="text-lg font-semibold leading-tight sm:text-xl">{title}</h3>
            </div>

            {description ? (
              <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          {actions ? <div className="shrink-0 text-xs text-muted-foreground">{actions}</div> : null}
        </div>

        <div className="relative flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
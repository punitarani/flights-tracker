"use client";

import { ArrowRight, PlaneTakeoff } from "lucide-react";
import { useMemo } from "react";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import {
  POPULAR_ROUTE_GROUPS,
  type PopularRoute,
  type PopularRouteGroup,
} from "@/data/popular-routes";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-US");

const gradientByIndex = [
  "from-sky-500/20 via-sky-500/5 to-transparent",
  "from-emerald-500/20 via-emerald-500/5 to-transparent",
  "from-amber-500/20 via-amber-500/5 to-transparent",
  "from-violet-500/20 via-violet-500/5 to-transparent",
  "from-rose-500/20 via-rose-500/5 to-transparent",
  "from-indigo-500/20 via-indigo-500/5 to-transparent",
  "from-cyan-500/20 via-cyan-500/5 to-transparent",
  "from-slate-500/20 via-slate-500/5 to-transparent",
];

type PopularRoutesBoardProps = {
  groups?: PopularRouteGroup[];
  selectedRouteId?: string | null;
  onSelectRoute?: (route: PopularRoute) => void;
  onClearSelection?: () => void;
};

export function PopularRoutesBoard({
  groups = POPULAR_ROUTE_GROUPS,
  selectedRouteId,
  onSelectRoute,
  onClearSelection,
}: PopularRoutesBoardProps) {
  const routes = useMemo(
    () => groups.flatMap((group) => group.routes),
    [groups],
  );

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-[2.5rem] border border-border/40 bg-background/65 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.65)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_52%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,_rgba(15,23,42,0.18)_0%,_rgba(15,23,42,0.05)_32%,_transparent_80%)]" />

      <div className="relative flex-1 overflow-hidden">
        <div className="h-full w-full overflow-y-auto px-5 py-6 sm:px-7 lg:px-10 lg:py-10">
          <BentoGrid className="mx-auto max-w-7xl xl:grid-cols-5">
            {routes.map((route, index) => {
              const isSelected = selectedRouteId === route.id;
              const gradientClass =
                gradientByIndex[index % gradientByIndex.length];

              const handleSelect = () => {
                if (isSelected) {
                  onClearSelection?.();
                  if (!onClearSelection) onSelectRoute?.(route);
                } else {
                  onSelectRoute?.(route);
                }
              };

              return (
                <BentoCard
                  as="button"
                  key={route.id}
                  className={cn(
                    "sm:col-span-1 cursor-pointer select-none outline-none transition-all duration-200",
                    "hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_18px_40px_-32px_rgba(37,99,235,0.4)]",
                    isSelected &&
                      "border-primary/70 bg-primary/10 shadow-[0_20px_55px_-32px_rgba(37,99,235,0.45)]",
                  )}
                  title={`${route.origin.iata} → ${route.destination.iata}`}
                  description={`${route.origin.city}, ${route.origin.country} • ${route.destination.city}, ${route.destination.country}`}
                  icon={PlaneTakeoff}
                  background={
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-80 transition-opacity duration-500 group-hover:opacity-100",
                        gradientClass,
                        isSelected && "opacity-100",
                      )}
                    />
                  }
                  aria-pressed={isSelected}
                  aria-label={`${route.origin.iata} to ${route.destination.iata}`}
                  onClick={handleSelect}
                >
                  <div className="flex h-full items-end justify-between text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
                    {route.distanceMiles ? (
                      <span>
                        {numberFormatter.format(route.distanceMiles)} mi
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">
                        Distance N/A
                      </span>
                    )}
                    <div className="flex items-center gap-2 text-[11px] font-medium normal-case tracking-[0.18em]">
                      <span>{route.origin.country}</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{route.destination.country}</span>
                    </div>
                  </div>
                </BentoCard>
              );
            })}
          </BentoGrid>
        </div>
      </div>
    </div>
  );
}

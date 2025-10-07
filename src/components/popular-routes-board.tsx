"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  POPULAR_ROUTE_GROUPS,
  type PopularRoute,
  type PopularRouteGroup,
} from "@/data/popular-routes";
import { cn } from "@/lib/utils";

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
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/40 bg-card/60 shadow-[0_32px_80px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      <div className="relative border-b border-border/30 bg-gradient-to-b from-background/80 via-background/60 to-background/30 px-6 pb-5 pt-6 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Badge
              variant="secondary"
              className="inline-flex items-center gap-1 border border-primary/10 bg-primary/5 text-primary"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Curated itineraries
            </Badge>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Popular flight routes
              </h2>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                Discover hand-picked journeys favored by frequent flyers. Select
                a route to preview it on the map instantly.
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            disabled={!selectedRouteId}
            className="rounded-full border border-border/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
          >
            Clear
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-8 px-6 py-6 sm:px-7">
          {groups.map((group) => (
            <section key={group.id} className="space-y-4">
              <header className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.4em] text-muted-foreground/60">
                  {group.title}
                </p>
                {group.description ? (
                  <p className="text-sm text-muted-foreground sm:text-base">
                    {group.description}
                  </p>
                ) : null}
              </header>

              <div className="grid gap-3 sm:grid-cols-2">
                {group.routes.map((route) => (
                  <PopularRouteCard
                    key={route.id}
                    route={route}
                    isSelected={selectedRouteId === route.id}
                    onSelect={() => onSelectRoute?.(route)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

type PopularRouteCardProps = {
  route: PopularRoute;
  isSelected: boolean;
  onSelect: () => void;
};

function PopularRouteCard({
  route,
  isSelected,
  onSelect,
}: PopularRouteCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br from-background/90 via-background/70 to-background/60 p-4 text-left shadow-[0_20px_45px_-35px_rgba(15,23,42,0.65)] transition-all duration-200",
        "hover:border-primary/50 hover:shadow-[0_32px_45px_-32px_rgba(37,99,235,0.25)] hover:brightness-[1.03]",
        isSelected &&
          "border-primary/70 from-primary/15 via-primary/10 to-primary/5 shadow-[0_40px_65px_-40px_rgba(37,99,235,0.45)]",
      )}
    >
      <div className="flex items-center gap-3 text-foreground">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {route.origin.iata}
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          />
          <span className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {route.destination.iata}
          </span>
        </div>
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          {route.origin.city} → {route.destination.city}
        </p>
        <p className="text-xs">
          {route.origin.airport} · {route.destination.airport}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Badge
          variant="secondary"
          className="rounded-full border border-border/40 bg-background/70 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {route.origin.country}
        </Badge>
        <Badge
          variant="secondary"
          className="rounded-full border border-border/40 bg-background/70 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {route.destination.country}
        </Badge>
      </div>

      {route.distanceMiles ? (
        <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground/80">
          {Intl.NumberFormat("en-US").format(route.distanceMiles)} mi
        </span>
      ) : null}

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200",
          "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
          isSelected && "opacity-100",
        )}
      />
    </button>
  );
}

"use client";

import {
  ArrowRight,
  Compass,
  Globe2,
  MapPinned,
  PlaneTakeoff,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  POPULAR_ROUTE_GROUPS,
  type PopularRoute,
  type PopularRouteGroup,
} from "@/data/popular-routes";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-US");

const groupLayoutByIndex = [
  "sm:col-span-2 lg:col-span-2",
  "sm:col-span-2 lg:col-span-2",
  "sm:col-span-2 lg:col-span-2",
  "sm:col-span-2 lg:col-span-2",
  "sm:col-span-2 lg:col-span-4 lg:row-span-2",
];

const gradientByIndex = [
  "from-sky-500/15 via-sky-500/5 to-transparent",
  "from-emerald-500/15 via-emerald-500/5 to-transparent",
  "from-amber-500/15 via-amber-500/5 to-transparent",
  "from-violet-500/15 via-violet-500/5 to-transparent",
  "from-rose-500/15 via-rose-500/5 to-transparent",
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
  const allRoutes = useMemo(
    () => groups.flatMap((group) => group.routes),
    [groups],
  );

  const totalRoutes = allRoutes.length;

  const uniqueMarkets = useMemo(() => {
    const countries = new Set<string>();
    for (const route of allRoutes) {
      countries.add(route.origin.country);
      countries.add(route.destination.country);
    }
    return countries;
  }, [allRoutes]);

  const longestRoute = useMemo(() => {
    return allRoutes.reduce<PopularRoute | null>((previous, current) => {
      if (!current.distanceMiles) return previous;
      if (!previous) return current;
      return current.distanceMiles > (previous.distanceMiles ?? 0)
        ? current
        : previous;
    }, null);
  }, [allRoutes]);

  const longestRouteLabel = longestRoute
    ? `${longestRoute.origin.iata} → ${longestRoute.destination.iata}`
    : "Long-haul route";

  const longestRouteDistance = longestRoute?.distanceMiles
    ? `${numberFormatter.format(longestRoute.distanceMiles)} mi`
    : "—";

  const selectedRoute = selectedRouteId
    ? allRoutes.find((route) => route.id === selectedRouteId)
    : null;

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-[2.5rem] border border-border/40 bg-background/65 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.65)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_52%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,_rgba(15,23,42,0.18)_0%,_rgba(15,23,42,0.05)_32%,_transparent_80%)]" />

      <div className="relative flex-1 overflow-hidden">
        <div className="h-full w-full overflow-y-auto px-5 py-6 sm:px-7 lg:px-10 lg:py-10">
          <BentoGrid className="mx-auto max-w-7xl">
            <BentoCard
              className="sm:col-span-2 lg:col-span-2 lg:row-span-2"
              eyebrow="Curated itineraries"
              title="Popular flight routes"
              description="Dive into themed collections spanning business shuttles, leisure escapes, and global gateway pairings."
              icon={Sparkles}
              background={
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_60%)]" />
              }
            >
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <OverviewStat
                    label="Curated routes"
                    value={numberFormatter.format(totalRoutes)}
                    helper="A hand-picked roster of long-haul icons and short-hop favorites"
                  />
                  <OverviewStat
                    label="Markets covered"
                    value={numberFormatter.format(uniqueMarkets.size)}
                    helper="Countries represented across origin and destination endpoints"
                  />
                  <OverviewStat
                    label="Longest hop"
                    value={longestRouteDistance}
                    helper={longestRouteLabel}
                  />
                  <OverviewStat
                    label="Live map sync"
                    value="Tap to preview"
                    helper="Tiles instantly align the map to your chosen journey"
                  />
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Scroll to explore every collection. Selecting a tile will
                  immediately recenter the map, highlight the route path, and
                  surface fare insights.
                </p>
              </div>
            </BentoCard>

            <BentoCard
              className="sm:col-span-2 lg:col-span-2"
              eyebrow="Current preview"
              title={
                selectedRoute
                  ? "Route pinned to the map"
                  : "Choose a route to preview"
              }
              description={
                selectedRoute
                  ? "Examining this journey unlocks price trends, airport context, and live map annotations."
                  : "Browse the tiles in each collection to discover signature pairings curated for different travel moods."
              }
              icon={Compass}
              actions={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onClearSelection}
                  disabled={!selectedRoute}
                  className="rounded-full border-border/60 text-xs font-semibold uppercase tracking-[0.28em]"
                >
                  Clear
                </Button>
              }
              background={
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(14,116,144,0.18),_transparent_65%)]" />
              }
            >
              {selectedRoute ? (
                <div className="flex h-full flex-col justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex items-baseline gap-3 text-4xl font-semibold tracking-tight">
                      <span>{selectedRoute.origin.iata}</span>
                      <ArrowRight
                        className="h-6 w-6 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{selectedRoute.destination.iata}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedRoute.origin.city} ·{" "}
                      {selectedRoute.origin.country} →{" "}
                      {selectedRoute.destination.city} ·{" "}
                      {selectedRoute.destination.country}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedRoute.distanceMiles ? (
                        <Badge
                          variant="secondary"
                          className="justify-center rounded-full border border-border/50 bg-background/80 text-[11px] uppercase tracking-[0.3em]"
                        >
                          {numberFormatter.format(selectedRoute.distanceMiles)}{" "}
                          mi
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className="justify-center rounded-full border-border/50 bg-background/60 text-[11px] uppercase tracking-[0.25em]"
                      >
                        Map synced
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-4 text-xs text-muted-foreground">
                    Tip: Clear the selection to return to the full bento canvas
                    and spark a new adventure.
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col justify-end gap-6">
                  <div className="rounded-3xl border border-dashed border-border/50 bg-background/40 p-6 text-sm leading-relaxed text-muted-foreground">
                    Each collection below clusters flights that travelers
                    repeatedly search together. Use them as springboards for
                    itinerary planning or quick price discovery.
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <Badge
                      variant="secondary"
                      className="rounded-full border border-border/50 bg-background/70 px-3 py-1 uppercase tracking-[0.28em]"
                    >
                      Scroll to explore
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full border-border/50 bg-background/40 px-3 py-1 uppercase tracking-[0.28em]"
                    >
                      Tap any tile
                    </Badge>
                  </div>
                </div>
              )}
            </BentoCard>

            {groups.map((group, index) => {
              const cardClass =
                groupLayoutByIndex[index] ?? "sm:col-span-2 lg:col-span-2";
              const gradientClass =
                gradientByIndex[index % gradientByIndex.length];

              return (
                <BentoCard
                  key={group.id}
                  className={cardClass}
                  eyebrow={`Collection 0${index + 1}`}
                  title={group.title}
                  description={group.description}
                  icon={index % 2 === 0 ? Globe2 : PlaneTakeoff}
                  background={
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-80 transition-opacity duration-500 group-hover:opacity-100",
                        gradientClass,
                      )}
                    />
                  }
                >
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.4em] text-muted-foreground/70">
                      <MapPinned
                        className="h-4 w-4 text-primary"
                        aria-hidden="true"
                      />
                      {group.routes.length} curated pairings
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="space-y-2 pr-4">
                        {group.routes.map((route) => {
                          const isSelected = selectedRouteId === route.id;

                          return (
                            <button
                              key={route.id}
                              type="button"
                              onClick={() => onSelectRoute?.(route)}
                              className={cn(
                                "group flex w-full items-center justify-between gap-3 rounded-2xl border border-border/40 bg-background/80 px-4 py-3 text-left transition-all duration-200",
                                "hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_18px_40px_-32px_rgba(37,99,235,0.4)]",
                                isSelected &&
                                  "border-primary/70 bg-primary/10 shadow-[0_20px_55px_-32px_rgba(37,99,235,0.45)]",
                              )}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                                  <span>{route.origin.iata}</span>
                                  <ArrowRight
                                    className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1"
                                    aria-hidden="true"
                                  />
                                  <span>{route.destination.iata}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {route.origin.city} · {route.destination.city}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1 text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
                                {route.distanceMiles ? (
                                  <span>
                                    {numberFormatter.format(
                                      route.distanceMiles,
                                    )}{" "}
                                    mi
                                  </span>
                                ) : null}
                                <span className="text-[10px] tracking-[0.22em]">
                                  {route.destination.country}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
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

type OverviewStatProps = {
  label: string;
  value: string;
  helper?: string;
};

function OverviewStat({ label, value, helper }: OverviewStatProps) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/60 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)]">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {helper ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

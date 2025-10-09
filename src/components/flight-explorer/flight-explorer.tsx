"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AirportMapPopularRoute } from "@/components/airport-map";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { POPULAR_ROUTES } from "@/data/popular-routes";
import { useFlightExplorer } from "@/hooks/use-flight-explorer";
import type { AirportData } from "@/server/services/airports";
import { AirportMapView } from "./airport-map-view";
import { FlightPricePanel } from "./flight-price-panel";
import { RouteSearchPanel } from "./route-search-panel";

const COLLAPSE_SCROLL_OFFSET = 160;

export type FlightExplorerProps = {
  airports: AirportData[];
  totalAirports: number;
  isLoadingAirports: boolean;
};

export function FlightExplorer({
  airports,
  totalAirports,
  isLoadingAirports,
}: FlightExplorerProps) {
  const isInitialLoading = isLoadingAirports && airports.length === 0;

  const {
    search,
    header,
    map: mapState,
    price,
    filters,
  } = useFlightExplorer({
    airports,
    totalAirports,
    isInitialLoading,
  });

  const airportsByIata = useMemo(() => {
    const entries = new Map<string, AirportData>();
    for (const airport of airports) {
      if (airport.iata) {
        entries.set(airport.iata.toUpperCase(), airport);
      }
    }
    return entries;
  }, [airports]);

  const popularRoutesWithAirports = useMemo(() => {
    const enriched: AirportMapPopularRoute[] = [];

    for (const route of POPULAR_ROUTES) {
      const origin = airportsByIata.get(route.origin.iata.toUpperCase());
      const destination = airportsByIata.get(
        route.destination.iata.toUpperCase(),
      );

      if (!origin || !destination) {
        continue;
      }

      enriched.push({
        id: route.id,
        origin,
        destination,
        distanceMiles: route.distanceMiles,
      });
    }

    return enriched.sort((a, b) => a.id.localeCompare(b.id));
  }, [airportsByIata]);

  const distanceFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }),
    [],
  );

  const [hoveredRoute, setHoveredRoute] =
    useState<AirportMapPopularRoute | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const collapseSentinelRef = useRef<HTMLDivElement | null>(null);
  const collapseObserverRef = useRef<IntersectionObserver | null>(null);

  const selectedPopularRoute = useMemo(() => {
    if (!mapState.originAirport || !mapState.destinationAirport) {
      return null;
    }

    const originCode = mapState.originAirport.iata.toUpperCase();
    const destinationCode = mapState.destinationAirport.iata.toUpperCase();
    const directId = `${originCode}-${destinationCode}`;
    const inverseId = `${destinationCode}-${originCode}`;

    return (
      popularRoutesWithAirports.find((route) => route.id === directId) ??
      popularRoutesWithAirports.find((route) => route.id === inverseId) ??
      null
    );
  }, [
    mapState.destinationAirport,
    mapState.originAirport,
    popularRoutesWithAirports,
  ]);

  const selectRoute = useCallback(
    (originIata: string, destinationIata: string) => {
      search.selectRoute(originIata, destinationIata);
    },
    [search],
  );

  const handlePopularRouteSelect = useCallback(
    (route: AirportMapPopularRoute) => {
      selectRoute(route.origin.iata, route.destination.iata);
    },
    [selectRoute],
  );

  const evaluateCollapse = useCallback(() => {
    const sentinel = collapseSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const next = sentinel.getBoundingClientRect().top <= COLLAPSE_SCROLL_OFFSET;
    setIsHeaderCollapsed((previous) => (previous === next ? previous : next));
  }, []);

  const registerSentinel = useCallback(
    (node: HTMLDivElement | null) => {
      if (collapseObserverRef.current) {
        collapseObserverRef.current.disconnect();
        collapseObserverRef.current = null;
      }

      collapseSentinelRef.current = node;

      if (!node || typeof window === "undefined") {
        return;
      }

      evaluateCollapse();

      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (!entry) {
              return;
            }

            const next =
              entry.boundingClientRect.top <= COLLAPSE_SCROLL_OFFSET ||
              !entry.isIntersecting;

            setIsHeaderCollapsed((previous) =>
              previous === next ? previous : next,
            );
          },
          {
            root: null,
            threshold: 0,
          },
        );

        observer.observe(node);
        collapseObserverRef.current = observer;
      }
    },
    [evaluateCollapse],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleScroll = () => {
      evaluateCollapse();
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [evaluateCollapse]);

  const handleExpandHeader = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsHeaderCollapsed(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const originAirport = mapState.originAirport;
  const destinationAirport = mapState.destinationAirport;

  const collapsedState = useMemo(() => {
    const originLabel = originAirport
      ? [originAirport.city, originAirport.country]
          .filter(Boolean)
          .join(", ") || originAirport.name
      : null;
    const destinationLabel = destinationAirport
      ? [destinationAirport.city, destinationAirport.country]
          .filter(Boolean)
          .join(", ") || destinationAirport.name
      : null;

    return {
      isCollapsed: isHeaderCollapsed,
      originCode: originAirport?.iata ?? null,
      originLabel,
      destinationCode: destinationAirport?.iata ?? null,
      destinationLabel,
      onExpand: handleExpandHeader,
    } as const;
  }, [
    destinationAirport,
    handleExpandHeader,
    isHeaderCollapsed,
    originAirport,
  ]);

  const infoRoute = hoveredRoute ?? selectedPopularRoute ?? null;

  const infoRouteMessage = useMemo(() => {
    if (hoveredRoute) {
      return "Click this route to load it into the search fields.";
    }

    if (selectedPopularRoute) {
      return "This route is already loaded into the search fields.";
    }

    return "Click a route line to load it into the search fields.";
  }, [hoveredRoute, selectedPopularRoute]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header collapsedState={collapsedState}>
        <RouteSearchPanel
          search={search}
          header={header}
          isCollapsed={isHeaderCollapsed}
          onExpand={handleExpandHeader}
        />
      </Header>
      <div aria-hidden className="h-px" ref={registerSentinel} />

      <div className="relative flex-1 overflow-hidden">
        <div className="relative flex h-full flex-col">
          {header.isInitialLoading ? (
            <div className="flex flex-1 items-center justify-center bg-muted/20">
              <Card className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/70 px-6 py-5 shadow-lg backdrop-blur">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">Loading airports...</span>
              </Card>
            </div>
          ) : price.shouldShowPanel ? (
            <FlightPricePanel
              state={price}
              filters={filters}
              originAirport={mapState.originAirport}
              destinationAirport={mapState.destinationAirport}
            />
          ) : (
            <div className="container mx-auto flex h-full w-full flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pb-10">
              <div className="flex h-full w-full">
                <div className="relative flex h-full w-full min-h-[360px] overflow-hidden rounded-3xl border border-border/40 bg-card/40 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl">
                  <AirportMapView
                    state={mapState}
                    popularRoutes={popularRoutesWithAirports}
                    activeRouteId={selectedPopularRoute?.id ?? null}
                    onRouteHover={setHoveredRoute}
                    onRouteSelect={handlePopularRouteSelect}
                  />

                  {popularRoutesWithAirports.length === 0 ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                      <div className="pointer-events-auto rounded-3xl border border-dashed border-border/50 bg-background/90 px-6 py-5 text-center text-sm text-muted-foreground shadow-xl backdrop-blur">
                        Unable to plot popular routes with the available airport
                        data.
                      </div>
                    </div>
                  ) : (
                    <div className="pointer-events-none absolute inset-x-4 top-4 sm:left-6 sm:right-auto sm:top-6 sm:w-auto sm:max-w-sm sm:inset-x-auto lg:left-8 lg:top-8">
                      <div className="pointer-events-auto w-full rounded-[1.35rem] border border-border/35 bg-background/92 px-4 py-3.5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.55)] backdrop-blur">
                        {infoRoute ? (
                          <>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/90">
                                  {hoveredRoute
                                    ? "Route preview"
                                    : "Selected route"}
                                </p>
                                <p className="text-xl font-semibold tracking-tight text-foreground">
                                  {infoRoute.origin.iata} →{" "}
                                  {infoRoute.destination.iata}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {infoRoute.origin.city},{" "}
                                  {infoRoute.origin.country}
                                  {" / "}
                                  {infoRoute.destination.city},{" "}
                                  {infoRoute.destination.country}
                                </p>
                              </div>
                              {infoRoute.distanceMiles ? (
                                <div className="text-right">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/90">
                                    Distance
                                  </p>
                                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                                    {distanceFormatter.format(
                                      infoRoute.distanceMiles,
                                    )}{" "}
                                    mi
                                  </p>
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <p>{infoRouteMessage}</p>
                              {selectedPopularRoute ? (
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="h-auto px-0 text-xs font-semibold"
                                  onClick={search.clearRoute}
                                >
                                  Clear selection
                                </Button>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/90">
                              Popular routes map
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Hover any route to preview airport details. Click
                              to load it into the search fields.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { type MapKitMap, mapKitLoader } from "@/lib/mapkit-service";
import type { AirportData } from "@/server/services/airports";

interface AirportMapProps {
  airports: AirportData[];
  originAirport?: AirportData | null;
  destinationAirport?: AirportData | null;
  showAllAirports: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  onMapReady?: (map: any) => void;
  onAirportClick?: (airport: AirportData) => void;
}

const WORLD_CENTER = { latitude: 20, longitude: 0 };
const WORLD_SPAN = { latitudeDelta: 160, longitudeDelta: 360 };
const ROUTE_PADDING = 64;
const SINGLE_MARKER_PADDING = 80;

type AirportMarkerEntry = {
  id: string;
  // biome-ignore lint/suspicious/noExplicitAny: MapKit annotations are runtime objects
  annotation: any;
};

export function AirportMap({
  airports: _airports,
  originAirport,
  destinationAirport,
  showAllAirports: _showAllAirports,
  onMapReady,
  onAirportClick,
}: AirportMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapKitMap | null>(null);
  const markersRef = useRef<{
    origin?: AirportMarkerEntry;
    destination?: AirportMarkerEntry;
  }>({});
  const routeOverlayRef = useRef<unknown | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  void _airports;
  void _showAllAirports;

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      try {
        await mapKitLoader.load();

        if (!mapKitLoader.isReady()) {
          throw new Error("MapKit failed to initialize");
        }

        const mapkit = mapKitLoader.getMapKit();
        if (!containerRef.current) {
          return;
        }

        const map = new mapkit.Map(containerRef.current, {
          region: new mapkit.CoordinateRegion(
            new mapkit.Coordinate(
              WORLD_CENTER.latitude,
              WORLD_CENTER.longitude,
            ),
            new mapkit.CoordinateSpan(
              WORLD_SPAN.latitudeDelta,
              WORLD_SPAN.longitudeDelta,
            ),
          ),
          showsMapTypeControl: false,
          showsZoomControl: true,
          showsUserLocationControl: false,
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsScale: mapkit.FeatureVisibility.Hidden,
          isRotationEnabled: false,
          colorScheme: mapkit.Map.ColorSchemes.Light,
        });

        if (!isMounted) {
          map.destroy();
          return;
        }

        mapRef.current = map;
        setIsReady(true);
        setError(null);
        onMapReady?.(map);
      } catch (err) {
        console.error("Failed to initialize MapKit:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load map");
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
      const map = mapRef.current;
      mapRef.current = null;

      const { origin, destination } = markersRef.current;
      markersRef.current = {};

      if (map) {
        try {
          if (routeOverlayRef.current) {
            map.removeOverlay(routeOverlayRef.current as never);
          }
          if (origin?.annotation) {
            map.removeAnnotation(origin.annotation);
          }
          if (destination?.annotation) {
            map.removeAnnotation(destination.annotation);
          }
        } catch {
          // ignore cleanup errors
        } finally {
          try {
            map.destroy();
          } catch {
            // ignore destroy errors
          }
        }
      }

      routeOverlayRef.current = null;
    };
  }, [onMapReady]);

  useEffect(() => {
    if (!isReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    let mapkit: ReturnType<typeof mapKitLoader.getMapKit>;

    try {
      mapkit = mapKitLoader.getMapKit();
    } catch (err) {
      console.error("MapKit loader is not ready:", err);
      return;
    }

    const markers = markersRef.current;

    const updateMarker = (
      role: "origin" | "destination",
      airport: AirportData | null,
      color: string,
    ) => {
      const existing = markers[role];

      if (!airport) {
        if (existing?.annotation) {
          try {
            map.removeAnnotation(existing.annotation);
          } catch {
            // ignore removal errors
          }
        }
        delete markers[role];
        return;
      }

      if (existing?.id === airport.id) {
        if (existing.annotation && "color" in existing.annotation) {
          (existing.annotation as { color?: string }).color = color;
        }
        return;
      }

      if (existing?.annotation) {
        try {
          map.removeAnnotation(existing.annotation);
        } catch {
          // ignore cleanup errors
        }
      }

      const coordinate = new mapkit.Coordinate(
        airport.latitude,
        airport.longitude,
      );

      const annotation = new mapkit.MarkerAnnotation(coordinate, {
        title: airport.name,
        subtitle: `${airport.iata} • ${airport.city}, ${airport.country}`,
        color,
        glyphText: airport.iata.slice(0, 3),
        animates: false,
      });

      annotation.data = airport;

      annotation.addEventListener("select", () => {
        onAirportClick?.(airport);
      });

      map.addAnnotations([annotation]);
      markers[role] = { id: airport.id, annotation };
    };

    updateMarker("origin", originAirport ?? null, "#ef4444");
    updateMarker("destination", destinationAirport ?? null, "#22c55e");

    if (routeOverlayRef.current) {
      try {
        map.removeOverlay(routeOverlayRef.current as never);
      } catch {
        // ignore overlay removal errors
      } finally {
        routeOverlayRef.current = null;
      }
    }

    const activeAnnotations = [
      markers.origin?.annotation ?? null,
      markers.destination?.annotation ?? null,
    ].filter(Boolean) as unknown[];

    if (originAirport && destinationAirport) {
      const overlay = new mapkit.PolylineOverlay(
        [
          new mapkit.Coordinate(
            originAirport.latitude,
            originAirport.longitude,
          ),
          new mapkit.Coordinate(
            destinationAirport.latitude,
            destinationAirport.longitude,
          ),
        ],
        {
          lineCap: "round",
          lineJoin: "round",
          lineWidth: 5,
          strokeColor: "#2563eb",
          opacity: 0.85,
        },
      );

      try {
        map.addOverlay(overlay);
        routeOverlayRef.current = overlay;
      } catch {
        routeOverlayRef.current = null;
      }

      const items = [...activeAnnotations, overlay];

      try {
        map.showItems(items as never, {
          animate: true,
          padding: new mapkit.Padding(
            ROUTE_PADDING,
            ROUTE_PADDING,
            ROUTE_PADDING,
            ROUTE_PADDING,
          ),
        });
      } catch {
        // ignore fit errors
      }

      if (markers.destination?.annotation) {
        map.selectedAnnotation = markers.destination.annotation;
      } else if (markers.origin?.annotation) {
        map.selectedAnnotation = markers.origin.annotation;
      } else {
        map.selectedAnnotation = null;
      }
    } else if (activeAnnotations.length === 1) {
      try {
        map.showItems(activeAnnotations as never, {
          animate: true,
          padding: new mapkit.Padding(
            SINGLE_MARKER_PADDING,
            SINGLE_MARKER_PADDING,
            SINGLE_MARKER_PADDING,
            SINGLE_MARKER_PADDING,
          ),
        });
      } catch {
        const airport = originAirport ?? destinationAirport;
        if (airport) {
          try {
            const region = new mapkit.CoordinateRegion(
              new mapkit.Coordinate(airport.latitude, airport.longitude),
              new mapkit.CoordinateSpan(8, 8),
            );
            map.setRegionAnimated(region, true);
          } catch {
            // ignore region errors
          }
        }
      }

      map.selectedAnnotation =
        markers.origin?.annotation ?? markers.destination?.annotation ?? null;
    } else {
      try {
        const worldRegion = new mapkit.CoordinateRegion(
          new mapkit.Coordinate(WORLD_CENTER.latitude, WORLD_CENTER.longitude),
          new mapkit.CoordinateSpan(
            WORLD_SPAN.latitudeDelta,
            WORLD_SPAN.longitudeDelta,
          ),
        );
        map.setRegionAnimated(worldRegion, false);
      } catch {
        // ignore region reset errors
      }
      map.selectedAnnotation = null;
    }
  }, [destinationAirport, originAirport, onAirportClick, isReady]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/20">
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-destructive">
            Failed to load map
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
            <p className="mt-2 text-sm font-medium">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AirportData } from "@/app/api/airports/route";
import { mapKitLoader } from "@/lib/mapkit-service";

interface AirportMapProps {
  airports: AirportData[];
  originAirport?: AirportData | null;
  destinationAirport?: AirportData | null;
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  onMapReady?: (map: any) => void;
  onAirportClick?: (airport: AirportData) => void;
}

export function AirportMap({
  airports,
  originAirport,
  destinationAirport,
  onMapReady,
  onAirportClick,
}: AirportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  const mapInstanceRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // biome-ignore lint/suspicious/noExplicitAny: MapKit annotation types are loaded at runtime
  const annotationsMapRef = useRef<Map<string, any>>(new Map());
  const routeOverlaysRef = useRef<unknown[]>([]);
  const isInitializingRef = useRef(false);

  const computeGreatCirclePath = useCallback(
    (origin: AirportData, destination: AirportData) => {
      const toRadians = (value: number) => (value * Math.PI) / 180;
      const toDegrees = (value: number) => (value * 180) / Math.PI;
      const normalizeLongitude = (lon: number) =>
        ((lon + 180 + 360) % 360) - 180;

      const lat1 = toRadians(origin.latitude);
      const lon1 = toRadians(origin.longitude);
      const lat2 = toRadians(destination.latitude);
      const lon2 = toRadians(destination.longitude);

      const delta =
        2 *
        Math.asin(
          Math.sqrt(
            Math.sin((lat2 - lat1) / 2) ** 2 +
              Math.cos(lat1) *
                Math.cos(lat2) *
                Math.sin((lon2 - lon1) / 2) ** 2,
          ),
        );

      if (delta === 0 || Number.isNaN(delta)) {
        return [[[origin.latitude, origin.longitude]]];
      }

      const numPoints = Math.max(32, Math.ceil((delta / Math.PI) * 128));
      const sinDelta = Math.sin(delta);

      const interpolatePoint = (fraction: number): [number, number] => {
        const factorA = Math.sin((1 - fraction) * delta) / sinDelta;
        const factorB = Math.sin(fraction * delta) / sinDelta;

        const x =
          factorA * Math.cos(lat1) * Math.cos(lon1) +
          factorB * Math.cos(lat2) * Math.cos(lon2);
        const y =
          factorA * Math.cos(lat1) * Math.sin(lon1) +
          factorB * Math.cos(lat2) * Math.sin(lon2);
        const z = factorA * Math.sin(lat1) + factorB * Math.sin(lat2);

        const interpolatedLat = Math.atan2(z, Math.sqrt(x * x + y * y));
        const interpolatedLon = Math.atan2(y, x);

        return [toDegrees(interpolatedLat), toDegrees(interpolatedLon)];
      };

      const segments: Array<Array<[number, number]>> = [];
      let currentSegment: Array<[number, number]> = [];
      let previousLon: number | null = null;
      let previousFraction = 0;

      for (let i = 0; i <= numPoints; i++) {
        const fraction = i / numPoints;
        const [lat, lonRaw] = interpolatePoint(fraction);
        const lon = normalizeLongitude(lonRaw);

        if (previousLon !== null) {
          const diff = Math.abs(lon - previousLon);

          if (diff > 180) {
            const targetLon = previousLon > 0 ? 180 : -180;

            let low = previousFraction;
            let high = fraction;
            let mid = fraction;
            for (let step = 0; step < 20; step++) {
              mid = (low + high) / 2;
              const [, candidateLonRaw] = interpolatePoint(mid);
              const candidateLon = normalizeLongitude(candidateLonRaw);
              if (
                (targetLon === 180 && candidateLon >= 0) ||
                (targetLon === -180 && candidateLon <= 0)
              ) {
                low = mid;
              } else {
                high = mid;
              }
            }

            const [boundaryLat] = interpolatePoint(mid);
            currentSegment.push([boundaryLat, targetLon]);
            segments.push(currentSegment);

            const wrappedLon = targetLon === 180 ? -180 : 180;
            currentSegment = [[boundaryLat, wrappedLon]];
            previousLon = wrappedLon;
            previousFraction = mid;
          }
        }

        if (currentSegment.length === 0) {
          currentSegment.push([lat, lon]);
        } else {
          currentSegment.push([lat, lon]);
        }
        previousLon = lon;
        previousFraction = fraction;
      }

      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }

      return segments;
    },
    [],
  );

  // Initialize MapKit and create map instance
  // biome-ignore lint/correctness/useExhaustiveDependencies: onMapReady is intentionally not a dependency - only run once on mount
  useEffect(() => {
    if (!mapRef.current || isInitializingRef.current) return;

    isInitializingRef.current = true;

    const initializeMap = async () => {
      try {
        // Load MapKit
        await mapKitLoader.load();

        if (!mapKitLoader.isReady()) {
          throw new Error("MapKit failed to initialize");
        }

        const mapkit = mapKitLoader.getMapKit();
        if (!mapRef.current || mapInstanceRef.current) {
          return;
        }

        // Create map instance
        const map = new mapkit.Map(mapRef.current, {
          center: new mapkit.Coordinate(37.7749, -122.4194), // San Francisco default
          showsMapTypeControl: false,
          showsZoomControl: true,
          showsUserLocationControl: true,
          isRotationEnabled: true,
          showsCompass: mapkit.FeatureVisibility.Adaptive,
          showsScale: mapkit.FeatureVisibility.Adaptive,
          colorScheme: mapkit.Map.ColorSchemes.Light,
        });

        mapInstanceRef.current = map;
        setIsMapReady(true);
        setError(null);
        onMapReady?.(map);
      } catch (err) {
        console.error("Failed to initialize MapKit:", err);
        setError(err instanceof Error ? err.message : "Failed to load map");
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeMap();

    // Cleanup
    return () => {
      const mapInstance = mapInstanceRef.current;
      if (routeOverlaysRef.current.length > 0) {
        for (const overlay of routeOverlaysRef.current) {
          try {
            mapInstance?.removeOverlay(overlay);
          } catch {
            // ignore cleanup errors
          }
        }
      }
      routeOverlaysRef.current = [];

      if (mapInstance) {
        try {
          mapInstance.destroy();
        } catch (err) {
          console.error("Error destroying map:", err);
        }
      }
      mapInstanceRef.current = null;
      annotationsMapRef.current.clear();
      setIsMapReady(false);
      isInitializingRef.current = false;
    };
  }, []);

  // Update annotations when airports change (with diffing)
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;

    const mapkit = mapKitLoader.getMapKit();
    if (!mapkit) return;

    const map = mapInstanceRef.current;
    const currentAnnotations = annotationsMapRef.current;

    // Create a set of current airport IDs
    const newAirportIds = new Set(airports.map((a) => a.id));
    const existingIds = new Set(currentAnnotations.keys());

    // Remove annotations that are no longer in the list
    for (const id of existingIds) {
      if (!newAirportIds.has(id)) {
        const annotation = currentAnnotations.get(id);
        if (annotation) {
          map.removeAnnotation(annotation);
          currentAnnotations.delete(id);
        }
      }
    }

    // Add new annotations
    const airportsToAdd = airports.filter(
      (airport) => !existingIds.has(airport.id),
    );

    if (airportsToAdd.length > 0) {
      const newAnnotations = airportsToAdd.map((airport) => {
        const coordinate = new mapkit.Coordinate(
          airport.latitude,
          airport.longitude,
        );

        const annotation = new mapkit.MarkerAnnotation(coordinate, {
          title: `${airport.name}`,
          subtitle: `${airport.iata} • ${airport.city}, ${airport.country}`,
          color: "#3b82f6", // blue-500
          glyphText: airport.iata.substring(0, 3),
          clusteringIdentifier: "airports",
          data: airport,
        });

        // Add click listener
        annotation.addEventListener("select", () => {
          onAirportClick?.(airport);
        });

        currentAnnotations.set(airport.id, annotation);
        return annotation;
      });

      map.addAnnotations(newAnnotations);
    }

    // Show all airports on map if there are annotations and it's the first load
    if (
      currentAnnotations.size > 0 &&
      airportsToAdd.length === airports.length
    ) {
      const allAnnotations = Array.from(currentAnnotations.values());
      try {
        map.showItems(allAnnotations, {
          animate: true,
          padding: new mapkit.Padding(80, 80, 80, 80),
        });
      } catch (err) {
        console.error("Error showing items:", err);
      }
    }
  }, [airports, isMapReady, onAirportClick]);
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;

    const mapkit = mapKitLoader.getMapKit();
    if (!mapkit) return;

    const map = mapInstanceRef.current;
    const allAnnotations = Array.from(annotationsMapRef.current.values());

    for (const ann of allAnnotations) {
      ann.color = "#3b82f6";
    }

    const originAnnotation = originAirport
      ? annotationsMapRef.current.get(originAirport.id)
      : null;
    const destinationAnnotation = destinationAirport
      ? annotationsMapRef.current.get(destinationAirport.id)
      : null;

    if (originAnnotation) {
      originAnnotation.color = "#ef4444";
      map.selectedAnnotation = originAnnotation;
    }

    if (destinationAnnotation) {
      destinationAnnotation.color = "#22c55e";
      map.selectedAnnotation = destinationAnnotation;
    }

    if (originAirport && !destinationAirport && originAnnotation) {
      const coordinate = new mapkit.Coordinate(
        originAirport.latitude,
        originAirport.longitude,
      );

      const region = new mapkit.CoordinateRegion(
        coordinate,
        new mapkit.CoordinateSpan(0.5, 0.5),
      );

      map.setRegionAnimated(region, true);
    }

    if (destinationAirport && !originAirport && destinationAnnotation) {
      const coordinate = new mapkit.Coordinate(
        destinationAirport.latitude,
        destinationAirport.longitude,
      );

      const region = new mapkit.CoordinateRegion(
        coordinate,
        new mapkit.CoordinateSpan(0.5, 0.5),
      );

      map.setRegionAnimated(region, true);
    }

    if (routeOverlaysRef.current.length > 0) {
      for (const overlay of routeOverlaysRef.current) {
        try {
          map.removeOverlay(overlay);
        } catch {
          // ignore overlay removal errors
        }
      }
      routeOverlaysRef.current = [];
    }

    if (originAirport && destinationAirport) {
      const pathSegments = computeGreatCirclePath(
        originAirport,
        destinationAirport,
      );

      const overlays = pathSegments.map((segment) => {
        const coordinates = segment.map(
          ([latitude, longitude]) => new mapkit.Coordinate(latitude, longitude),
        );

        return new mapkit.PolylineOverlay(coordinates, {
          lineJoin: "round",
          lineCap: "round",
          lineWidth: 6,
          strokeColor: "#2563eb",
          opacity: 0.85,
        });
      });

      const addedOverlays: unknown[] = [];

      for (const overlay of overlays) {
        try {
          map.addOverlay(overlay);
          addedOverlays.push(overlay);
        } catch {
          // ignore overlay errors
        }
      }

      routeOverlaysRef.current = addedOverlays;

      const items = [
        ...(originAnnotation ? [originAnnotation] : []),
        ...(destinationAnnotation ? [destinationAnnotation] : []),
        ...addedOverlays,
      ];

      try {
        map.showItems(items, {
          animate: true,
          padding: new mapkit.Padding(80, 80, 80, 80),
        });
      } catch {
        // ignore fitting errors
      }

      if (
        map.camera &&
        typeof map.camera === "object" &&
        "pitch" in map.camera
      ) {
        try {
          (map.camera as { pitch: number }).pitch = 55;
        } catch {
          // ignore pitch adjustments
        }
      }
    } else {
      map.selectedAnnotation =
        originAnnotation ?? destinationAnnotation ?? null;
    }
  }, [computeGreatCirclePath, destinationAirport, isMapReady, originAirport]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg">
        <div className="text-center p-6">
          <p className="text-sm font-medium text-destructive mb-1">
            Failed to load map
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />
      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-2" />
            <p className="text-sm font-medium">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}

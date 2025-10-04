"use client";

import { useEffect, useRef, useState } from "react";
import type { AirportData } from "@/app/api/airports/route";
import { mapKitLoader } from "@/lib/mapkit-service";

interface AirportMapProps {
  airports: AirportData[];
  selectedAirport?: AirportData | null;
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  onMapReady?: (map: any) => void;
  onAirportClick?: (airport: AirportData) => void;
}

export function AirportMap({
  airports,
  selectedAirport,
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
  const isInitializingRef = useRef(false);

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
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch (err) {
          console.error("Error destroying map:", err);
        }
        mapInstanceRef.current = null;
      }
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

  // Handle selected airport changes
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !selectedAirport) return;

    const mapkit = mapKitLoader.getMapKit();
    if (!mapkit) return;

    const map = mapInstanceRef.current;
    const annotation = annotationsMapRef.current.get(selectedAirport.id);

    if (annotation) {
      // Update annotation color to highlight selection
      const allAnnotations = Array.from(annotationsMapRef.current.values());
      for (const ann of allAnnotations) {
        ann.color = "#3b82f6"; // blue-500 for non-selected
      }
      annotation.color = "#ef4444"; // red-500 for selected

      // Zoom to selected airport
      const coordinate = new mapkit.Coordinate(
        selectedAirport.latitude,
        selectedAirport.longitude,
      );

      const region = new mapkit.CoordinateRegion(
        coordinate,
        new mapkit.CoordinateSpan(0.5, 0.5),
      );

      map.setRegionAnimated(region, true);

      // Select the annotation to show callout
      map.selectedAnnotation = annotation;
    }
  }, [selectedAirport, isMapReady]);

  // Clear selection when selectedAirport is null
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || selectedAirport !== null)
      return;

    const map = mapInstanceRef.current;
    map.selectedAnnotation = null;

    // Reset all colors
    const allAnnotations = Array.from(annotationsMapRef.current.values());
    for (const ann of allAnnotations) {
      ann.color = "#3b82f6"; // blue-500
    }
  }, [selectedAirport, isMapReady]);

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

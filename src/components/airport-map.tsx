"use client";

import { useEffect, useRef, useState } from "react";
import type { AirportData } from "@/app/api/airports/route";

interface WindowWithMapKit extends Window {
  // biome-ignore lint/suspicious/noExplicitAny: MapKit loaded at runtime
  mapkit?: any;
  initMapKit?: () => void;
}

interface AirportMapProps {
  airports: AirportData[];
  selectedAirport?: AirportData | null;
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  onMapReady?: (map: any) => void;
}

export function AirportMap({
  airports,
  selectedAirport,
  onMapReady,
}: AirportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  const mapInstanceRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  // biome-ignore lint/suspicious/noExplicitAny: MapKit annotation types are loaded at runtime
  const annotationsRef = useRef<any[]>([]);

  // Initialize MapKit
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPKIT_TOKEN;
    if (!token) {
      console.error("MapKit token not found");
      return;
    }

    // Load MapKit script
    const script = document.createElement("script");
    script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";
    script.crossOrigin = "anonymous";
    script.dataset.callback = "initMapKit";
    script.dataset.libraries = "map,annotations";
    script.dataset.initialToken = token;

    // Initialize MapKit when script loads
    const windowWithMapKit = window as WindowWithMapKit;
    windowWithMapKit.initMapKit = () => {
      if (!windowWithMapKit.mapkit || mapInstanceRef.current) return;

      windowWithMapKit.mapkit.init({
        // biome-ignore lint/suspicious/noExplicitAny: MapKit callback parameter
        authorizationCallback: (done: any) => {
          done(token);
        },
      });

      // Create map instance
      if (mapRef.current && windowWithMapKit.mapkit) {
        const map = new windowWithMapKit.mapkit.Map(mapRef.current, {
          center: new windowWithMapKit.mapkit.Coordinate(37.7749, -122.4194), // San Francisco default
          showsMapTypeControl: false,
          showsZoomControl: true,
          showsUserLocationControl: true,
          isRotationEnabled: true,
          showsCompass: "adaptive",
          showsScale: "adaptive",
        });

        mapInstanceRef.current = map;
        setIsMapReady(true);
        onMapReady?.(map);
      }
    };

    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      script.remove();
      delete windowWithMapKit.initMapKit;
    };
  }, [onMapReady]);

  // Update annotations when airports change
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !window.mapkit) return;

    const map = mapInstanceRef.current;
    const mapkit = window.mapkit;

    // Remove old annotations
    if (annotationsRef.current.length > 0) {
      map.removeAnnotations(annotationsRef.current);
      annotationsRef.current = [];
    }

    // Add new annotations
    if (airports.length > 0) {
      const newAnnotations = airports.map((airport) => {
        const coordinate = new mapkit.Coordinate(
          airport.latitude,
          airport.longitude,
        );
        const annotation = new mapkit.MarkerAnnotation(coordinate, {
          title: `${airport.name} (${airport.iata})`,
          subtitle: `${airport.city}, ${airport.country}`,
          color: "#007AFF",
          glyphText: airport.iata.substring(0, 3),
          data: airport,
        });
        return annotation;
      });

      annotationsRef.current = newAnnotations;
      map.addAnnotations(newAnnotations);

      // Show all airports on map
      if (newAnnotations.length > 0) {
        map.showItems(newAnnotations, {
          animate: true,
          padding: new mapkit.Padding(60, 60, 60, 60),
        });
      }
    }
  }, [airports, isMapReady]);

  // Handle selected airport
  useEffect(() => {
    if (
      !isMapReady ||
      !mapInstanceRef.current ||
      !window.mapkit ||
      !selectedAirport
    )
      return;

    const map = mapInstanceRef.current;
    const mapkit = window.mapkit;
    const coordinate = new mapkit.Coordinate(
      selectedAirport.latitude,
      selectedAirport.longitude,
    );

    // Zoom to selected airport
    const region = new mapkit.CoordinateRegion(
      coordinate,
      new mapkit.CoordinateSpan(0.5, 0.5), // Appropriate zoom level
    );

    map.setRegionAnimated(region, true);
  }, [selectedAirport, isMapReady]);

  return (
    <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />
  );
}

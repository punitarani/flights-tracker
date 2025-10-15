"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { type MapKitMap, mapKitLoader } from "@/lib/mapkit-service";
import type { AirportData } from "@/server/services/airports";

interface AirportMapProps {
  airports: AirportData[];
  originAirport?: AirportData | null;
  destinationAirport?: AirportData | null;
  showAllAirports: boolean;
  popularRoutes?: AirportMapPopularRoute[];
  activeRouteId?: string | null;
  onRouteHover?: (route: AirportMapPopularRoute | null) => void;
  onRouteSelect?: (route: AirportMapPopularRoute) => void;
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  onMapReady?: (map: any) => void;
  onAirportClick?: (airport: AirportData) => void;
  waypoints?: AirportData[];
}

export type AirportMapPopularRoute = {
  id: string;
  origin: AirportData;
  destination: AirportData;
  distanceMiles?: number;
};

const US_CENTER = { latitude: 39.8283, longitude: -98.5795 };
const US_SPAN = { latitudeDelta: 38, longitudeDelta: 70 };
const WORLD_CENTER = { latitude: 20, longitude: 0 };
const WORLD_SPAN = { latitudeDelta: 160, longitudeDelta: 360 };
const ROUTE_PADDING = 64;
const SINGLE_MARKER_PADDING = 80;
const GREAT_CIRCLE_MIN_SEGMENTS = 24;
const GREAT_CIRCLE_MAX_SEGMENTS = 160;
const GREAT_CIRCLE_EPSILON = 1e-6;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

type Vector3 = [number, number, number];
type LatLng = { latitude: number; longitude: number };

const coordinateToVector = (latitude: number, longitude: number): Vector3 => {
  const latRad = toRadians(latitude);
  const lonRad = toRadians(longitude);
  const cosLat = Math.cos(latRad);

  return [
    cosLat * Math.cos(lonRad),
    cosLat * Math.sin(lonRad),
    Math.sin(latRad),
  ];
};

const interpolateGreatCircle = (
  start: Vector3,
  end: Vector3,
  t: number,
  omega: number,
  sinOmega: number,
): Vector3 => {
  const factorA = Math.sin((1 - t) * omega) / sinOmega;
  const factorB = Math.sin(t * omega) / sinOmega;

  const x = factorA * start[0] + factorB * end[0];
  const y = factorA * start[1] + factorB * end[1];
  const z = factorA * start[2] + factorB * end[2];

  const length = Math.sqrt(x * x + y * y + z * z) || 1;

  return [x / length, y / length, z / length];
};

const vectorToLatLng = (vector: Vector3): LatLng => {
  const [x, y, z] = vector;
  const longitude = Math.atan2(y, x);
  const latitude = Math.atan2(z, Math.sqrt(x * x + y * y));

  return {
    latitude: toDegrees(latitude),
    longitude: toDegrees(longitude),
  };
};

const createGreatCirclePath = (
  origin: AirportData,
  destination: AirportData,
) => {
  const startVector = coordinateToVector(origin.latitude, origin.longitude);
  const endVector = coordinateToVector(
    destination.latitude,
    destination.longitude,
  );

  const dot = Math.max(
    -1,
    Math.min(
      1,
      startVector[0] * endVector[0] +
        startVector[1] * endVector[1] +
        startVector[2] * endVector[2],
    ),
  );

  const omega = Math.acos(dot);

  if (!Number.isFinite(omega) || omega < GREAT_CIRCLE_EPSILON) {
    return [
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ];
  }

  const sinOmega = Math.sin(omega) || GREAT_CIRCLE_EPSILON;
  const normalizedArc = omega / Math.PI;
  const segmentCount = Math.max(
    GREAT_CIRCLE_MIN_SEGMENTS,
    Math.min(
      GREAT_CIRCLE_MAX_SEGMENTS,
      Math.ceil(normalizedArc * GREAT_CIRCLE_MAX_SEGMENTS),
    ),
  );

  const coordinates: LatLng[] = [];

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const point = interpolateGreatCircle(
      startVector,
      endVector,
      t,
      omega,
      sinOmega,
    );
    coordinates.push(vectorToLatLng(point));
  }

  return coordinates;
};

const normalizeLongitude = (longitude: number) => {
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
};

const chooseClosestLongitude = (candidates: number[], reference: number) => {
  let choice = candidates[0];
  let minDiff = Math.abs(candidates[0] - reference);

  for (let index = 1; index < candidates.length; index += 1) {
    const diff = Math.abs(candidates[index] - reference);
    if (diff < minDiff) {
      choice = candidates[index];
      minDiff = diff;
    }
  }

  return choice;
};

const splitPathByAntimeridian = (points: LatLng[]): LatLng[][] => {
  if (points.length === 0) {
    return [];
  }

  const segments: LatLng[][] = [];
  let currentSegment: LatLng[] = [
    {
      latitude: points[0].latitude,
      longitude: normalizeLongitude(points[0].longitude),
    },
  ];

  let previousPoint = points[0];
  let previousUnwrappedLongitude = normalizeLongitude(points[0].longitude);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const normalizedLongitude = normalizeLongitude(point.longitude);
    const candidates = [
      normalizedLongitude,
      normalizedLongitude + 360,
      normalizedLongitude - 360,
    ];
    let adjustedLongitude = chooseClosestLongitude(
      candidates,
      previousUnwrappedLongitude,
    );

    if (adjustedLongitude > 180 || adjustedLongitude < -180) {
      const boundary = adjustedLongitude > 0 ? 180 : -180;
      const denominator = adjustedLongitude - previousUnwrappedLongitude;

      if (Math.abs(denominator) > Number.EPSILON) {
        const rawT = (boundary - previousUnwrappedLongitude) / denominator;
        const clampedT = Math.min(Math.max(rawT, 0), 1);
        const latitudeAtBoundary =
          previousPoint.latitude +
          (point.latitude - previousPoint.latitude) * clampedT;

        currentSegment.push({
          latitude: latitudeAtBoundary,
          longitude: boundary,
        });

        segments.push(currentSegment);

        currentSegment = [
          {
            latitude: latitudeAtBoundary,
            longitude: boundary === 180 ? -180 : 180,
          },
        ];
      } else {
        segments.push(currentSegment);
        currentSegment = [];
      }

      adjustedLongitude =
        adjustedLongitude > 0
          ? adjustedLongitude - 360
          : adjustedLongitude + 360;
    }

    currentSegment.push({
      latitude: point.latitude,
      longitude: normalizeLongitude(adjustedLongitude),
    });

    previousUnwrappedLongitude = adjustedLongitude;
    previousPoint = point;
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
};

const buildGreatCircleSegments = (
  mapkit: ReturnType<typeof mapKitLoader.getMapKit>,
  origin: AirportData,
  destination: AirportData,
) => {
  const points = createGreatCirclePath(origin, destination);
  const segments = splitPathByAntimeridian(points);

  return segments.map((segment) =>
    segment.map(
      (coordinate) =>
        new mapkit.Coordinate(coordinate.latitude, coordinate.longitude),
    ),
  );
};

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
  popularRoutes = [],
  activeRouteId = null,
  onRouteHover,
  onRouteSelect,
  onMapReady,
  onAirportClick,
  waypoints = [],
}: AirportMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapKitMap | null>(null);
  const markersRef = useRef<{
    origin?: AirportMarkerEntry;
    destination?: AirportMarkerEntry;
  }>({});
  const routeOverlayRef = useRef<unknown[] | null>(null);
  const routeOverlaysRef = useRef(
    new Map<string, { overlays: unknown[]; cleanup?: () => void }>(),
  );
  const hoveredRouteIdRef = useRef<string | null>(null);
  const programmaticRegionChangeRef = useRef(false);
  const programmaticRegionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const userViewportOverrideRef = useRef(false);
  const previousOriginIdRef = useRef<string | null>(null);
  const previousDestinationIdRef = useRef<string | null>(null);
  const previousActiveRouteIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  void _airports;
  void _showAllAirports;

  const clearProgrammaticRegionTimeout = useCallback(() => {
    if (programmaticRegionTimeoutRef.current) {
      clearTimeout(programmaticRegionTimeoutRef.current);
      programmaticRegionTimeoutRef.current = null;
    }
  }, []);

  const beginProgrammaticRegionChange = useCallback(() => {
    programmaticRegionChangeRef.current = true;
    clearProgrammaticRegionTimeout();
    programmaticRegionTimeoutRef.current = setTimeout(() => {
      programmaticRegionChangeRef.current = false;
      programmaticRegionTimeoutRef.current = null;
    }, 750);
  }, [clearProgrammaticRegionTimeout]);

  const setUserViewportOverride = useCallback((value: boolean) => {
    userViewportOverrideRef.current = value;
  }, []);

  const markUserViewportOverride = useCallback(() => {
    if (!programmaticRegionChangeRef.current) {
      userViewportOverrideRef.current = true;
    }
  }, []);

  const resetViewportToDefault = useCallback(
    (options: { animate: boolean; lockUserViewport: boolean }) => {
      if (!mapRef.current) {
        return;
      }

      let mapkit: ReturnType<typeof mapKitLoader.getMapKit>;

      try {
        mapkit = mapKitLoader.getMapKit();
      } catch {
        return;
      }

      const { animate, lockUserViewport } = options;

      beginProgrammaticRegionChange();

      try {
        const usRegion = new mapkit.CoordinateRegion(
          new mapkit.Coordinate(US_CENTER.latitude, US_CENTER.longitude),
          new mapkit.CoordinateSpan(
            US_SPAN.latitudeDelta,
            US_SPAN.longitudeDelta,
          ),
        );
        mapRef.current.setRegionAnimated(usRegion, animate);
      } catch {
        try {
          const worldRegion = new mapkit.CoordinateRegion(
            new mapkit.Coordinate(
              WORLD_CENTER.latitude,
              WORLD_CENTER.longitude,
            ),
            new mapkit.CoordinateSpan(
              WORLD_SPAN.latitudeDelta,
              WORLD_SPAN.longitudeDelta,
            ),
          );
          mapRef.current.setRegionAnimated(worldRegion, animate);
        } catch {
          // ignore region reset errors
        }
      }

      setUserViewportOverride(lockUserViewport);
    },
    [beginProgrammaticRegionChange, setUserViewportOverride],
  );

  const applyRouteStyle = useCallback(
    (routeId: string, mode: "default" | "hover" | "active") => {
      const entry = routeOverlaysRef.current.get(routeId);
      if (!entry) {
        return;
      }

      let mapkit: ReturnType<typeof mapKitLoader.getMapKit>;
      try {
        mapkit = mapKitLoader.getMapKit();
      } catch {
        return;
      }

      const StyleCtor = (
        mapkit as unknown as {
          Style: new (options: Record<string, unknown>) => unknown;
        }
      ).Style;

      const styleConfig = {
        lineCap: "round",
        lineJoin: "round",
        lineWidth: 2.1,
        strokeColor: "#0f172a",
        opacity: 0.32,
      } satisfies Record<string, unknown>;

      if (mode === "hover") {
        styleConfig.lineWidth = 3.5;
        styleConfig.strokeColor = "#1d4ed8";
        styleConfig.opacity = 0.78;
      } else if (mode === "active") {
        styleConfig.lineWidth = 4.8;
        styleConfig.strokeColor = "#1e3a8a";
        styleConfig.opacity = 0.94;
      }

      for (const overlay of entry.overlays) {
        (overlay as { style?: unknown }).style = new StyleCtor(styleConfig);
      }
    },
    [],
  );

  const updateHoveredRoute = useCallback(
    (route: AirportMapPopularRoute | null) => {
      const previous = hoveredRouteIdRef.current;

      if (previous && previous !== activeRouteId) {
        applyRouteStyle(previous, "default");
      } else if (previous && previous === activeRouteId) {
        applyRouteStyle(previous, "active");
      }

      if (!route) {
        hoveredRouteIdRef.current = null;
        onRouteHover?.(null);
        return;
      }

      hoveredRouteIdRef.current = route.id;
      applyRouteStyle(
        route.id,
        route.id === activeRouteId ? "active" : "hover",
      );
      onRouteHover?.(route);
    },
    [activeRouteId, applyRouteStyle, onRouteHover],
  );

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
            new mapkit.Coordinate(US_CENTER.latitude, US_CENTER.longitude),
            new mapkit.CoordinateSpan(
              US_SPAN.latitudeDelta,
              US_SPAN.longitudeDelta,
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
        logger.error("Failed to initialize MapKit", { error: err });
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

      const overlayEntries = Array.from(routeOverlaysRef.current.values());

      if (map) {
        try {
          if (routeOverlayRef.current) {
            for (const overlay of routeOverlayRef.current) {
              try {
                map.removeOverlay(overlay as never);
              } catch {
                // ignore overlay cleanup errors
              }
            }
          }
          for (const entry of overlayEntries) {
            entry.cleanup?.();
            for (const overlay of entry.overlays) {
              try {
                map.removeOverlay(overlay as never);
              } catch {
                // ignore overlay cleanup errors
              }
            }
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
      routeOverlaysRef.current.clear();
      clearProgrammaticRegionTimeout();
      programmaticRegionChangeRef.current = false;
    };
  }, [clearProgrammaticRegionTimeout, onMapReady]);

  useEffect(() => {
    if (!isReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;

    const handleRegionChangeStart = () => {
      markUserViewportOverride();
    };

    const handleRegionChangeEnd = () => {
      clearProgrammaticRegionTimeout();
      programmaticRegionChangeRef.current = false;
    };

    const handleScrollEnd = () => {
      markUserViewportOverride();
    };

    const handleSingleTap = (event: unknown) => {
      const tapEvent = event as
        | { overlay?: unknown; annotation?: unknown }
        | undefined
        | null;

      if (tapEvent?.overlay || tapEvent?.annotation) {
        return;
      }

      updateHoveredRoute(null);
      resetViewportToDefault({ animate: true, lockUserViewport: true });

      try {
        map.selectedAnnotation = null;
      } catch {
        // ignore selection reset errors
      }
    };

    map.addEventListener(
      "region-change-start",
      handleRegionChangeStart as never,
    );
    map.addEventListener("region-change-end", handleRegionChangeEnd as never);
    map.addEventListener("scroll-end", handleScrollEnd as never);
    map.addEventListener("zoom-end", handleScrollEnd as never);
    map.addEventListener("single-tap", handleSingleTap as never);

    return () => {
      map.removeEventListener(
        "region-change-start",
        handleRegionChangeStart as never,
      );
      map.removeEventListener(
        "region-change-end",
        handleRegionChangeEnd as never,
      );
      map.removeEventListener("scroll-end", handleScrollEnd as never);
      map.removeEventListener("zoom-end", handleScrollEnd as never);
      map.removeEventListener("single-tap", handleSingleTap as never);
    };
  }, [
    clearProgrammaticRegionTimeout,
    isReady,
    markUserViewportOverride,
    resetViewportToDefault,
    updateHoveredRoute,
  ]);

  useEffect(() => {
    if (!isReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    let mapkit: ReturnType<typeof mapKitLoader.getMapKit>;

    try {
      mapkit = mapKitLoader.getMapKit();
    } catch (err) {
      logger.error("MapKit loader is not ready", {
        context: "marker-initialization",
        error: err,
      });
      return;
    }

    const markers = markersRef.current;

    const currentOriginId = originAirport?.id ?? null;
    if (previousOriginIdRef.current !== currentOriginId) {
      previousOriginIdRef.current = currentOriginId;
      setUserViewportOverride(false);
    }

    const currentDestinationId = destinationAirport?.id ?? null;
    if (previousDestinationIdRef.current !== currentDestinationId) {
      previousDestinationIdRef.current = currentDestinationId;
      setUserViewportOverride(false);
    }

    const currentActiveRouteId = activeRouteId ?? null;
    if (previousActiveRouteIdRef.current !== currentActiveRouteId) {
      previousActiveRouteIdRef.current = currentActiveRouteId;
      setUserViewportOverride(false);
    }

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
      for (const overlay of routeOverlayRef.current) {
        try {
          map.removeOverlay(overlay as never);
        } catch {
          // ignore overlay removal errors
        }
      }
      routeOverlayRef.current = null;
    }

    const activeAnnotations = [
      markers.origin?.annotation ?? null,
      markers.destination?.annotation ?? null,
    ].filter(Boolean) as unknown[];

    const activePopularRouteEntry = activeRouteId
      ? routeOverlaysRef.current.get(activeRouteId)
      : undefined;

    if (activeRouteId && activePopularRouteEntry) {
      applyRouteStyle(activeRouteId, "active");
    }

    const shouldRenderDedicatedOverlay = Boolean(
      originAirport && destinationAirport && !activePopularRouteEntry,
    );

    if (shouldRenderDedicatedOverlay && originAirport && destinationAirport) {
      const overlaysForRoute: unknown[] = [];

      // Build route segments including waypoints
      const routePoints =
        waypoints.length > 0
          ? [originAirport, ...waypoints, destinationAirport]
          : [originAirport, destinationAirport];

      for (let i = 0; i < routePoints.length - 1; i++) {
        const segmentOrigin = routePoints[i];
        const segmentDestination = routePoints[i + 1];

        const segments = buildGreatCircleSegments(
          mapkit,
          segmentOrigin,
          segmentDestination,
        );

        for (const coordinates of segments) {
          if (coordinates.length < 2) {
            continue;
          }

          const overlay = new mapkit.PolylineOverlay(coordinates, {
            lineCap: "round",
            lineJoin: "round",
            lineWidth: 4.6,
            strokeColor: "#1e3a8a",
            opacity: 0.9,
          });

          try {
            map.addOverlay(overlay);
            overlaysForRoute.push(overlay);
          } catch {
            try {
              map.removeOverlay(overlay as never);
            } catch {
              // ignore overlay cleanup errors
            }
            for (const added of overlaysForRoute) {
              try {
                map.removeOverlay(added as never);
              } catch {
                // ignore overlay cleanup errors
              }
            }
            overlaysForRoute.length = 0;
            break;
          }
        }

        if (overlaysForRoute.length === 0) {
          break; // Stop processing if we hit an error
        }
      }

      routeOverlayRef.current = overlaysForRoute.length
        ? overlaysForRoute
        : null;
    }

    const overlaysForSelection =
      activePopularRouteEntry?.overlays ?? routeOverlayRef.current ?? [];

    const focusOnAirport = (airport: AirportData, animate: boolean) => {
      beginProgrammaticRegionChange();
      try {
        const region = new mapkit.CoordinateRegion(
          new mapkit.Coordinate(airport.latitude, airport.longitude),
          new mapkit.CoordinateSpan(8, 8),
        );
        map.setRegionAnimated(region, animate);
      } catch {
        // ignore region errors
      }
    };

    const showItemsWithPadding = (items: unknown[], padding: number) => {
      if (!items.length) {
        return;
      }

      beginProgrammaticRegionChange();
      try {
        map.showItems(items as never, {
          animate: true,
          padding: new mapkit.Padding(padding, padding, padding, padding),
        });
      } catch {
        const fallbackAirport = originAirport ?? destinationAirport;
        if (fallbackAirport) {
          focusOnAirport(fallbackAirport, true);
        } else {
          resetViewportToDefault({ animate: true, lockUserViewport: false });
        }
      }
    };

    const hasBothAirports = Boolean(originAirport && destinationAirport);
    const hasSingleAnnotation = activeAnnotations.length === 1;

    if (hasBothAirports) {
      if (!userViewportOverrideRef.current) {
        const items = overlaysForSelection.length
          ? [...activeAnnotations, ...overlaysForSelection]
          : activeAnnotations;

        if (items.length) {
          showItemsWithPadding(items, ROUTE_PADDING);
        }
      }

      if (markers.destination?.annotation) {
        map.selectedAnnotation = markers.destination.annotation;
      } else if (markers.origin?.annotation) {
        map.selectedAnnotation = markers.origin.annotation;
      } else {
        map.selectedAnnotation = null;
      }
    } else if (hasSingleAnnotation) {
      if (!userViewportOverrideRef.current) {
        showItemsWithPadding(activeAnnotations, SINGLE_MARKER_PADDING);
      }

      map.selectedAnnotation =
        markers.origin?.annotation ?? markers.destination?.annotation ?? null;
    } else {
      if (!userViewportOverrideRef.current) {
        resetViewportToDefault({ animate: false, lockUserViewport: false });
      }
      map.selectedAnnotation = null;
    }
  }, [
    destinationAirport,
    originAirport,
    waypoints,
    onAirportClick,
    isReady,
    activeRouteId,
    applyRouteStyle,
    beginProgrammaticRegionChange,
    resetViewportToDefault,
    setUserViewportOverride,
  ]);

  useEffect(() => {
    if (!isReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    let mapkit: ReturnType<typeof mapKitLoader.getMapKit>;

    try {
      mapkit = mapKitLoader.getMapKit();
    } catch (err) {
      logger.error("MapKit loader is not ready", {
        context: "route-rendering",
        error: err,
      });
      return;
    }

    const overlays = routeOverlaysRef.current;
    const nextRoutes = popularRoutes ?? [];
    const nextIds = new Set(nextRoutes.map((route) => route.id));

    for (const [id, entry] of overlays) {
      if (!nextIds.has(id)) {
        entry.cleanup?.();
        for (const overlay of entry.overlays) {
          try {
            map.removeOverlay(overlay as never);
          } catch {
            // ignore removal errors
          }
        }
        overlays.delete(id);
      }
    }

    if (nextRoutes.length === 0) {
      if (hoveredRouteIdRef.current) {
        hoveredRouteIdRef.current = null;
        onRouteHover?.(null);
      }
      return;
    }

    const getOverlayStyleMode = (
      routeId: string,
    ): "default" | "hover" | "active" => {
      if (routeId === activeRouteId) {
        return "active";
      }
      if (routeId === hoveredRouteIdRef.current) {
        return "hover";
      }
      return "default";
    };

    nextRoutes.forEach((route) => {
      const existing = overlays.get(route.id);
      if (existing) {
        for (const overlay of existing.overlays) {
          (overlay as { data?: unknown }).data = {
            type: "popularRoute",
            route,
          };
        }
        applyRouteStyle(route.id, getOverlayStyleMode(route.id));
        return;
      }

      const handleMouseEnter = () => {
        updateHoveredRoute(route);
      };

      const handleMouseLeave = () => {
        if (hoveredRouteIdRef.current === route.id) {
          updateHoveredRoute(null);
        }
      };

      const handleSelect = () => {
        updateHoveredRoute(route);
        onRouteSelect?.(route);
      };

      const segments = buildGreatCircleSegments(
        mapkit,
        route.origin,
        route.destination,
      );

      const overlaysForRoute: unknown[] = [];
      const cleanupCallbacks: Array<() => void> = [];

      for (const coordinates of segments) {
        if (coordinates.length < 2) {
          continue;
        }

        const overlay = new mapkit.PolylineOverlay(coordinates, {
          lineCap: "round",
          lineJoin: "round",
          lineWidth: 2.1,
          strokeColor: "#0f172a",
          opacity: 0.32,
        }) as unknown;

        const overlayWithMeta = overlay as {
          data?: unknown;
          addEventListener?: (
            type: string,
            listener: (...args: unknown[]) => void,
          ) => void;
          removeEventListener?: (
            type: string,
            listener: (...args: unknown[]) => void,
          ) => void;
        };

        overlayWithMeta.data = { type: "popularRoute", route };

        overlayWithMeta.addEventListener?.("mouseenter", handleMouseEnter);
        overlayWithMeta.addEventListener?.("mouseleave", handleMouseLeave);
        overlayWithMeta.addEventListener?.("select", handleSelect);

        const cleanupOverlay = () => {
          overlayWithMeta.removeEventListener?.("mouseenter", handleMouseEnter);
          overlayWithMeta.removeEventListener?.("mouseleave", handleMouseLeave);
          overlayWithMeta.removeEventListener?.("select", handleSelect);
        };

        try {
          map.addOverlay(overlayWithMeta as never);
          overlaysForRoute.push(overlayWithMeta);
          cleanupCallbacks.push(cleanupOverlay);
        } catch {
          cleanupOverlay();
          try {
            map.removeOverlay(overlayWithMeta as never);
          } catch {
            // ignore overlay cleanup errors
          }
          for (const added of overlaysForRoute) {
            try {
              map.removeOverlay(added as never);
            } catch {
              // ignore overlay cleanup errors
            }
          }
          overlaysForRoute.length = 0;
          cleanupCallbacks.length = 0;
          break;
        }
      }

      if (!overlaysForRoute.length) {
        return;
      }

      overlays.set(route.id, {
        overlays: overlaysForRoute,
        cleanup: () => {
          for (const cleanup of cleanupCallbacks) {
            cleanup();
          }
        },
      });

      applyRouteStyle(route.id, getOverlayStyleMode(route.id));
    });
  }, [
    activeRouteId,
    applyRouteStyle,
    isReady,
    onRouteHover,
    onRouteSelect,
    popularRoutes,
    updateHoveredRoute,
  ]);

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

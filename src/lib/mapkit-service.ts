"use client";

import { env } from "@/env";

type MapKitLibrary = "map" | "annotations";

type MapKitAuthorizationCallback = (done: (token: string) => void) => void;

type MapKitCoordinate = unknown;

interface MapKitBaseAnnotation {
  addEventListener: (event: string, handler: () => void) => void;
  color?: string;
  [key: string]: unknown;
}

interface MapKitAnnotationConstructor {
  new (
    coordinate: MapKitCoordinate,
    factory?: (
      coordinate: MapKitCoordinate,
      options: Record<string, unknown>,
    ) => MapKitBaseAnnotation | HTMLElement,
    options?: Record<string, unknown>,
  ): MapKitBaseAnnotation;
}

interface MapKitMarkerAnnotation extends MapKitBaseAnnotation {}

interface MapKitMarkerAnnotationConstructor {
  new (
    coordinate: MapKitCoordinate,
    options?: Record<string, unknown>,
  ): MapKitMarkerAnnotation;
}

type MapKitOverlay = unknown;

interface MapKitPolylineOverlayConstructor {
  new (
    coordinates: MapKitCoordinate[],
    options?: Record<string, unknown>,
  ): MapKitOverlay;
}
export interface MapKitMap {
  destroy: () => void;
  addAnnotations: (annotations: MapKitBaseAnnotation[]) => void;
  removeAnnotation: (annotation: MapKitBaseAnnotation) => void;
  removeAnnotations?: (annotations: MapKitBaseAnnotation[]) => void;
  addOverlay: (overlay: MapKitOverlay) => void;
  removeOverlay: (overlay: MapKitOverlay) => void;
  showItems: (
    annotations: Array<MapKitBaseAnnotation | MapKitOverlay>,
    options?: { animate?: boolean; padding?: unknown },
  ) => void;
  setRegionAnimated: (region: unknown, animated?: boolean) => void;
  selectedAnnotation: MapKitBaseAnnotation | null;
  camera?: unknown;
  region: {
    center: { latitude: number; longitude: number };
    span: { latitudeDelta: number; longitudeDelta: number };
  } | null;
  center: { latitude: number; longitude: number };
  addEventListener: (
    type: string,
    listener: (...args: unknown[]) => void,
    thisObject?: unknown,
  ) => void;
  removeEventListener: (
    type: string,
    listener: (...args: unknown[]) => void,
    thisObject?: unknown,
  ) => void;
}

interface MapKitMapConstructor {
  new (element: HTMLElement, options?: Record<string, unknown>): MapKitMap;
  ColorSchemes: Record<string, unknown>;
}

interface MapKitConstructor<TArgs extends unknown[], TResult> {
  new (...args: TArgs): TResult;
}

interface MapKitFeatureVisibility {
  Adaptive: unknown;
  [key: string]: unknown;
}

interface MapKit {
  init(options: { authorizationCallback: MapKitAuthorizationCallback }): void;
  importLibrary?: (name: MapKitLibrary) => Promise<void>;
  loadedLibraries?: MapKitLibrary[];
  Map: MapKitMapConstructor;
  Annotation: MapKitAnnotationConstructor;
  Coordinate: MapKitConstructor<[number, number], MapKitCoordinate>;
  FeatureVisibility: MapKitFeatureVisibility;
  MarkerAnnotation: MapKitMarkerAnnotationConstructor;
  Padding: MapKitConstructor<[number, number, number, number], unknown>;
  CoordinateRegion: MapKitConstructor<[unknown, unknown], unknown>;
  CoordinateSpan: MapKitConstructor<[number, number], unknown>;
  PolylineOverlay: MapKitPolylineOverlayConstructor;
}

declare global {
  interface Window {
    mapkit?: MapKit;
    initMapKit?: () => void;
  }
}

const MAPKIT_SCRIPT_URL =
  "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";
const REQUIRED_LIBRARIES: MapKitLibrary[] = ["map", "annotations"];
const SCRIPT_SELECTOR = "script[data-mapkit-loader='true']";

class MapKitLoader {
  private mapkit: MapKit | null = null;
  private isInitialized = false;
  private initCalled = false;
  private librariesLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners: Array<() => void> = [];

  async load(): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("MapKit can only be loaded in the browser");
    }

    if (this.isInitialized && this.mapkit) {
      return Promise.resolve();
    }

    if (!this.loadPromise) {
      this.loadPromise = this.initialize();
    }

    try {
      await this.loadPromise;
      this.notifyListeners();
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  getMapKit(): MapKit {
    if (!this.mapkit) {
      throw new Error("MapKit has not been initialized yet");
    }
    return this.mapkit;
  }

  isReady(): boolean {
    return this.isInitialized && this.mapkit !== null;
  }

  onReady(callback: () => void): () => void {
    if (this.isReady()) {
      callback();
      return () => {};
    }

    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback,
      );
    };
  }

  private async initialize(): Promise<void> {
    await this.ensureScriptLoaded();

    const { mapkit } = window;
    if (!mapkit) {
      throw new Error("MapKit failed to load");
    }

    this.mapkit = mapkit;

    if (!this.initCalled) {
      try {
        mapkit.init({
          authorizationCallback: (done) => {
            done(env.NEXT_PUBLIC_MAPKIT_TOKEN);
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("already initialized")) {
          throw error as Error;
        }
      }
      this.initCalled = true;
    }

    await this.ensureLibraries(mapkit);

    this.isInitialized = true;
  }

  private ensureScriptLoaded(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if MapKit is already loaded
      if (
        window.mapkit?.loadedLibraries &&
        window.mapkit.loadedLibraries.length > 0
      ) {
        resolve();
        return;
      }

      let script = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);

      if (script) {
        if (script.dataset.mapkitLoaded === "true") {
          resolve();
          return;
        }

        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener(
          "error",
          () => reject(new Error("Failed to load MapKit JS")),
          { once: true },
        );
        return;
      }

      // Setup the global callback first
      window.initMapKit = () => {
        resolve();
        delete window.initMapKit;
      };

      script = document.createElement("script");
      script.src = MAPKIT_SCRIPT_URL;
      script.crossOrigin = "anonymous";
      script.async = true;
      script.dataset.mapkitLoader = "true";
      script.dataset.callback = "initMapKit";
      script.dataset.libraries = REQUIRED_LIBRARIES.join(",");
      script.dataset.token = env.NEXT_PUBLIC_MAPKIT_TOKEN;

      script.addEventListener(
        "error",
        () => {
          delete window.initMapKit;
          reject(new Error("Failed to load MapKit JS"));
        },
        { once: true },
      );

      document.head.appendChild(script);
    });
  }

  private async ensureLibraries(mapkit: MapKit): Promise<void> {
    if (this.librariesLoaded) {
      return;
    }

    const importLibrary = mapkit.importLibrary;

    if (typeof importLibrary === "function") {
      await Promise.all(
        REQUIRED_LIBRARIES.map((library) =>
          importLibrary.call(mapkit, library),
        ),
      );
      this.librariesLoaded = true;
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const check = () => {
        const hasMap = typeof mapkit.Map === "function";
        const hasAnnotations = typeof mapkit.MarkerAnnotation === "function";

        if (hasMap && hasAnnotations) {
          this.librariesLoaded = true;
          resolve();
          return;
        }

        if (Date.now() - start > 10000) {
          reject(new Error("Timed out loading MapKit libraries"));
          return;
        }

        window.setTimeout(check, 50);
      };

      check();
    });
  }

  private notifyListeners(): void {
    if (!this.listeners.length) {
      return;
    }

    for (const listener of this.listeners) {
      listener();
    }

    this.listeners = [];
  }
}

export const mapKitLoader = new MapKitLoader();

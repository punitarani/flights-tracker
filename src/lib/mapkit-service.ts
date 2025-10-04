"use client";

import { env } from "@/env";

type MapKitLibrary = "map" | "annotations";

const MAPKIT_SCRIPT_URL = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
const REQUIRED_LIBRARIES: MapKitLibrary[] = ["map", "annotations"];
const SCRIPT_SELECTOR = "script[data-mapkit-loader='true']";

class MapKitLoader {
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  private mapkit: any = null;
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

  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  getMapKit(): any {
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
          // biome-ignore lint/suspicious/noExplicitAny: MapKit callback parameter
          authorizationCallback: (done: any) => {
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

      script = document.createElement("script");
      script.src = MAPKIT_SCRIPT_URL;
      script.crossOrigin = "anonymous";
      script.dataset.mapkitLoader = "true";

      script.addEventListener(
        "load",
        () => {
          script?.setAttribute("data-mapkit-loaded", "true");
          resolve();
        },
        { once: true },
      );

      script.addEventListener(
        "error",
        () => reject(new Error("Failed to load MapKit JS")),
        { once: true },
      );

      document.head.appendChild(script);
    });
  }

  private async ensureLibraries(mapkit: typeof window.mapkit): Promise<void> {
    if (this.librariesLoaded) {
      return;
    }

    if (typeof mapkit.importLibrary === "function") {
      await Promise.all(
        REQUIRED_LIBRARIES.map((library) => mapkit.importLibrary(library)),
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

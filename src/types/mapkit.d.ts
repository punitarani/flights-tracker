// Apple MapKit JS TypeScript definitions
declare global {
  interface Window {
    mapkit?: typeof mapkit;
  }
}

declare namespace mapkit {
  function init(options: InitOptions): void;

  interface InitOptions {
    authorizationCallback: (done: (token: string) => void) => void;
    language?: string;
  }

  // biome-ignore lint/suspicious/noShadowRestrictedNames: MapKit uses Map as class name
  class Map {
    constructor(element: HTMLElement | string, options?: MapConstructorOptions);
    element: HTMLElement;
    center: Coordinate;
    region: CoordinateRegion;
    rotation: number;
    tintColor: string;
    colorScheme: string;
    mapType: string;
    padding: Padding;
    showsCompass: string;
    showsMapTypeControl: boolean;
    showsZoomControl: boolean;
    showsUserLocationControl: boolean;
    showsPointsOfInterest: boolean;
    showsScale: string;
    isRotationEnabled: boolean;
    isScrollEnabled: boolean;
    isZoomEnabled: boolean;

    addAnnotation(annotation: Annotation): Annotation;
    addAnnotations(annotations: Annotation[]): Annotation[];
    removeAnnotation(annotation: Annotation): Annotation;
    removeAnnotations(annotations: Annotation[]): Annotation[];
    showItems(items: Annotation[], options?: MapShowItemsOptions): void;
    setCenterAnimated(coordinate: Coordinate, animate?: boolean): void;
    setRegionAnimated(region: CoordinateRegion, animate?: boolean): void;
    destroy(): void;
    addEventListener(
      type: string,
      listener: EventListener,
      thisObject?: unknown,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListener,
      thisObject?: unknown,
    ): void;
  }

  interface MapConstructorOptions {
    center?: Coordinate;
    region?: CoordinateRegion;
    rotation?: number;
    tintColor?: string;
    colorScheme?: string;
    mapType?: string;
    padding?: Padding;
    showsMapTypeControl?: boolean;
    showsZoomControl?: boolean;
    showsUserLocationControl?: boolean;
    showsCompass?: string;
    showsScale?: string;
    isRotationEnabled?: boolean;
    isScrollEnabled?: boolean;
    isZoomEnabled?: boolean;
    showsPointsOfInterest?: boolean;
  }

  interface MapShowItemsOptions {
    animate?: boolean;
    padding?: Padding;
    minimumSpan?: CoordinateSpan;
  }

  class Coordinate {
    constructor(latitude: number, longitude: number);
    latitude: number;
    longitude: number;
  }

  class CoordinateRegion {
    constructor(center: Coordinate, span: CoordinateSpan);
    center: Coordinate;
    span: CoordinateSpan;
  }

  class CoordinateSpan {
    constructor(latitudeDelta: number, longitudeDelta: number);
    latitudeDelta: number;
    longitudeDelta: number;
  }

  class Padding {
    constructor(top?: number, right?: number, bottom?: number, left?: number);
    top: number;
    right: number;
    bottom: number;
    left: number;
  }

  class Annotation {
    constructor(
      coordinate: Coordinate,
      factory?: (
        coordinate: Coordinate,
        options: AnnotationOptions,
      ) => Annotation,
      options?: AnnotationOptions,
    );
    coordinate: Coordinate;
    data: unknown;
    title: string;
    subtitle: string;
    selected: boolean;
    enabled: boolean;
    visible: boolean;
    animates: boolean;
    appearanceAnimation: string;
    displayPriority: number;
    collisionMode: string;
    anchorOffset: DOMPoint;
    clusteringIdentifier: string;

    addEventListener(
      type: string,
      listener: EventListener,
      thisObject?: unknown,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListener,
      thisObject?: unknown,
    ): void;
  }

  interface AnnotationOptions {
    data?: unknown;
    title?: string;
    subtitle?: string;
    selected?: boolean;
    enabled?: boolean;
    visible?: boolean;
    animates?: boolean;
    appearanceAnimation?: string;
    displayPriority?: number;
    collisionMode?: string;
    anchorOffset?: DOMPoint;
    clusteringIdentifier?: string;
    color?: string;
    glyphColor?: string;
    glyphText?: string;
    glyphImage?: string;
    selectedGlyphImage?: string;
  }

  class MarkerAnnotation extends Annotation {
    constructor(coordinate: Coordinate, options?: MarkerAnnotationOptions);
    color: string;
    glyphColor: string;
    glyphText: string;
    glyphImage: { 1: string; 2: string; 3: string };
    selectedGlyphImage: { 1: string; 2: string; 3: string };
  }

  interface MarkerAnnotationOptions extends AnnotationOptions {
    color?: string;
    glyphColor?: string;
    glyphText?: string;
    glyphImage?: string | { 1: string; 2?: string; 3?: string };
    selectedGlyphImage?: string | { 1: string; 2?: string; 3?: string };
  }
}

export {};

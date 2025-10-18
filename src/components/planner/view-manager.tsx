"use client";

import type { PageView } from "@/server/schemas/planner-view";
import type { AirportData } from "@/server/services/airports";
import { ComparisonViewComponent } from "./views/comparison-view";
import { MapViewComponent } from "./views/map-view";
import { SearchViewComponent } from "./views/search-view";

interface ViewManagerProps {
  currentView: PageView;
  airports: AirportData[];
}

/**
 * View Manager
 * Renders the appropriate view component based on the current page view schema
 */
export function ViewManager({ currentView, airports }: ViewManagerProps) {
  switch (currentView.mode) {
    case "map":
      return <MapViewComponent view={currentView} airports={airports} />;

    case "search":
      return <SearchViewComponent view={currentView} />;

    case "comparison":
      return <ComparisonViewComponent view={currentView} />;

    default:
      // Fallback to map with popular routes
      return (
        <MapViewComponent
          view={{ mode: "map", view: "popular" }}
          airports={airports}
        />
      );
  }
}

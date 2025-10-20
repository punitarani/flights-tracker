import type { AirportData } from "@/server/services/airports";
import type { PlannerScene } from "../types";
import { MapScene } from "./map-scene";
import { SearchScene } from "./search-scene";

interface SceneViewProps {
  scene: PlannerScene;
  airports?: AirportData[];
  isLoadingAirports?: boolean;
}

export function SceneView({
  scene,
  airports = [],
  isLoadingAirports = false,
}: SceneViewProps) {
  if (scene.view === "map") {
    return <MapScene scene={scene} />;
  }

  if (scene.view === "search") {
    return (
      <SearchScene
        scene={scene}
        airports={airports}
        isLoadingAirports={isLoadingAirports}
      />
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p>Unknown scene type</p>
    </div>
  );
}

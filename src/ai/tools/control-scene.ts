import { tool } from "ai";
import {
  type ControlSceneParams,
  ControlSceneParamsSchema,
  PlannerMapSceneSchema,
  PlannerSearchSceneSchema,
} from "../types";

/**
 * Control Scene Tool
 *
 * Changes what the user sees in the UI:
 * - Map view (popular routes)
 * - Map view (specific airport routes)
 * - Search results view (with flight filters)
 *
 * IMPORTANT:
 * - Always use 3-letter IATA codes for airports (SFO, JFK, LAX)
 * - Scene changes are immediate and replace current view
 * - Use strategically to guide the user experience
 */
export const controlSceneTool = tool({
  description: `Control what the user sees in the interface. Switch between different views based on conversation context.

Available Views:

1. MAP - POPULAR MODE
   Show popular flight routes and destinations
   Use when: User is exploring, needs inspiration, or conversation is just starting
   
2. MAP - ROUTES MODE  
   Show routes between specific airports on a map
   Use when: Showing connections or comparing airport options
   Requires: Array of airport codes to visualize
   
3. SEARCH VIEW
   Show flight search results with filters
   Use when: User has specific travel criteria and you're showing concrete options
   Requires: Origin, destination, date range, and travel date

Strategy Tips:
- Start with map view for exploration
- Switch to search view when showing specific flights
- Use routes mode to explain multi-city connections
- Always use 3-letter airport codes (SFO, JFK, LAX)

Examples:
- "Show me flights to Hawaii" → Map routes mode with HI airports
- "I want to fly from SF to NYC on Dec 15" → Search view with filters
- "What are popular destinations?" → Map popular mode`,

  inputSchema: ControlSceneParamsSchema,

  execute: async (params: ControlSceneParams) => {
    try {
      if (params.view === "map") {
        if (params.mode === "popular") {
          // Popular routes map view
          const scene = {
            view: "map" as const,
            mode: "popular" as const,
            data: null,
          };

          // Validate with Zod schema
          PlannerMapSceneSchema.parse(scene);

          return {
            success: true,
            message: "Displaying popular flight routes map",
            scene,
          };
        }

        // Routes mode - specific airports
        if (!params.airports || params.airports.length === 0) {
          return {
            success: false,
            message: "Routes mode requires at least one airport code",
          };
        }

        const scene = {
          view: "map" as const,
          mode: "routes" as const,
          data: {
            airports: params.airports,
          },
        };

        // Validate with Zod schema
        PlannerMapSceneSchema.parse(scene);

        return {
          success: true,
          message: `Displaying routes for airports: ${params.airports.join(", ")}`,
          scene,
        };
      }

      // Search view
      const scene = {
        view: "search" as const,
        mode: "flights" as const,
        data: {
          origin: params.origin,
          destination: params.destination,
          startDate: params.startDate,
          endDate: params.endDate,
          travelDate: params.travelDate,
        },
      };

      // Validate with Zod schema
      PlannerSearchSceneSchema.parse(scene);

      return {
        success: true,
        message: `Displaying search filters: ${params.origin.join(", ")} → ${params.destination.join(", ")}`,
        scene,
      };
    } catch (error) {
      return {
        success: false,
        message: `Scene control failed: ${(error as Error).message}`,
      };
    }
  },
});

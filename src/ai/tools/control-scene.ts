import { tool } from "ai";
import { addYears, isAfter, isBefore, parseISO, startOfToday } from "date-fns";
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
   Set: view="map", mode="popular"
   Use when: User is exploring, needs inspiration, or conversation is just starting

2. MAP - ROUTES MODE
   Set: view="map", mode="routes", airports=["SFO", "LAX", ...]
   Use when: Showing connections between specific airports
   Requires: airports array with 3-letter codes

3. SEARCH VIEW
   Set: view="search", origin=["SFO"], destination=["JFK"], startDate, endDate
   Use when: User has specific travel criteria and you're showing flight search interface
   Required: origin, destination, startDate, endDate (YYYY-MM-DD format)
   Optional: travelDate (specific date within range), filters (seatType, maxStops, airlines, etc.)
   Date Range: Must be from today to 1 year from now

Strategy Tips:
- Start with map popular mode for exploration
- Switch to search view when showing specific flights
- Use map routes mode to explain multi-city connections
- Always use 3-letter airport codes (SFO, JFK, LAX)
- Dates: YYYY-MM-DD format, within next year
- Search view works like main search page - provide date range, user can select specific dates

Examples:
- "Show me flights to Hawaii" → view="map", mode="routes", airports=["SFO","HNL","OGG"]
- "Find SFO to NYC in December" → view="search", origin=["SFO"], destination=["JFK"], startDate="2025-12-01", endDate="2025-12-31"
- "What are popular destinations?" → view="map", mode="popular"`,

  inputSchema: ControlSceneParamsSchema,

  execute: async (params: ControlSceneParams) => {
    try {
      if (params.view === "map") {
        const mode = params.mode ?? "popular";

        if (mode === "popular") {
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
            message:
              "Routes mode requires at least one airport code. Please provide airports to display on the map.",
          };
        }

        // Validate airport codes are 3 letters
        const invalidCodes = params.airports.filter(
          (code) => code.length !== 3,
        );
        if (invalidCodes.length > 0) {
          return {
            success: false,
            message: `Invalid airport codes: ${invalidCodes.join(", ")}. All airport codes must be exactly 3 letters (e.g., SFO, JFK).`,
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
        try {
          PlannerMapSceneSchema.parse(scene);
        } catch (error) {
          return {
            success: false,
            message: `Invalid map scene configuration: ${(error as Error).message}`,
          };
        }

        return {
          success: true,
          message: `Displaying routes between: ${params.airports.join(" → ")}`,
          scene,
        };
      }

      // Search view - validate required fields
      if (
        !params.origin ||
        !params.destination ||
        !params.startDate ||
        !params.endDate
      ) {
        const missing = [];
        if (!params.origin) missing.push("origin airports");
        if (!params.destination) missing.push("destination airports");
        if (!params.startDate) missing.push("start date");
        if (!params.endDate) missing.push("end date");

        return {
          success: false,
          message: `Search view requires: ${missing.join(", ")}. Provide origin, destination, and date range (startDate/endDate).`,
        };
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const invalidDates = [];
      if (!dateRegex.test(params.startDate))
        invalidDates.push(`startDate: ${params.startDate}`);
      if (!dateRegex.test(params.endDate))
        invalidDates.push(`endDate: ${params.endDate}`);
      if (params.travelDate && !dateRegex.test(params.travelDate))
        invalidDates.push(`travelDate: ${params.travelDate}`);

      if (invalidDates.length > 0) {
        return {
          success: false,
          message: `Invalid date format: ${invalidDates.join(", ")}. Use YYYY-MM-DD format (e.g., 2025-12-15).`,
        };
      }

      // Validate date ranges (today to 1 year from now)
      const today = startOfToday();
      const oneYearFromNow = addYears(today, 1);

      try {
        const startDate = parseISO(params.startDate);
        const endDate = parseISO(params.endDate);

        // Check if dates are valid
        if (
          Number.isNaN(startDate.getTime()) ||
          Number.isNaN(endDate.getTime())
        ) {
          return {
            success: false,
            message:
              "Invalid dates provided. Please use valid dates in YYYY-MM-DD format.",
          };
        }

        // Check if startDate is before today
        if (isBefore(startDate, today)) {
          return {
            success: false,
            message: `Start date (${params.startDate}) cannot be in the past. Please choose today or a future date.`,
          };
        }

        // Check if endDate is more than 1 year from now
        if (isAfter(endDate, oneYearFromNow)) {
          return {
            success: false,
            message: `End date (${params.endDate}) cannot be more than 1 year from now. Please choose a date within the next year.`,
          };
        }

        // Check if startDate is after endDate
        if (isAfter(startDate, endDate)) {
          return {
            success: false,
            message: `Start date (${params.startDate}) must be before or equal to end date (${params.endDate}).`,
          };
        }

        // If travelDate is provided, validate it
        if (params.travelDate) {
          const travelDate = parseISO(params.travelDate);

          if (Number.isNaN(travelDate.getTime())) {
            return {
              success: false,
              message:
                "Invalid travel date. Please use valid date in YYYY-MM-DD format.",
            };
          }

          if (isBefore(travelDate, startDate) || isAfter(travelDate, endDate)) {
            return {
              success: false,
              message: `Travel date (${params.travelDate}) must be within the date range (${params.startDate} to ${params.endDate}).`,
            };
          }
        }
      } catch (error) {
        return {
          success: false,
          message: `Error validating dates: ${(error as Error).message}. Please use valid dates in YYYY-MM-DD format.`,
        };
      }

      const scene = {
        view: "search" as const,
        mode: "flights" as const,
        data: {
          origin: params.origin,
          destination: params.destination,
          startDate: params.startDate,
          endDate: params.endDate,
          // Include optional travelDate if provided
          ...(params.travelDate && { travelDate: params.travelDate }),
          // Include optional filters if provided
          ...(params.adults !== undefined && { adults: params.adults }),
          ...(params.children !== undefined && { children: params.children }),
          ...(params.maxStops !== undefined && { maxStops: params.maxStops }),
          ...(params.seatType !== undefined && { seatType: params.seatType }),
          ...(params.maxPrice !== undefined && { maxPrice: params.maxPrice }),
          ...(params.airlines !== undefined && { airlines: params.airlines }),
          ...(params.departureTimeFrom !== undefined && {
            departureTimeFrom: params.departureTimeFrom,
          }),
          ...(params.departureTimeTo !== undefined && {
            departureTimeTo: params.departureTimeTo,
          }),
          ...(params.arrivalTimeFrom !== undefined && {
            arrivalTimeFrom: params.arrivalTimeFrom,
          }),
          ...(params.arrivalTimeTo !== undefined && {
            arrivalTimeTo: params.arrivalTimeTo,
          }),
          ...(params.daysOfWeek !== undefined && {
            daysOfWeek: params.daysOfWeek,
          }),
          ...(params.searchWindowDays !== undefined && {
            searchWindowDays: params.searchWindowDays,
          }),
        },
      };

      // Validate with Zod schema
      try {
        PlannerSearchSceneSchema.parse(scene);
      } catch (error) {
        return {
          success: false,
          message: `Invalid search scene configuration: ${(error as Error).message}`,
        };
      }

      const dateInfo = params.travelDate
        ? `on ${params.travelDate}`
        : `(${params.startDate} to ${params.endDate})`;

      return {
        success: true,
        message: `Displaying search: ${params.origin.join("/")} → ${params.destination.join("/")} ${dateInfo}`,
        scene,
      };
    } catch (error) {
      // Catch any unexpected errors
      return {
        success: false,
        message: `Unexpected error updating view: ${(error as Error).message}. Please try again.`,
      };
    }
  },
});

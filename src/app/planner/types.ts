import type { PlannerMapScene, PlannerSearchScene } from "@/ai/types";

/**
 * Scene union type for the planner UI.
 * Matches the scene types from the agent.
 */
export type PlannerScene = PlannerMapScene | PlannerSearchScene;

/**
 * Flight leg information from search results.
 */
export type FlightLeg = {
  airline: string;
  flightNumber: string;
  departure: {
    airport: string;
    dateTime: string;
  };
  arrival: {
    airport: string;
    dateTime: string;
  };
  duration: number;
};

/**
 * Flight result from search tool.
 */
export type FlightResult = {
  price: number;
  duration: number;
  stops: number;
  legs: FlightLeg[];
};

/**
 * Date with price from date search tool.
 */
export type DatePrice = {
  date: string;
  price: number;
  departureDate?: string;
  returnDate?: string;
};

/**
 * Search flights tool output.
 */
export type SearchFlightsOutput = {
  success: boolean;
  message: string;
  count?: number;
  flights: FlightResult[];
  searchParams?: {
    origin: string[];
    destination: string[];
    travelDate: string;
  };
};

/**
 * Search dates tool output.
 */
export type SearchDatesOutput = {
  success: boolean;
  message: string;
  count?: number;
  cheapestPrice?: number;
  cheapestDate?: string;
  dates: DatePrice[];
  searchParams?: {
    origin: string[];
    destination: string[];
    dateRange: string;
    tripType: string;
  };
};

/**
 * Control scene tool output.
 */
export type ControlSceneOutput = {
  success: boolean;
  message: string;
  scene?: PlannerScene;
};

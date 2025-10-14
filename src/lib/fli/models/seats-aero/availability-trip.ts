/**
 * Frontend-safe models for seats.aero availability trips
 * These mirror the database schema but are safe to import in client components
 */

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export type SeatsAeroAvailabilityTripModel = {
  id: string;
  searchRequestId: string | null;
  apiTripId: string;
  apiRouteId: string | null;
  apiAvailabilityId: string | null;
  originAirport: string;
  destinationAirport: string;
  travelDate: string;
  flightNumbers: string[];
  carriers: string;
  aircraftTypes: string[] | null;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  totalDistanceMiles: number;
  cabinClass: CabinClass;
  mileageCost: number;
  remainingSeats: number;
  totalTaxes: string;
  taxesCurrency: string | null;
  taxesCurrencySymbol: string | null;
  source: string;
  apiCreatedAt: string;
  apiUpdatedAt: string;
  createdAt: string;
};

export type SeatsAeroSearchRequestStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type SeatsAeroSearchRequestModel = {
  id: string;
  originAirport: string;
  destinationAirport: string;
  searchStartDate: string;
  searchEndDate: string;
  status: SeatsAeroSearchRequestStatus;
  cursor: number | null;
  hasMore: boolean | null;
  totalCount: number | null;
  processedCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

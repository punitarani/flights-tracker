import { getDefaultAlertDateRangeIso } from "@/core/alert-defaults";
import { AlertType } from "@/core/alert-types";
import type { AlertFilters } from "@/core/filters";
import type { Airline, Airport, Alert } from "@/db/schema";

/**
 * Mock data for testing alerts functionality
 */

export const mockAirports: Airport[] = [
  {
    id: "airport_lax",
    iata: "LAX",
    icao: "KLAX",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "United States",
    location: { x: -118.4081, y: 33.9425 },
  },
  {
    id: "airport_jfk",
    iata: "JFK",
    icao: "KJFK",
    name: "John F. Kennedy International Airport",
    city: "New York",
    country: "United States",
    location: { x: -73.7781, y: 40.6413 },
  },
  {
    id: "airport_lhr",
    iata: "LHR",
    icao: "EGLL",
    name: "London Heathrow Airport",
    city: "London",
    country: "United Kingdom",
    location: { x: -0.4614, y: 51.47 },
  },
];

export const mockAirlines: Airline[] = [
  {
    id: "airline_aa",
    iata: "AA",
    icao: "AAL",
    name: "American Airlines",
  },
  {
    id: "airline_ba",
    iata: "BA",
    icao: "BAW",
    name: "British Airways",
  },
  {
    id: "airline_ua",
    iata: "UA",
    icao: "UAL",
    name: "United Airlines",
  },
];

export const createMockAlertFilters = (
  overrides?: Partial<AlertFilters>,
): AlertFilters => {
  const base: AlertFilters = {
    version: 1,
    route: {
      from: "LAX",
      to: "JFK",
    },
    filters: {
      ...getDefaultAlertDateRangeIso(),
      stops: "ANY",
      class: "ECONOMY",
      airlines: ["AA"],
      price: 500,
    },
  };

  if (!overrides) {
    return base;
  }

  return {
    ...base,
    ...overrides,
    route: {
      ...base.route,
      ...(overrides.route ?? {}),
    },
    filters: {
      ...base.filters,
      ...(overrides.filters ?? {}),
    },
  };
};

export const createMockAlert = (overrides?: Partial<Alert>): Alert => ({
  id: "alert_test123",
  userId: "user_123",
  type: AlertType.DAILY,
  filters: createMockAlertFilters(),
  status: "active",
  alertEnd: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Creates a mock database response for Drizzle ORM operations
 */
export const createMockDbResponse = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: (_n: number) => Promise.resolve([]),
        orderBy: () => Promise.resolve([]),
      }),
      orderBy: () => Promise.resolve([]),
      limit: (_n: number) => Promise.resolve([]),
    }),
  }),

  insert: () => ({
    values: () => ({
      returning: () => Promise.resolve([createMockAlert()]),
    }),
  }),

  update: () => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve([createMockAlert()]),
      }),
    }),
  }),
};

/**
 * Helper function to create a mock user ID
 */
export const createMockUserId = (): string =>
  `user_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Helper function to create a mock alert ID
 */
export const createMockAlertId = (): string =>
  `alert_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Test fixtures for worker tests
 * Provides mock data for alerts, flights, users, etc.
 */

import { AlertType } from "@/core/alert-types";
import type { Alert } from "@/db/schema";
import type { FlightOption } from "@/server/services/flights";

export const createMockAlert = (overrides?: Partial<Alert>): Alert => ({
  id: "alt-test-123",
  userId: "user-123",
  type: AlertType.DAILY,
  status: "active",
  filters: {
    version: 1,
    route: {
      from: "JFK",
      to: "LAX",
    },
    filters: {
      dateFrom: "2025-12-01",
      dateTo: "2025-12-15",
      class: "BUSINESS",
      stops: "NONSTOP",
      airlines: ["UA", "AA"],
      price: 500,
    },
  },
  alertEnd: null,
  createdAt: new Date("2025-01-01").toISOString(),
  ...overrides,
});

export const createMockFlight = (
  overrides?: Partial<FlightOption>,
): FlightOption => ({
  totalPrice: 450,
  currency: "USD",
  slices: [
    {
      durationMinutes: 360,
      stops: 0,
      price: 450,
      legs: [
        {
          airlineCode: "UA",
          airlineName: "United Airlines",
          flightNumber: "UA123",
          departureAirportCode: "JFK",
          departureAirportName: "John F. Kennedy International Airport",
          departureDateTime: "2025-12-05T08:00:00Z",
          arrivalAirportCode: "LAX",
          arrivalAirportName: "Los Angeles International Airport",
          arrivalDateTime: "2025-12-05T14:00:00Z",
          durationMinutes: 360,
        },
      ],
    },
  ],
  ...overrides,
});

export const createMockUserEmail = (userId: string): string =>
  `user-${userId}@example.com`;

// Mock Supabase user response
export const createMockSupabaseUserResponse = (
  userId: string,
  email?: string,
) => ({
  id: userId,
  email: email || createMockUserEmail(userId),
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
});

// Mock flights API response
export const createMockFlightsApiResponse = (flights: FlightOption[]) => ({
  flights,
  count: flights.length,
  timestamp: new Date().toISOString(),
});

// Create multiple alerts for testing
export const createMockAlerts = (count: number, userId?: string): Alert[] =>
  Array.from({ length: count }, (_, i) =>
    createMockAlert({
      id: `alt-test-${i}`,
      userId: userId || `user-${i}`,
      filters: {
        version: 1,
        route: {
          from: ["JFK", "LAX", "ORD", "DFW"][i % 4],
          to: ["LAX", "JFK", "SFO", "MIA"][i % 4],
        },
        filters: {
          dateFrom: "2025-12-01",
          dateTo: "2025-12-15",
          price: 500 + i * 100,
        },
      },
    }),
  );

// Create multiple flights for testing
export const createMockFlights = (count: number): FlightOption[] =>
  Array.from({ length: count }, (_, i) =>
    createMockFlight({
      totalPrice: 400 + i * 50,
    }),
  );

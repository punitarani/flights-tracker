/**
 * Tests for SearchFlights class.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import {
  Airport,
  FlightSearchFiltersSchema,
  MaxStops,
  PassengerInfoSchema,
  SeatType,
  SortBy,
  TripType,
} from "@/lib/fli/models";
import { SearchFlights } from "@/lib/fli/search";

// Integration tests - make real HTTP calls to Google Flights API
// Run explicitly with: bun run test:fli
const describeOrSkip = process.env.RUN_INTEGRATION_TESTS
  ? describe
  : describe.skip;

describeOrSkip("SearchFlights", () => {
  let search: SearchFlights;

  beforeAll(() => {
    search = new SearchFlights();
  });

  const getBasicSearchParams = () => {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 30);

    return FlightSearchFiltersSchema.parse({
      passengerInfo: PassengerInfoSchema.parse({
        adults: 1,
        children: 0,
        infantsInSeat: 0,
        infantsOnLap: 0,
      }),
      flightSegments: [
        {
          departureAirport: [[Airport.PHX, 0]],
          arrivalAirport: [[Airport.SFO, 0]],
          travelDate: futureDate.toISOString().split("T")[0],
        },
      ],
      stops: MaxStops.NON_STOP,
      seatType: SeatType.ECONOMY,
      sortBy: SortBy.CHEAPEST,
    });
  };

  const getComplexSearchParams = () => {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 60);

    return FlightSearchFiltersSchema.parse({
      passengerInfo: PassengerInfoSchema.parse({
        adults: 2,
        children: 1,
        infantsInSeat: 0,
        infantsOnLap: 1,
      }),
      flightSegments: [
        {
          departureAirport: [[Airport.JFK, 0]],
          arrivalAirport: [[Airport.LAX, 0]],
          travelDate: futureDate.toISOString().split("T")[0],
        },
      ],
      stops: MaxStops.ONE_STOP_OR_FEWER,
      seatType: SeatType.FIRST,
      sortBy: SortBy.TOP_FLIGHTS,
    });
  };

  const getRoundTripSearchParams = () => {
    const today = new Date();
    const outboundDate = new Date(today);
    outboundDate.setDate(today.getDate() + 30);
    const returnDate = new Date(outboundDate);
    returnDate.setDate(outboundDate.getDate() + 7);

    return FlightSearchFiltersSchema.parse({
      passengerInfo: PassengerInfoSchema.parse({
        adults: 1,
        children: 0,
        infantsInSeat: 0,
        infantsOnLap: 0,
      }),
      flightSegments: [
        {
          departureAirport: [[Airport.SFO, 0]],
          arrivalAirport: [[Airport.JFK, 0]],
          travelDate: outboundDate.toISOString().split("T")[0],
        },
        {
          departureAirport: [[Airport.JFK, 0]],
          arrivalAirport: [[Airport.SFO, 0]],
          travelDate: returnDate.toISOString().split("T")[0],
        },
      ],
      stops: MaxStops.NON_STOP,
      seatType: SeatType.ECONOMY,
      sortBy: SortBy.CHEAPEST,
      tripType: TripType.ROUND_TRIP,
    });
  };

  const getComplexRoundTripParams = () => {
    const today = new Date();
    const outboundDate = new Date(today);
    outboundDate.setDate(today.getDate() + 60);
    const returnDate = new Date(outboundDate);
    returnDate.setDate(outboundDate.getDate() + 14);

    return FlightSearchFiltersSchema.parse({
      passengerInfo: PassengerInfoSchema.parse({
        adults: 2,
        children: 1,
        infantsInSeat: 0,
        infantsOnLap: 1,
      }),
      flightSegments: [
        {
          departureAirport: [[Airport.LAX, 0]],
          arrivalAirport: [[Airport.ORD, 0]],
          travelDate: outboundDate.toISOString().split("T")[0],
        },
        {
          departureAirport: [[Airport.ORD, 0]],
          arrivalAirport: [[Airport.LAX, 0]],
          travelDate: returnDate.toISOString().split("T")[0],
        },
      ],
      stops: MaxStops.ONE_STOP_OR_FEWER,
      seatType: SeatType.BUSINESS,
      sortBy: SortBy.TOP_FLIGHTS,
      tripType: TripType.ROUND_TRIP,
    });
  };

  test("basic search functionality", async () => {
    const searchParams = getBasicSearchParams();
    const results = await search.search(searchParams);
    expect(Array.isArray(results)).toBe(true);
  });

  test("complex search functionality", async () => {
    const searchParams = getComplexSearchParams();
    const results = await search.search(searchParams);
    expect(Array.isArray(results)).toBe(true);
  });

  test("first search with basic params", async () => {
    const basicParams = getBasicSearchParams();
    const results = await search.search(basicParams);
    expect(Array.isArray(results)).toBe(true);
  });

  test("second search with complex params", async () => {
    const complexParams = getComplexSearchParams();
    const results = await search.search(complexParams);
    expect(Array.isArray(results)).toBe(true);
  });

  test("third search reusing basic params", async () => {
    const basicParams = getBasicSearchParams();
    const results = await search.search(basicParams);
    expect(Array.isArray(results)).toBe(true);
  });

  test("basic round trip search", async () => {
    const searchParams = getRoundTripSearchParams();
    const results = await search.search(searchParams);

    expect(Array.isArray(results)).toBe(true);
    expect(results).not.toBeNull();

    if (results && results.length > 0) {
      // Check that results contain tuples of outbound and return flights
      for (const result of results) {
        if (Array.isArray(result)) {
          const [outbound, returnFlight] = result;

          // Verify outbound flight
          expect(outbound.legs[0].departureAirport).toBe(Airport.SFO);
          expect(outbound.legs[outbound.legs.length - 1].arrivalAirport).toBe(
            Airport.JFK,
          );

          // Verify return flight
          expect(returnFlight.legs[0].departureAirport).toBe(Airport.JFK);
          expect(
            returnFlight.legs[returnFlight.legs.length - 1].arrivalAirport,
          ).toBe(Airport.SFO);
        }
      }
    }
  });

  test("complex round trip search", async () => {
    const searchParams = getComplexRoundTripParams();
    const results = await search.search(searchParams);

    expect(Array.isArray(results)).toBe(true);
    expect(results).not.toBeNull();

    if (results && results.length > 0) {
      // Check that results contain tuples of outbound and return flights
      for (const result of results) {
        if (Array.isArray(result)) {
          const [outbound, returnFlight] = result;

          // Verify outbound flight
          expect(outbound.legs[0].departureAirport).toBe(Airport.LAX);
          expect(outbound.legs[outbound.legs.length - 1].arrivalAirport).toBe(
            Airport.ORD,
          );
          expect(outbound.stops).toBeLessThanOrEqual(
            MaxStops.ONE_STOP_OR_FEWER,
          );

          // Verify return flight
          expect(returnFlight.legs[0].departureAirport).toBe(Airport.ORD);
          expect(
            returnFlight.legs[returnFlight.legs.length - 1].arrivalAirport,
          ).toBe(Airport.LAX);
          expect(returnFlight.stops).toBeLessThanOrEqual(
            MaxStops.ONE_STOP_OR_FEWER,
          );
        }
      }
    }
  });

  test("round trip result structure", async () => {
    const searchParams = getRoundTripSearchParams();
    const results = await search.search(searchParams);

    expect(Array.isArray(results)).toBe(true);
    expect(results).not.toBeNull();

    if (results && results.length > 0) {
      for (const result of results) {
        if (Array.isArray(result)) {
          expect(result.length).toBe(2);
          const [outbound, returnFlight] = result;

          // Verify both flights have the expected structure
          for (const flight of [outbound, returnFlight]) {
            expect(flight).toHaveProperty("price");
            expect(flight).toHaveProperty("duration");
            expect(flight).toHaveProperty("stops");
            expect(flight).toHaveProperty("legs");
            expect(flight.legs.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

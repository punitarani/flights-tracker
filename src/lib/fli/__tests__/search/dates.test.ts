/**
 * Tests for SearchDates class.
 */

import { beforeAll, describe, expect, test } from "vitest";
import {
  Airport,
  DateSearchFiltersSchema,
  MaxStops,
  PassengerInfoSchema,
  SeatType,
  SortBy,
  TripType,
} from "@/lib/fli/models";
import { SearchDates } from "@/lib/fli/search";

describe("SearchDates", () => {
  let search: SearchDates;

  beforeAll(() => {
    search = new SearchDates();
  });

  const getBasicSearchParams = () => {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 30);

    const fromDate = new Date(futureDate);
    fromDate.setDate(futureDate.getDate() - 30);
    const toDate = new Date(futureDate);
    toDate.setDate(futureDate.getDate() + 30);

    return DateSearchFiltersSchema.parse({
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
      fromDate: fromDate.toISOString().split("T")[0],
      toDate: toDate.toISOString().split("T")[0],
    });
  };

  const getComplexSearchParams = () => {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 60);

    const fromDate = new Date(futureDate);
    fromDate.setDate(futureDate.getDate() - 30);
    const toDate = new Date(futureDate);
    toDate.setDate(futureDate.getDate() + 30);

    return DateSearchFiltersSchema.parse({
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
      fromDate: fromDate.toISOString().split("T")[0],
      toDate: toDate.toISOString().split("T")[0],
    });
  };

  const getRoundTripSearchParams = () => {
    const today = new Date();
    const outboundDate = new Date(today);
    outboundDate.setDate(today.getDate() + 30);
    const returnDate = new Date(outboundDate);
    returnDate.setDate(outboundDate.getDate() + 7);

    const fromDate = new Date(outboundDate);
    fromDate.setDate(outboundDate.getDate() - 30);
    const toDate = new Date(outboundDate);
    toDate.setDate(outboundDate.getDate() + 30);

    return DateSearchFiltersSchema.parse({
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
      fromDate: fromDate.toISOString().split("T")[0],
      toDate: toDate.toISOString().split("T")[0],
      duration: 7,
    });
  };

  const getComplexRoundTripParams = () => {
    const today = new Date();
    const outboundDate = new Date(today);
    outboundDate.setDate(today.getDate() + 60);
    const returnDate = new Date(outboundDate);
    returnDate.setDate(outboundDate.getDate() + 14);

    const fromDate = new Date(outboundDate);
    fromDate.setDate(outboundDate.getDate() - 30);
    const toDate = new Date(outboundDate);
    toDate.setDate(outboundDate.getDate() + 30);

    return DateSearchFiltersSchema.parse({
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
      fromDate: fromDate.toISOString().split("T")[0],
      toDate: toDate.toISOString().split("T")[0],
      duration: 14,
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

  test("date price sorting", async () => {
    const searchParams = getBasicSearchParams();
    const results = await search.search(searchParams);

    expect(results).not.toBeNull();

    if (results && results.length > 0) {
      // Verify dates are sorted
      const dates = results.map((result) => result.date[0]);
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

      for (let i = 0; i < dates.length; i++) {
        expect(dates[i].getTime()).toBe(sortedDates[i].getTime());
      }
    }
  });

  test("basic round trip date search", async () => {
    const searchParams = getRoundTripSearchParams();
    const results = await search.search(searchParams);

    expect(Array.isArray(results)).toBe(true);
    expect(results).not.toBeNull();

    if (results && results.length > 0) {
      // Verify date range
      const fromDate = new Date(searchParams.fromDate);
      const toDate = new Date(searchParams.toDate);

      for (const result of results) {
        // For round trips, date is a tuple of (outbound_date, return_date)
        const [outboundDate, returnDate] = result.date as [Date, Date];
        expect(outboundDate.getTime()).toBeGreaterThanOrEqual(
          fromDate.getTime(),
        );
        expect(outboundDate.getTime()).toBeLessThanOrEqual(toDate.getTime());
        expect(outboundDate.getTime()).toBeLessThanOrEqual(
          returnDate.getTime(),
        );
        expect(result.price).toBeGreaterThan(0);
      }
    }
  });

  test("complex round trip date search", async () => {
    const searchParams = getComplexRoundTripParams();
    const results = await search.search(searchParams);

    expect(Array.isArray(results)).toBe(true);
    expect(results).not.toBeNull();

    if (results && results.length > 0) {
      // Verify date range
      const fromDate = new Date(searchParams.fromDate);
      const toDate = new Date(searchParams.toDate);

      for (const result of results) {
        // For round trips, date is a tuple of (outbound_date, return_date)
        const [outboundDate, returnDate] = result.date as [Date, Date];
        expect(outboundDate.getTime()).toBeGreaterThanOrEqual(
          fromDate.getTime(),
        );
        expect(outboundDate.getTime()).toBeLessThanOrEqual(toDate.getTime());
        expect(outboundDate.getTime()).toBeLessThanOrEqual(
          returnDate.getTime(),
        );
        expect(result.price).toBeGreaterThan(0);
      }
    }
  });

  test("round trip result structure", async () => {
    const searchParams = getRoundTripSearchParams();
    const results = await search.search(searchParams);

    expect(Array.isArray(results)).toBe(true);
    expect(results).not.toBeNull();

    if (results && results.length > 0) {
      // Verify chronological order of outbound dates
      const outboundDates = results.map((result) => result.date[0]);
      const sortedDates = [...outboundDates].sort(
        (a, b) => a.getTime() - b.getTime(),
      );

      for (let i = 0; i < outboundDates.length; i++) {
        expect(outboundDates[i].getTime()).toBe(sortedDates[i].getTime());
      }

      // Verify result structure
      for (const result of results) {
        expect(Array.isArray(result.date)).toBe(true);
        expect(result.date.length).toBe(2); // Should have outbound and return dates
        const [outboundDate, returnDate] = result.date as [Date, Date];
        expect(outboundDate).toBeInstanceOf(Date);
        expect(returnDate).toBeInstanceOf(Date);
        expect(outboundDate.getTime()).toBeLessThanOrEqual(
          returnDate.getTime(),
        );
        expect(result.price).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * Flight search implementation.
 *
 * This module provides the core flight search functionality, interfacing directly
 * with Google Flights' API to find available flights and their details.
 */

import { Airline } from "../models/airline";
import { Airport } from "../models/airport";
import { type FlightResult, TripType } from "../models/google-flights/base";
import {
  type FlightSearchFilters,
  FlightSearchFiltersModel,
} from "../models/google-flights/flights";
import { getClient } from "./client";

/**
 * Flight search implementation using Google Flights' API.
 *
 * This class handles searching for specific flights with detailed filters,
 * parsing the results into structured data models.
 */
export class SearchFlights {
  private static readonly BASE_URL =
    "https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults";

  private client = getClient();

  /**
   * Search for flights using the given FlightSearchFilters.
   *
   * @param filters - Full flight search object including airports, dates, and preferences
   * @param topN - Number of flights to limit the return flight search to
   * @returns List of FlightResult objects containing flight details, or null if no results
   * @throws Error if the search fails or returns invalid data
   */
  async search(
    filters: FlightSearchFilters,
    topN = 5,
  ): Promise<Array<FlightResult | [FlightResult, FlightResult]> | null> {
    const filtersModel = new FlightSearchFiltersModel(filters);
    const encodedFilters = filtersModel.encode();

    try {
      const response = await this.client.post(SearchFlights.BASE_URL, {
        body: `f.req=${encodedFilters}`,
      });

      const text = await response.text();
      const parsed = JSON.parse(text.replace(/^\)\]\}'/, ""))[0][2];

      if (!parsed) {
        return null;
      }

      const encodedData = JSON.parse(parsed);
      // biome-ignore lint/suspicious/noExplicitAny: we don't know the type
      const flightsData: any[] = [];

      // Extract flights from indices 2 and 3
      for (const i of [2, 3]) {
        if (Array.isArray(encodedData[i])) {
          flightsData.push(...encodedData[i][0]);
        }
      }

      const flights = flightsData.map((flight) =>
        this.parseFlightsData(flight),
      );

      if (
        filters.tripType === TripType.ONE_WAY ||
        filters.flightSegments[0].selectedFlight !== undefined
      ) {
        return flights;
      }

      if (
        filters.tripType === TripType.ROUND_TRIP &&
        filters.flightSegments.length >= 2
      ) {
        const flightPairs = this.buildFlightPairsFromSingleResponse(
          filters,
          flights,
          topN,
        );

        if (flightPairs.length > 0) {
          return flightPairs;
        }

        return await this.fetchReturnFlightPairs(filters, flights, topN);
      }

      return flights;
    } catch (error) {
      throw new Error(`Search failed: ${(error as Error).message}`);
    }
  }

  private buildFlightPairsFromSingleResponse(
    filters: FlightSearchFilters,
    flights: FlightResult[],
    topN: number,
  ): Array<[FlightResult, FlightResult]> {
    if (filters.flightSegments.length < 2) {
      return [];
    }

    const [outboundSegment, returnSegment] = filters.flightSegments;

    const outboundDepartures = new Set(
      outboundSegment.departureAirport.map((airport) => airport[0] as Airport),
    );
    const outboundArrivals = new Set(
      outboundSegment.arrivalAirport.map((airport) => airport[0] as Airport),
    );
    const returnDepartures = new Set(
      returnSegment.departureAirport.map((airport) => airport[0] as Airport),
    );
    const returnArrivals = new Set(
      returnSegment.arrivalAirport.map((airport) => airport[0] as Airport),
    );

    const outboundFlights = flights.filter((flight) =>
      this.matchesSegment(flight, outboundDepartures, outboundArrivals),
    );
    const returnFlights = flights.filter((flight) =>
      this.matchesSegment(flight, returnDepartures, returnArrivals),
    );

    if (!outboundFlights.length || !returnFlights.length) {
      return [];
    }

    const limitedOutbound = outboundFlights.slice(0, topN);
    const limitedReturn = returnFlights.slice(0, topN);

    const flightPairs: Array<[FlightResult, FlightResult]> = [];

    for (const outbound of limitedOutbound) {
      for (const returnFlight of limitedReturn) {
        flightPairs.push([outbound, returnFlight]);
      }
    }

    return flightPairs;
  }

  private matchesSegment(
    flight: FlightResult,
    departureAirports: Set<Airport>,
    arrivalAirports: Set<Airport>,
  ): boolean {
    if (!flight.legs.length) {
      return false;
    }

    const firstLeg = flight.legs[0];
    const lastLeg = flight.legs[flight.legs.length - 1];

    return (
      departureAirports.has(firstLeg.departureAirport) &&
      arrivalAirports.has(lastLeg.arrivalAirport)
    );
  }

  private async fetchReturnFlightPairs(
    filters: FlightSearchFilters,
    flights: FlightResult[],
    topN: number,
  ): Promise<Array<[FlightResult, FlightResult]>> {
    const flightPairs: Array<[FlightResult, FlightResult]> = [];
    const outboundCandidates = flights.slice(0, Math.min(topN, 3));

    const returnSearches = outboundCandidates.map(async (selectedFlight) => {
      const selectedFlightFilters: FlightSearchFilters = {
        ...filters,
        flightSegments: filters.flightSegments.map((segment, idx) => {
          if (idx === 0) {
            return {
              ...segment,
              selectedFlight,
            };
          }
          return { ...segment };
        }),
      };

      const results = await this.search(selectedFlightFilters, topN);
      return { selectedFlight, results };
    });

    const resolvedReturnFlights = await Promise.all(returnSearches);

    for (const { selectedFlight, results } of resolvedReturnFlights) {
      if (Array.isArray(results)) {
        for (const returnFlight of results as FlightResult[]) {
          flightPairs.push([selectedFlight, returnFlight]);
        }
      }
    }

    return flightPairs;
  }

  /**
   * Parse raw flight data into a structured FlightResult.
   *
   * @param data - Raw flight data from the API response
   * @returns Structured FlightResult object with all flight details
   */
  private parseFlightsData(
    // biome-ignore lint/suspicious/noExplicitAny: we don't know the type
    data: any,
  ): FlightResult {
    const flight: FlightResult = {
      price: data[1][0][data[1][0].length - 1],
      duration: data[0][9],
      stops: data[0][2].length - 1,
      // biome-ignore lint/suspicious/noExplicitAny: we don't know the type
      legs: data[0][2].map((fl: any) => ({
        airline: this.parseAirline(fl[22][0]),
        flightNumber: fl[22][1],
        departureAirport: this.parseAirport(fl[3]),
        arrivalAirport: this.parseAirport(fl[6]),
        departureDateTime: this.parseDateTime(fl[20], fl[8]),
        arrivalDateTime: this.parseDateTime(fl[21], fl[10]),
        duration: fl[11],
      })),
    };
    return flight;
  }

  /**
   * Convert date and time arrays to Date.
   *
   * @param dateArr - List of integers [year, month, day]
   * @param timeArr - List of integers [hour, minute]
   * @returns Parsed Date object
   * @throws Error if arrays contain only null values
   */
  private parseDateTime(dateArr: number[], timeArr: number[]): Date {
    const hasValidDate = dateArr.some((x) => x !== null && x !== undefined);
    const hasValidTime = timeArr.some((x) => x !== null && x !== undefined);

    if (!hasValidDate || !hasValidTime) {
      throw new Error(
        "Date and time arrays must contain at least one non-null value",
      );
    }

    return new Date(
      dateArr[0] || 0,
      (dateArr[1] || 1) - 1, // Month is 0-indexed
      dateArr[2] || 1,
      timeArr[0] || 0,
      timeArr[1] || 0,
    );
  }

  /**
   * Convert airline code to Airline enum.
   *
   * @param airlineCode - Raw airline code from API
   * @returns Corresponding Airline enum value
   */
  private parseAirline(airlineCode: string): Airline {
    // Handle codes that start with digits
    const code = /^\d/.test(airlineCode) ? `_${airlineCode}` : airlineCode;
    return Airline[code as keyof typeof Airline];
  }

  /**
   * Convert airport code to Airport enum.
   *
   * @param airportCode - Raw airport code from API
   * @returns Corresponding Airport enum value
   */
  private parseAirport(airportCode: string): Airport {
    return Airport[airportCode as keyof typeof Airport];
  }
}

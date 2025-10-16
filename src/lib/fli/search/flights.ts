/**
 * Flight search implementation.
 *
 * This module provides the core flight search functionality, interfacing directly
 * with Google Flights' API to find available flights and their details.
 */

import { parallel, sift } from "radash";

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
        data: `f.req=${encodedFilters}`,
      });

      const text = response.data;
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

      const flights = sift(
        flightsData.map((flight) => this.parseFlightsData(flight)),
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
    const outboundSets = this.extractSegmentAirports(outboundSegment);
    const returnSets = this.extractSegmentAirports(returnSegment);

    const outboundFlights = flights.filter((flight) =>
      this.matchesSegment(flight, outboundSets),
    );
    const returnFlights = flights.filter((flight) =>
      this.matchesSegment(flight, returnSets),
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
    airports: SegmentAirports,
  ): boolean {
    if (!flight.legs.length) {
      return false;
    }

    const firstLeg = flight.legs[0];
    const lastLeg = flight.legs[flight.legs.length - 1];

    return (
      airports.departures.has(firstLeg.departureAirport) &&
      airports.arrivals.has(lastLeg.arrivalAirport)
    );
  }

  private async fetchReturnFlightPairs(
    filters: FlightSearchFilters,
    flights: FlightResult[],
    topN: number,
  ): Promise<Array<[FlightResult, FlightResult]>> {
    const flightPairs: Array<[FlightResult, FlightResult]> = [];
    const outboundCandidates = flights.slice(0, Math.min(topN, 3));

    if (!outboundCandidates.length) {
      return flightPairs;
    }

    const resolved = await parallel(
      Math.min(3, outboundCandidates.length),
      outboundCandidates,
      async (selectedFlight) => {
        try {
          const followUpFilters = this.buildFollowUpFilters(
            filters,
            selectedFlight,
          );
          const results = await this.search(followUpFilters, topN);
          return {
            selectedFlight,
            results: this.normalizeFlightResults(results),
          };
        } catch {
          return { selectedFlight, results: [] };
        }
      },
    );

    for (const { selectedFlight, results } of resolved) {
      for (const returnFlight of results) {
        flightPairs.push([selectedFlight, returnFlight]);
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
  ): FlightResult | null {
    try {
      const rawLegs = data[0][2] || [];

      // Parse and filter out invalid legs
      const validLegs = rawLegs
        .map((fl: any) => {
          try {
            const airline = this.parseAirline(fl[22][0]);
            const departureAirport = this.parseAirport(fl[3]);
            const arrivalAirport = this.parseAirport(fl[6]);

            // Skip leg if airline is unknown
            if (!airline) {
              console.warn(
                `Skipping flight leg with unknown airline: ${fl[22][0]}`,
                {
                  flightNumber: fl[22][1],
                  departureAirport: fl[3],
                  arrivalAirport: fl[6],
                },
              );
              return null;
            }

            return {
              airline,
              flightNumber: fl[22][1],
              departureAirport,
              arrivalAirport,
              departureDateTime: this.parseDateTime(fl[20], fl[8]),
              arrivalDateTime: this.parseDateTime(fl[21], fl[10]),
              duration: fl[11],
            };
          } catch (error) {
            console.warn(`Failed to parse flight leg:`, {
              error: error instanceof Error ? error.message : "Unknown error",
              rawData: fl,
            });
            return null;
          }
        })
        .filter((leg: any): leg is NonNullable<typeof leg> => leg !== null);

      // Skip entire flight if no valid legs
      if (validLegs.length === 0) {
        console.warn(`Skipping flight with no valid legs`, {
          rawLegsCount: rawLegs.length,
          price: data[1][0][data[1][0].length - 1],
        });
        return null;
      }

      const flight: FlightResult = {
        price: data[1][0][data[1][0].length - 1],
        duration: data[0][9],
        stops: validLegs.length - 1,
        legs: validLegs,
      };

      return flight;
    } catch (error) {
      console.error(`Failed to parse flight data:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        rawData: data,
      });
      return null;
    }
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
   * @returns Corresponding Airline enum value or undefined if not found
   */
  private parseAirline(airlineCode: string): Airline | undefined {
    if (!airlineCode || typeof airlineCode !== "string") {
      return undefined;
    }

    // Handle codes that start with digits
    const code = /^\d/.test(airlineCode) ? `_${airlineCode}` : airlineCode;
    const airline = Airline[code as keyof typeof Airline];

    if (!airline) {
      console.warn(
        `Unknown airline code: ${airlineCode} (processed as: ${code})`,
      );
    }

    return airline;
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

  private extractSegmentAirports(
    segment: FlightSearchFilters["flightSegments"][number],
  ): SegmentAirports {
    return {
      departures: new Set(
        segment.departureAirport.map((airport) => airport[0] as Airport),
      ),
      arrivals: new Set(
        segment.arrivalAirport.map((airport) => airport[0] as Airport),
      ),
    };
  }

  private buildFollowUpFilters(
    filters: FlightSearchFilters,
    selectedFlight: FlightResult,
  ): FlightSearchFilters {
    return {
      ...filters,
      flightSegments: filters.flightSegments.map((segment, idx) =>
        idx === 0
          ? {
              ...segment,
              selectedFlight,
            }
          : { ...segment },
      ),
    };
  }

  private normalizeFlightResults(
    results: Array<FlightResult | [FlightResult, FlightResult]> | null,
  ): FlightResult[] {
    if (!Array.isArray(results)) {
      return [];
    }

    return results.filter(
      (flight): flight is FlightResult => !Array.isArray(flight),
    );
  }
}

type SegmentAirports = {
  departures: Set<Airport>;
  arrivals: Set<Airport>;
};

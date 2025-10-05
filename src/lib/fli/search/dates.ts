/**
 * Date-based flight search implementation for finding the cheapest dates to fly.
 *
 * This module provides functionality to search for the cheapest flights across a date range.
 * It uses Google Flights' calendar view API to find the best prices for each date.
 * It is intended to be used for finding the cheapest dates to fly, not the cheapest flights.
 */

import { z } from "zod";
import { TripType } from "../models/google-flights/base";
import {
  type DateSearchFilters,
  DateSearchFiltersModel,
} from "../models/google-flights/dates";
import { getClient } from "./client";

/**
 * Flight price for a specific date.
 */
export const DatePriceSchema = z.object({
  date: z.union([z.tuple([z.date()]), z.tuple([z.date(), z.date()])]),
  price: z.number(),
});

export type DatePrice = z.infer<typeof DatePriceSchema>;

/**
 * Date-based flight search implementation.
 *
 * This class provides methods to search for flight prices across a date range,
 * useful for finding the cheapest dates to fly.
 */
export class SearchDates {
  private static readonly BASE_URL =
    "https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetCalendarGraph";
  private static readonly MAX_DAYS_PER_SEARCH = 61;

  private client = getClient();

  /**
   * Search for flight prices across a date range and search parameters.
   *
   * @param filters - Search parameters including date range, airports, and preferences
   * @returns List of DatePrice objects containing date and price pairs, or null if no results
   * @throws Error if the search fails or returns invalid data
   *
   * @remarks
   * - For date ranges larger than 61 days, splits into multiple searches.
   * - We can't search more than 305 days in the future.
   */
  async search(filters: DateSearchFilters): Promise<DatePrice[] | null> {
    const fromDate = new Date(filters.fromDate);
    const toDate = new Date(filters.toDate);
    const dateRange =
      Math.floor(
        (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    if (dateRange <= SearchDates.MAX_DAYS_PER_SEARCH) {
      return this.searchChunk(filters);
    }

    // Split into chunks of MAX_DAYS_PER_SEARCH
    const allResults: DatePrice[] = [];
    let currentFrom = new Date(fromDate);

    while (currentFrom <= toDate) {
      const currentTo = new Date(
        Math.min(
          currentFrom.getTime() +
            SearchDates.MAX_DAYS_PER_SEARCH * 24 * 60 * 60 * 1000 -
            1,
          toDate.getTime(),
        ),
      );

      // Update the travel date for the flight segments
      if (currentFrom.getTime() > fromDate.getTime()) {
        for (const segment of filters.flightSegments) {
          const segmentDate = new Date(segment.travelDate);
          segmentDate.setDate(
            segmentDate.getDate() + SearchDates.MAX_DAYS_PER_SEARCH,
          );
          segment.travelDate = segmentDate.toISOString().split("T")[0];
        }
      }

      // Create new filters for this chunk
      const chunkFilters: DateSearchFilters = {
        ...filters,
        fromDate: currentFrom.toISOString().split("T")[0],
        toDate: currentTo.toISOString().split("T")[0],
      };

      const chunkResults = await this.searchChunk(chunkFilters);
      if (chunkResults) {
        allResults.push(...chunkResults);
      }

      currentFrom = new Date(currentTo.getTime() + 24 * 60 * 60 * 1000);
    }

    return allResults.length > 0 ? allResults : null;
  }

  /**
   * Search for flight prices for a single date range chunk.
   *
   * @param filters - Search parameters including date range, airports, and preferences
   * @returns List of DatePrice objects containing date and price pairs, or null if no results
   * @throws Error if the search fails or returns invalid data
   */
  private async searchChunk(
    filters: DateSearchFilters,
  ): Promise<DatePrice[] | null> {
    const filtersModel = new DateSearchFiltersModel(filters);
    const encodedFilters = filtersModel.encode();

    try {
      const response = await this.client.post(SearchDates.BASE_URL, {
        body: `f.req=${encodedFilters}`,
      });

      const text = await response.text();
      const parsed = JSON.parse(text.replace(/^\)\]\}'/, ""))[0][2];

      if (!parsed) {
        return null;
      }

      const data = JSON.parse(parsed);
      const datesData: DatePrice[] = data[data.length - 1]
        .map((item: any) => {
          const price = this.parsePrice(item);
          if (!price) return null;

          return {
            date: this.parseDate(item, filters.tripType),
            price,
          };
        })
        .filter((item: any) => item !== null);

      return datesData;
    } catch (error) {
      throw new Error(`Search failed: ${(error as Error).message}`);
    }
  }

  /**
   * Parse date data from the API response.
   *
   * @param item - Raw date data from the API response
   * @param tripType - Trip type (one-way or round-trip)
   * @returns Tuple of Date objects
   */
  private parseDate(item: any, tripType: TripType): [Date] | [Date, Date] {
    if (tripType === TripType.ONE_WAY) {
      return [new Date(item[0])];
    }
    return [new Date(item[0]), new Date(item[1])];
  }

  /**
   * Parse price data from the API response.
   *
   * @param item - Raw price data from the API response
   * @returns Float price value if valid, null if invalid or missing
   */
  private parsePrice(item: any): number | null {
    try {
      if (item && Array.isArray(item) && item.length > 2) {
        if (Array.isArray(item[2]) && item[2].length > 0) {
          if (Array.isArray(item[2][0]) && item[2][0].length > 1) {
            return Number.parseFloat(item[2][0][1]);
          }
        }
      }
    } catch (_error) {
      // Ignore parsing errors
    }

    return null;
  }
}

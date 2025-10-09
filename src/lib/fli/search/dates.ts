/**
 * Date-based flight search implementation for finding the cheapest dates to fly.
 *
 * This module provides functionality to search for the cheapest flights across a date range.
 * It uses Google Flights' calendar view API to find the best prices for each date.
 * It is intended to be used for finding the cheapest dates to fly, not the cheapest flights.
 */

import { parallel } from "radash";
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

    const chunks = this.buildChunks(fromDate, toDate);

    const chunkResults = await parallel(
      Math.min(4, chunks.length),
      chunks,
      async ({ from, to, index }) => {
        try {
          const res = await this.searchChunk(
            this.buildChunkFilters(filters, { from, to, index }),
          );
          return res ?? [];
        } catch {
          return [];
        }
      },
    );

    const flattened = chunkResults.flat();

    return flattened.length > 0 ? flattened : null;
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
      const parsed = JSON.parse(text.replace(/^\)]}'/, ""))[0][2];

      if (!parsed) {
        return null;
      }

      const parsedData: unknown = JSON.parse(parsed);
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        return null;
      }

      const calendarEntries = parsedData[parsedData.length - 1];
      if (!Array.isArray(calendarEntries)) {
        return null;
      }

      const datesData = calendarEntries
        .map((entry) => this.parseCalendarEntry(entry, filters.tripType))
        .filter((entry): entry is DatePrice => entry !== null);

      return datesData.length > 0 ? datesData : null;
    } catch (error) {
      throw new Error(`Search failed: ${(error as Error).message}`);
    }
  }

  /**
   * Parse date data from the API response.
   *
   * @param entry - data
   * @param tripType - Trip type (one-way or round-trip)
   * @returns Tuple of Date objects
   */
  private parseCalendarEntry(
    entry: unknown,
    tripType: TripType,
  ): DatePrice | null {
    if (!Array.isArray(entry)) {
      return null;
    }

    const date = this.parseDate(entry, tripType);
    const price = this.parsePrice(entry);

    if (!date || price === null) {
      return null;
    }

    return {
      date,
      price,
    };
  }

  private parseDate(
    entry: unknown[],
    tripType: TripType,
  ): DatePrice["date"] | null {
    if (entry.length === 0 || typeof entry[0] !== "string") {
      return null;
    }

    const departureDate = new Date(entry[0] as string);
    if (Number.isNaN(departureDate.getTime())) {
      return null;
    }

    if (tripType === TripType.ONE_WAY) {
      return [departureDate];
    }

    if (entry.length < 2 || typeof entry[1] !== "string") {
      return null;
    }

    const returnDate = new Date(entry[1] as string);
    if (Number.isNaN(returnDate.getTime())) {
      return null;
    }

    return [departureDate, returnDate];
  }

  /**
   * Parse price data from the API response.
   *
   * @param entry - Raw price data from the API response
   * @returns Float price value if valid, null if invalid or missing
   */
  private parsePrice(entry: unknown[]): number | null {
    if (entry.length < 3) {
      return null;
    }

    const priceSection = entry[2];
    if (!Array.isArray(priceSection) || priceSection.length === 0) {
      return null;
    }

    const priceNode = priceSection[0];
    if (!Array.isArray(priceNode) || priceNode.length < 2) {
      return null;
    }

    const rawPrice = priceNode[1];
    const parsedPrice =
      typeof rawPrice === "number"
        ? rawPrice
        : typeof rawPrice === "string"
          ? Number.parseFloat(rawPrice)
          : Number.NaN;

    if (!Number.isFinite(parsedPrice)) {
      return null;
    }

    return parsedPrice;
  }

  private buildChunkFilters(
    filters: DateSearchFilters,
    chunk: { from: Date; to: Date; index: number },
  ): DateSearchFilters {
    const adjustedSegments = filters.flightSegments.map((segment) => ({
      ...segment,
      travelDate: this.shiftDate(
        segment.travelDate,
        chunk.index * SearchDates.MAX_DAYS_PER_SEARCH,
      ),
    }));

    return {
      ...filters,
      flightSegments: adjustedSegments,
      fromDate: this.formatDate(chunk.from),
      toDate: this.formatDate(chunk.to),
    };
  }

  private buildChunks(
    from: Date,
    to: Date,
  ): Array<{
    from: Date;
    to: Date;
    index: number;
  }> {
    const chunks: Array<{ from: Date; to: Date; index: number }> = [];
    const dayMs = 24 * 60 * 60 * 1000;
    let index = 0;
    for (
      let current = new Date(from.getTime());
      current <= to;
      current = new Date(
        current.getTime() + dayMs * SearchDates.MAX_DAYS_PER_SEARCH,
      )
    ) {
      const chunkEnd = new Date(
        Math.min(
          current.getTime() + dayMs * SearchDates.MAX_DAYS_PER_SEARCH - dayMs,
          to.getTime(),
        ),
      );

      chunks.push({
        from: new Date(current.getTime()),
        to: chunkEnd,
        index,
      });
      index += 1;
    }
    return chunks;
  }

  private shiftDate(date: string, offsetDays: number): string {
    if (offsetDays === 0) {
      return date;
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    parsed.setDate(parsed.getDate() + offsetDays);
    return this.formatDate(parsed);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0] ?? "";
  }
}

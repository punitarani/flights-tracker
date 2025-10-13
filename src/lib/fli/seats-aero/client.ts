/**
 * Seats.aero API client.
 *
 * Simple HTTP client for querying award flight availability from seats.aero.
 * Supports both cached search and live search endpoints with pagination.
 */

import { env } from "@/env";
import type { SearchRequestParams, SearchResponse } from "../models/seats-aero";
import {
  SearchRequestParamsSchema,
  SearchResponseSchema,
} from "../models/seats-aero";

/**
 * Configuration options for the SeatsAeroClient.
 */
export type SeatsAeroClientConfig = {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API. Defaults to https://seats.aero/partnerapi */
  baseUrl?: string;
};

/**
 * Error thrown when the seats.aero API returns an error response.
 */
export class SeatsAeroAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(message);
    this.name = "SeatsAeroAPIError";
  }
}

/**
 * Client for interacting with the seats.aero API.
 *
 * @example
 * ```typescript
 * const client = new SeatsAeroClient();
 *
 * // Search for cached availability
 * const results = await client.search({
 *   origin_airport: "SFO",
 *   destination_airport: "PHX",
 *   start_date: "2025-10-11",
 *   end_date: "2025-10-18",
 *   include_trips: true,
 * });
 *
 * // Fetch next page
 * if (results.hasMore && results.cursor) {
 *   const nextPage = await client.search({
 *     origin_airport: "SFO",
 *     destination_airport: "PHX",
 *     cursor: results.cursor,
 *   });
 * }
 *
 * // Live search
 * const liveResults = await client.liveSearch({
 *   origin_airport: "SFO",
 *   destination_airport: "NRT",
 *   departure_date: "2025-12-15",
 *   source: "united",
 *   seat_count: 2,
 * });
 * ```
 */
export class SeatsAeroClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: SeatsAeroClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://seats.aero/partnerapi";
  }

  /**
   * Search for cached award availability across multiple dates and sources.
   *
   * This endpoint queries pre-cached availability data and is suitable for
   * searching across date ranges and multiple mileage programs.
   *
   * @param params - Search parameters
   * @returns Search response with availability data and pagination info
   * @throws {SeatsAeroAPIError} If the API returns an error
   * @throws {Error} If the response cannot be parsed or validated
   */
  async search(params: SearchRequestParams): Promise<SearchResponse> {
    // Validate request parameters
    const validatedParams = SearchRequestParamsSchema.parse(params);

    // Build query string
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(validatedParams)) {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    }

    const url = `${this.baseUrl}/search?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Partner-Authorization": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new SeatsAeroAPIError(
        `Search request failed: ${response.statusText}`,
        response.status,
        response.statusText,
      );
    }

    const data = await response.json();

    // Validate response schema
    return SearchResponseSchema.parse(data);
  }

  /**
   * Search all pages of cached availability for a route.
   *
   * Automatically handles pagination by following the cursor until all
   * results are retrieved.
   *
   * @param params - Search parameters (cursor will be automatically managed)
   * @param maxPages - Maximum number of pages to fetch (default: unlimited)
   * @returns Generator yielding search responses for each page
   * @throws {SeatsAeroAPIError} If any API request returns an error
   *
   * @example
   * ```typescript
   * const client = new SeatsAeroClient();
   *
   * for await (const page of client.searchAll({
   *   origin_airport: "SFO",
   *   destination_airport: "PHX",
   *   start_date: "2025-10-11",
   *   end_date: "2025-10-18",
   * })) {
   *   console.log(`Page has ${page.data.length} results`);
   *   // Process results...
   * }
   * ```
   */
  async *searchAll(
    params: SearchRequestParams,
    maxPages?: number,
  ): AsyncGenerator<SearchResponse> {
    let pageCount = 0;
    let currentParams = { ...params };

    while (true) {
      const result = await this.search(currentParams);
      yield result;

      pageCount += 1;

      // Stop if we've hit max pages or no more results
      if (maxPages !== undefined && pageCount >= maxPages) {
        break;
      }

      if (!result.hasMore) {
        break;
      }

      // Update cursor for next page
      currentParams = {
        ...currentParams,
        cursor: result.cursor,
      };
    }
  }
}

/**
 * Create a new SeatsAeroClient instance with optional configuration.
 *
 * Uses env.SEATS_AERO_API_KEY as the default API key if not provided.
 *
 * @param config - Optional client configuration
 * @returns A new SeatsAeroClient instance
 */
export function createSeatsAeroClient(
  config?: Partial<SeatsAeroClientConfig>,
): SeatsAeroClient {
  return new SeatsAeroClient({
    apiKey: config?.apiKey ?? env.SEATS_AERO_API_KEY,
    baseUrl: config?.baseUrl,
  });
}

/**
 * Seats.aero API client for querying award flight availability.
 * Supports both cached search and pagination.
 */

import type { SearchRequestParams, SearchResponse } from "../models/seats-aero";
import {
  SearchRequestParamsSchema,
  SearchResponseSchema,
  AvailabilityTripSchema,
} from "../models/seats-aero";
import { z } from "zod";

export type SeatsAeroClientConfig = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /**
   * Controls how strictly responses are validated.
   * - "full" (default): validate entire response with deep schemas
   * - "light": validate only top-level fields and AvailabilityTrips to reduce CPU
   */
  validationMode?: "full" | "light";
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
 */

export class SeatsAeroClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly validationMode: "full" | "light";

  constructor(config: SeatsAeroClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://seats.aero/partnerapi";
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.validationMode = config.validationMode ?? "full";
  }

  /**
   * Search for cached award availability across multiple dates and sources.
   */
  async search(params: SearchRequestParams): Promise<SearchResponse> {
    const validatedParams = SearchRequestParamsSchema.parse(params);
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(validatedParams)) {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    }

    const url = `${this.baseUrl}/search?${queryParams.toString()}`;

    const response = await this.fetchImpl(url, {
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

    if (this.validationMode === "light") {
      // Validate only the fields we actually consume downstream to reduce CPU cost
      const LightAvailabilitySchema = z
        .object({
          AvailabilityTrips: z.array(AvailabilityTripSchema).nullable(),
        })
        .passthrough();

      const LightSearchResponseSchema = z.object({
        data: z.array(LightAvailabilitySchema),
        count: z.number(),
        hasMore: z.boolean(),
        cursor: z.number(),
      });

      return LightSearchResponseSchema.parse(data) as SearchResponse;
    }

    return SearchResponseSchema.parse(data);
  }

  /**
   * Search all pages of cached availability for a route.
   * Automatically handles pagination by following the cursor until all results are retrieved.
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
 * Uses env.SEATS_AERO_API_KEY as the default API key if not provided.
 */
export function createSeatsAeroClient(
  config: SeatsAeroClientConfig,
): SeatsAeroClient {
  return new SeatsAeroClient(config);
}

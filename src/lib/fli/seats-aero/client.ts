/**
 * Seats.aero API client for querying award flight availability.
 * Supports both cached search and pagination.
 */

import type { SearchRequestParams, SearchResponse } from "../models/seats-aero";
import {
  SearchRequestParamsSchema,
  SearchResponseSchema,
} from "../models/seats-aero";

export type SeatsAeroClientConfig = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
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

  constructor(config: SeatsAeroClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://seats.aero/partnerapi";
    // Bind fetch to preserve its context when called as a method
    // This prevents "Illegal invocation" errors in Cloudflare Workers
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
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

/**
 * HTTP client implementation with rate limiting and retry functionality.
 *
 * This module provides a robust HTTP client that handles:
 * - Rate limiting (10 requests per second)
 * - Automatic retries with exponential backoff
 * - Session management
 * - Error handling
 */

/**
 * Rate limiter class to ensure we don't exceed the rate limit
 */
class RateLimiter {
  private queue: Array<() => void> = [];
  private lastCallTime = 0;
  private readonly interval: number;

  constructor(callsPerSecond: number) {
    this.interval = 1000 / callsPerSecond;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          const now = Date.now();
          const timeSinceLastCall = now - this.lastCallTime;

          if (timeSinceLastCall < this.interval) {
            await new Promise((r) =>
              setTimeout(r, this.interval - timeSinceLastCall),
            );
          }

          this.lastCallTime = Date.now();
          const result = await fn();
          resolve(result);

          // Process next item in queue if any
          if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
          }
        } catch (error) {
          reject(error);
        }
      };

      if (Date.now() - this.lastCallTime >= this.interval) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }
}

/**
 * Retry logic with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Request failed after ${maxAttempts} attempts: ${lastError?.message}`,
  );
}

/**
 * HTTP client with built-in rate limiting, retry and session management.
 */
export class Client {
  private static readonly DEFAULT_HEADERS = {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  private rateLimiter = new RateLimiter(10); // 10 requests per second

  /**
   * Make a rate-limited GET request with automatic retries.
   *
   * @param url - Target URL for the request
   * @param options - Additional fetch options
   * @returns Response from the server
   * @throws Error if request fails after all retries
   */
  async get(url: string, options?: RequestInit): Promise<Response> {
    return this.rateLimiter.execute(() =>
      withRetry(async () => {
        try {
          const response = await fetch(url, {
            ...options,
            method: "GET",
            headers: {
              ...Client.DEFAULT_HEADERS,
              ...options?.headers,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response;
        } catch (error) {
          throw new Error(`GET request failed: ${(error as Error).message}`);
        }
      }),
    );
  }

  /**
   * Make a rate-limited POST request with automatic retries.
   *
   * @param url - Target URL for the request
   * @param options - Additional fetch options
   * @returns Response from the server
   * @throws Error if request fails after all retries
   */
  async post(url: string, options?: RequestInit): Promise<Response> {
    return this.rateLimiter.execute(() =>
      withRetry(async () => {
        try {
          const response = await fetch(url, {
            ...options,
            method: "POST",
            headers: {
              ...Client.DEFAULT_HEADERS,
              ...options?.headers,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response;
        } catch (error) {
          throw new Error(`POST request failed: ${(error as Error).message}`);
        }
      }),
    );
  }
}

let clientInstance: Client | null = null;

/**
 * Get or create a shared HTTP client instance.
 *
 * @returns Singleton instance of the HTTP client
 */
export function getClient(): Client {
  if (!clientInstance) {
    clientInstance = new Client();
  }
  return clientInstance;
}

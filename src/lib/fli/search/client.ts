/**
 * HTTP client with rate limiting and retry logic.
 * Supports proxy configuration for Google Flights API requests.
 */

import axios, { type AxiosError, type AxiosResponse } from "axios";
import { retry, sleep } from "radash";
import { createAxiosConfig } from "@/lib/proxy";

type RateLimiterOptions = {
  callsPerSecond: number;
  maxConcurrent?: number;
};

class RateLimiter {
  private readonly interval: number;
  private readonly maxConcurrent: number;
  private readonly queue: Array<() => void> = [];
  private lastCallTime = 0;
  private activeCount = 0;

  constructor({ callsPerSecond, maxConcurrent = 1 }: RateLimiterOptions) {
    this.interval = callsPerSecond > 0 ? 1000 / callsPerSecond : 0;
    this.maxConcurrent = Math.max(1, maxConcurrent ?? 1);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = async () => {
        this.activeCount += 1;
        try {
          const elapsed = Date.now() - this.lastCallTime;
          const waitTime = Math.max(0, this.interval - elapsed);
          if (waitTime > 0) await sleep(waitTime);

          this.lastCallTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount = Math.max(0, this.activeCount - 1);
          const next = this.queue.shift();
          if (next) void next();
        }
      };

      if (this.activeCount < this.maxConcurrent) {
        void run();
      } else {
        this.queue.push(run);
      }
    });
  }
}

type RetryOptions = {
  times: number;
  backoff: (attempt: number) => number;
};

export class Client {
  private static readonly DEFAULT_HEADERS = Object.freeze({
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  private static readonly RETRY: RetryOptions = {
    times: 3,
    backoff: (attempt) => 250 * 2 ** (attempt - 1) + Math.random() * 125,
  };

  private readonly defaultHeaders = Client.DEFAULT_HEADERS;
  private readonly rateLimiter = new RateLimiter({ callsPerSecond: 10 });
  private readonly axiosConfig = createAxiosConfig();

  async get(
    url: string,
    options?: { headers?: Record<string, string>; signal?: AbortSignal },
  ): Promise<AxiosResponse> {
    return this.request("GET", url, options);
  }

  async post(
    url: string,
    options?: {
      headers?: Record<string, string>;
      data?: string | Record<string, unknown>;
      signal?: AbortSignal;
    },
  ): Promise<AxiosResponse> {
    return this.request("POST", url, options);
  }

  private async request(
    method: "GET" | "POST",
    url: string,
    options?: {
      headers?: Record<string, string>;
      data?: string | Record<string, unknown>;
      signal?: AbortSignal;
    },
  ): Promise<AxiosResponse> {
    const config = {
      method,
      url,
      headers: this.mergeHeaders(options?.headers ?? {}),
      data: options?.data,
      signal: options?.signal,
      ...this.axiosConfig,
    };

    return this.rateLimiter.execute(() =>
      retry(Client.RETRY, async () => {
        try {
          const response = await axios(config);
          if (response.status < 200 || response.status >= 300) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            if (axiosError.response) {
              throw new Error(
                `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
              );
            } else if (axiosError.request) {
              throw new Error(`${method} request failed: No response received`);
            }
          }
          throw new Error(
            `${method} request failed: ${(error as Error).message}`,
          );
        }
      }),
    );
  }

  private mergeHeaders(input: Record<string, string>): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...input,
    };
  }
}

let clientInstance: Client | null = null;

/**
 * Get or create a shared HTTP client instance.
 */
export function getClient(): Client {
  if (!clientInstance) {
    clientInstance = new Client();
  }
  return clientInstance;
}

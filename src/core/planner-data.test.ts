import { describe, expect, it } from "bun:test";
import type { PlanItineraryInput } from "@/server/schemas/planner";
import {
  deriveFlightFilters,
  extractPromptIntent,
  generateSearchCacheKey,
  PlannerCache,
} from "./planner-data";

describe("planner-data", () => {
  describe("deriveFlightFilters", () => {
    it("should use filters from input when provided", () => {
      const input: PlanItineraryInput = {
        prompt: "test",
        filters: {
          origin: "JFK",
          destination: "LAX",
          dateFrom: "2025-03-01",
          dateTo: "2025-03-07",
          maxPrice: 500,
        },
      };

      const result = deriveFlightFilters(input);

      expect(result.segments?.[0].origin).toBe("JFK");
      expect(result.segments?.[0].destination).toBe("LAX");
      expect(result.dateRange?.from).toBe("2025-03-01");
      expect(result.dateRange?.to).toBe("2025-03-07");
      expect(result.priceLimit?.amount).toBe(500);
      expect(result.priceLimit?.currency).toBe("USD");
    });

    it("should provide default date range when not specified", () => {
      const input: PlanItineraryInput = {
        prompt: "test",
      };

      const result = deriveFlightFilters(input);

      expect(result.dateRange).toBeDefined();
      expect(result.dateRange?.from).toBeDefined();
      expect(result.dateRange?.to).toBeDefined();
    });
  });

  describe("extractPromptIntent", () => {
    it("should detect origin keywords", () => {
      const intent1 = extractPromptIntent("I want to fly from New York");
      expect(intent1.hasOrigin).toBe(true);

      const intent2 = extractPromptIntent("Leaving San Francisco next week");
      expect(intent2.hasOrigin).toBe(true);
    });

    it("should detect destination keywords", () => {
      const intent1 = extractPromptIntent("I want to go to Paris");
      expect(intent1.hasDestination).toBe(true);

      const intent2 = extractPromptIntent("Going to London");
      expect(intent2.hasDestination).toBe(true);
    });

    it("should detect budget mentions", () => {
      const intent1 = extractPromptIntent("Under $500");
      expect(intent1.hasBudget).toBe(true);

      const intent2 = extractPromptIntent("My budget is limited");
      expect(intent2.hasBudget).toBe(true);
    });

    it("should detect date mentions", () => {
      const intent1 = extractPromptIntent("Next week");
      expect(intent1.hasDates).toBe(true);

      const intent2 = extractPromptIntent("In March");
      expect(intent2.hasDates).toBe(true);

      const intent3 = extractPromptIntent("2025-03-15");
      expect(intent3.hasDates).toBe(true);
    });

    it("should detect inspiration requests", () => {
      const intent1 = extractPromptIntent("Take me anywhere");
      expect(intent1.needsInspiration).toBe(true);

      const intent2 = extractPromptIntent("Surprise me");
      expect(intent2.needsInspiration).toBe(true);

      const intent3 = extractPromptIntent("Recommend something");
      expect(intent3.needsInspiration).toBe(true);
    });
  });

  describe("PlannerCache", () => {
    it("should store and retrieve values", () => {
      const cache = new PlannerCache(10000);
      cache.set("key1", { data: "test" });

      expect(cache.has("key1")).toBe(true);
      expect(cache.get("key1")).toEqual({ data: "test" });
    });

    it("should return undefined for missing keys", () => {
      const cache = new PlannerCache(10000);
      expect(cache.get("nonexistent")).toBeUndefined();
      expect(cache.has("nonexistent")).toBe(false);
    });

    it("should track cache size", () => {
      const cache = new PlannerCache(10000);
      expect(cache.size()).toBe(0);

      cache.set("key1", "value1");
      expect(cache.size()).toBe(1);

      cache.set("key2", "value2");
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it("should auto-expire entries after TTL", async () => {
      const cache = new PlannerCache(100); // 100ms TTL
      cache.set("key1", "value1");

      expect(cache.has("key1")).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.has("key1")).toBe(false);
    });
  });

  describe("generateSearchCacheKey", () => {
    it("should generate consistent keys for same filters", () => {
      const filters1 = {
        segments: [
          { origin: "JFK", destination: "LAX", departureDate: "2025-03-01" },
        ],
        dateRange: { from: "2025-03-01", to: "2025-03-07" },
      };

      const filters2 = {
        segments: [
          { origin: "JFK", destination: "LAX", departureDate: "2025-03-01" },
        ],
        dateRange: { from: "2025-03-01", to: "2025-03-07" },
      };

      const key1 = generateSearchCacheKey(filters1);
      const key2 = generateSearchCacheKey(filters2);

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different filters", () => {
      const filters1 = {
        segments: [
          { origin: "JFK", destination: "LAX", departureDate: "2025-03-01" },
        ],
      };

      const filters2 = {
        segments: [
          { origin: "LAX", destination: "JFK", departureDate: "2025-03-01" },
        ],
      };

      const key1 = generateSearchCacheKey(filters1);
      const key2 = generateSearchCacheKey(filters2);

      expect(key1).not.toBe(key2);
    });
  });
});

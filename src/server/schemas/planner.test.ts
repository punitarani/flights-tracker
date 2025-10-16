import { describe, expect, it } from "bun:test";
import { PlanItineraryInputSchema } from "./planner";

describe("planner schemas", () => {
  describe("PlanItineraryInputSchema", () => {
    it("should validate valid input with prompt only", () => {
      const input = {
        prompt: "Find me a flight from NYC to LA",
      };

      const result = PlanItineraryInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should validate valid input with filters", () => {
      const input = {
        prompt: "Find me a flight",
        filters: {
          origin: "JFK",
          destination: "LAX",
          dateFrom: "2025-03-01",
          dateTo: "2025-03-07",
          maxPrice: 500,
        },
      };

      const result = PlanItineraryInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject empty prompt", () => {
      const input = {
        prompt: "",
      };

      const result = PlanItineraryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject prompt that's too long", () => {
      const input = {
        prompt: "a".repeat(1001),
      };

      const result = PlanItineraryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid airport codes", () => {
      const input = {
        prompt: "test",
        filters: {
          origin: "JFKK", // 4 letters - invalid
          destination: "LA", // 2 letters - invalid
        },
      };

      const result = PlanItineraryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const input = {
        prompt: "test",
        filters: {
          dateFrom: "2025/03/01", // Wrong format
        },
      };

      const result = PlanItineraryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject negative maxPrice", () => {
      const input = {
        prompt: "test",
        filters: {
          maxPrice: -100,
        },
      };

      const result = PlanItineraryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should allow partial filters", () => {
      const input1 = {
        prompt: "test",
        filters: {
          origin: "JFK",
        },
      };

      const result1 = PlanItineraryInputSchema.safeParse(input1);
      expect(result1.success).toBe(true);

      const input2 = {
        prompt: "test",
        filters: {
          maxPrice: 500,
        },
      };

      const result2 = PlanItineraryInputSchema.safeParse(input2);
      expect(result2.success).toBe(true);
    });
  });
});

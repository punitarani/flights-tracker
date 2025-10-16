import { beforeEach, describe, expect, it, mock } from "bun:test";

process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? "test-api-key";
process.env.RESEND_FROM_EMAIL = "alerts@example.com";

const sendWithResendMock = mock(() =>
  Promise.resolve({
    data: { id: "email_123" },
    error: null,
  }),
);

mock.module("../resend-client", () => ({
  sendWithResend: sendWithResendMock,
}));

import type { FlightOptionSummary } from "@/lib/notifications";
import {
  renderDailyPriceUpdateEmail,
  renderPriceDropAlertEmail,
  sendNotificationEmail,
} from "@/lib/notifications";

const baseAlert = {
  id: "alt-123",
  label: "NYC weekend getaway",
  origin: "JFK",
  destination: "LAX",
  seatType: "Economy",
  stops: "Nonstop",
  airlines: ["AA"],
  priceLimit: { amount: 350, currency: "USD" },
};

const sampleFlight: FlightOptionSummary = {
  totalPrice: 280,
  currency: "USD",
  slices: [
    {
      durationMinutes: 390,
      stops: 0,
      price: 280,
      legs: [
        {
          airlineCode: "AA",
          airlineName: "American Airlines",
          flightNumber: "101",
          departureAirportCode: "JFK",
          departureAirportName: "John F. Kennedy International",
          departureDateTime: "2024-10-05T10:00:00.000Z",
          arrivalAirportCode: "LAX",
          arrivalAirportName: "Los Angeles International",
          arrivalDateTime: "2024-10-05T15:30:00.000Z",
          durationMinutes: 330,
        },
      ],
    },
  ],
};

beforeEach(() => {
  sendWithResendMock.mockReset();
});

describe("notification templates", () => {
  it("renders daily price update email", () => {
    const result = renderDailyPriceUpdateEmail({
      type: "daily-price-update",
      summaryDate: "2024-10-05T00:00:00.000Z",
      alerts: [
        {
          alert: baseAlert,
          flights: [sampleFlight],
          generatedAt: "2024-10-05T08:00:00.000Z",
        },
      ],
    });

    expect(result.subject).toContain("Daily update");
    expect(result.html).toContain("JFK → LAX");
    expect(result.text).not.toContain("<div");
  });

  it("renders price drop alert email with price change", () => {
    const result = renderPriceDropAlertEmail({
      type: "price-drop-alert",
      alert: baseAlert,
      flights: [sampleFlight],
      detectedAt: "2024-10-05T09:00:00.000Z",
      previousLowestPrice: { amount: 420, currency: "USD" },
      newLowestPrice: { amount: 280, currency: "USD" },
    });

    expect(result.subject).toContain("Price drop");
    expect(result.html).toContain("New low price");
    expect(result.html).toContain("JFK");
  });
});

describe("sendNotificationEmail", () => {
  it("delegates to Resend with formatted payload", async () => {
    await sendNotificationEmail({
      recipient: { email: "test@example.com", name: "Test User" },
      payload: {
        type: "price-drop-alert",
        alert: baseAlert,
        flights: [sampleFlight],
        detectedAt: "2024-10-05T09:00:00.000Z",
      },
    });

    expect(sendWithResendMock).toHaveBeenCalledTimes(1);
    const args = sendWithResendMock.mock.calls[0]?.[0];
    expect(args?.from).toBe("Flight Alerts <alerts@resend.dev>");
    expect(args?.to).toBe("Test User <test@example.com>");
    expect(args?.html).toContain("Price drop");
  });
});

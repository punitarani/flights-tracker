import type {
  FlightOptionSummary,
  NotificationEmailPayload,
} from "@/lib/notifications";
import { sendNotificationEmail } from "@/lib/notifications";

const [recipientEmail, templateArg] = process.argv.slice(2);

if (!recipientEmail) {
  console.error(
    "Usage: bun run tsx scripts/send-email.ts <recipient-email> [daily|price-drop]",
  );
  process.exit(1);
}

const template = templateArg === "price-drop" ? "price-drop" : "daily";

const now = new Date();

const sampleFlight: FlightOptionSummary = {
  totalPrice: 219,
  currency: "USD",
  slices: [
    {
      durationMinutes: 360,
      stops: 0,
      price: 219,
      legs: [
        {
          airlineCode: "AA",
          airlineName: "American Airlines",
          flightNumber: "100",
          departureAirportCode: "JFK",
          departureAirportName: "John F. Kennedy International",
          departureDateTime: now.toISOString(),
          arrivalAirportCode: "LAX",
          arrivalAirportName: "Los Angeles International",
          arrivalDateTime: new Date(
            now.getTime() + 5 * 60 * 60 * 1000,
          ).toISOString(),
          durationMinutes: 300,
        },
      ],
    },
  ],
};

const baseAlert = {
  id: "alt-demo",
  label: "Weekend NYC → LA",
  origin: "JFK",
  destination: "LAX",
  seatType: "Economy",
  stops: "Nonstop",
  airlines: ["AA"],
  priceLimit: { amount: 250, currency: "USD" },
};

const payload: NotificationEmailPayload =
  template === "price-drop"
    ? {
        type: "price-drop-alert",
        alert: baseAlert,
        flights: [sampleFlight],
        detectedAt: now.toISOString(),
        previousLowestPrice: { amount: 299, currency: "USD" },
        newLowestPrice: { amount: 219, currency: "USD" },
      }
    : {
        type: "daily-price-update",
        summaryDate: now.toISOString(),
        alerts: [
          {
            alert: baseAlert,
            flights: [sampleFlight],
            generatedAt: now.toISOString(),
          },
        ],
      };

await sendNotificationEmail({
  recipient: { email: recipientEmail },
  payload,
})
  .then((response) => {
    console.log("Email queued:", response.data?.id);
  })
  .catch((error) => {
    console.error("Failed to send email:", error);
    process.exitCode = 1;
  });

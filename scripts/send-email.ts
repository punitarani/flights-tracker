import { sendNotificationEmail } from "@/lib/notifications";
import {
  generateDailyDigestBlueprint,
  generatePriceDropBlueprint,
} from "@/lib/notifications/ai-email-agent";
import { buildDailyDigestBlueprintContext } from "@/lib/notifications/ai-email-context";
import { renderDailyPriceUpdateEmail } from "@/lib/notifications/templates/daily-price-update";
import { renderPriceDropAlertEmail } from "@/lib/notifications/templates/price-drop-alert";

const [recipientEmail, templateArg] = process.argv.slice(2);

if (!recipientEmail) {
  console.error(
    "Usage: bun run tsx scripts/send-email.ts <recipient-email> [daily|price-drop]",
  );
  process.exit(1);
}

const template = templateArg === "price-drop" ? "price-drop" : "daily";

async function main() {
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

  const now = new Date().toISOString();

  if (template === "price-drop") {
    const payload = {
      type: "price-drop-alert" as const,
      alert: baseAlert,
      flights: [],
      detectedAt: now,
    };

    const context = buildDailyDigestBlueprintContext({
      type: "daily-price-update",
      summaryDate: now,
      alerts: [],
    });

    const blueprint = await generatePriceDropBlueprint({
      alert: context.alerts[0]?.alert ?? baseAlert,
      flights: [],
    });

    const email = renderPriceDropAlertEmail(payload, { blueprint });

    await sendNotificationEmail({
      recipient: { email: recipientEmail },
      payload,
    });

    console.log("AI-generated price drop email sent to", recipientEmail);
    console.log("Subject:", email.subject);
    return;
  }

  const payload = {
    type: "daily-price-update" as const,
    summaryDate: now,
    alerts: [],
  };

  const context = buildDailyDigestBlueprintContext(payload);
  const blueprint = await generateDailyDigestBlueprint(context);
  const email = renderDailyPriceUpdateEmail(payload, { blueprint });

  await sendNotificationEmail({
    recipient: { email: recipientEmail },
    payload,
  });

  console.log("AI-generated daily digest email sent to", recipientEmail);
  console.log("Subject:", email.subject);
}

await main().catch((error) => {
  console.error("Failed to send email:", error);
  process.exit(1);
});

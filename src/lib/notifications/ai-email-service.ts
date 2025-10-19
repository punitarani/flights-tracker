import {
  generateDailyDigestBlueprint,
  generatePriceDropBlueprint,
} from "./ai-email-agent";
import {
  buildDailyDigestBlueprintContext,
  buildPriceDropBlueprintContext,
} from "./ai-email-context";
import { renderDailyPriceUpdateEmail } from "./templates/daily-price-update";
import { renderPriceDropAlertEmail } from "./templates/price-drop-alert";
import type { DailyPriceUpdateEmail, PriceDropAlertEmail } from "./types";

export async function renderPriceDropEmailWithAI(payload: PriceDropAlertEmail) {
  const context = buildPriceDropBlueprintContext(payload);

  try {
    const blueprint = await generatePriceDropBlueprint(context);
    return renderPriceDropAlertEmail(payload, { blueprint });
  } catch (_error) {
    return renderPriceDropAlertEmail(payload);
  }
}

export async function renderDailyDigestEmailWithAI(
  payload: DailyPriceUpdateEmail,
) {
  const context = buildDailyDigestBlueprintContext(payload);

  try {
    const blueprint = await generateDailyDigestBlueprint(context);
    return renderDailyPriceUpdateEmail(payload, { blueprint });
  } catch (_error) {
    return renderDailyPriceUpdateEmail(payload);
  }
}

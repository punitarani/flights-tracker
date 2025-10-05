import type { FlightOption } from "@/server/services/flights";

export type EmailRecipient = {
  email: string;
  name?: string;
};

export type AlertDescriptor = {
  id: string;
  label: string;
  origin: string;
  destination: string;
  seatType?: string;
  stops?: string;
  airlines?: string[];
  priceLimit?: {
    amount: number;
    currency: string;
  };
};

export type FlightOptionSummary = FlightOption;

export type DailyAlertSummary = {
  alert: AlertDescriptor;
  flights: FlightOptionSummary[];
  generatedAt: string;
};

export type DailyPriceUpdateEmail = {
  type: "daily-price-update";
  summaryDate: string;
  alerts: DailyAlertSummary[];
};

export type PriceDropAlertEmail = {
  type: "price-drop-alert";
  alert: AlertDescriptor;
  flights: FlightOptionSummary[];
  detectedAt: string;
  previousLowestPrice?: {
    amount: number;
    currency: string;
  };
  newLowestPrice?: {
    amount: number;
    currency: string;
  };
};

export type NotificationEmailPayload =
  | DailyPriceUpdateEmail
  | PriceDropAlertEmail;

export type NotificationSendRequest = {
  recipient: EmailRecipient;
  payload: NotificationEmailPayload;
};

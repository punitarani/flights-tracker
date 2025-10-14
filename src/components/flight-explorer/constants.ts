export const PRICE_CHART_CONFIG = {
  price: {
    label: "Price (USD)",
    color: "var(--chart-1)",
  },
} as const;

export const AWARD_CHART_CONFIG = {
  economy: {
    label: "Economy",
    color: "var(--chart-1)",
  },
  business: {
    label: "Business",
    color: "var(--chart-2)",
  },
  first: {
    label: "First",
    color: "var(--chart-3)",
  },
  premiumEconomy: {
    label: "Premium Economy",
    color: "var(--chart-4)",
  },
} as const;

export const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const MILEAGE_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export const SEARCH_WINDOW_OPTIONS = [30, 60, 90, 120, 150] as const;
export const DEFAULT_SEARCH_WINDOW_DAYS = 90;

export const MAX_SEARCH_DAYS =
  SEARCH_WINDOW_OPTIONS[SEARCH_WINDOW_OPTIONS.length - 1];

export type FlightPricePoint = {
  date: string;
  price: number;
};

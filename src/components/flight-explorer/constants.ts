export const PRICE_CHART_CONFIG = {
  price: {
    label: "Price (USD)",
    color: "var(--chart-1)",
  },
} as const;

export const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const SEARCH_WINDOW_OPTIONS = [30, 60, 90, 120, 150, 180] as const;
export const DEFAULT_SEARCH_WINDOW_DAYS = 90;

export const MAX_SEARCH_DAYS =
  SEARCH_WINDOW_OPTIONS[SEARCH_WINDOW_OPTIONS.length - 1];

export type FlightPricePoint = {
  date: string;
  price: number;
};

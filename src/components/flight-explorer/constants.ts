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

export const MAX_SEARCH_DAYS = 90;

export type FlightPricePoint = {
  date: string;
  price: number;
};

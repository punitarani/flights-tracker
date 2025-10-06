import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ImageResponse } from "next/og";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { OG_IMAGE_SIZE, OgCard } from "@/lib/og/card";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

type SearchParamSource =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | ReadonlyURLSearchParams
  | undefined;

type SearchOgParams = {
  searchParams?: SearchParamSource;
};

const DEFAULT_WINDOW_DAYS = 60;

function hasGetMethod(
  value: SearchParamSource,
): value is URLSearchParams | ReadonlyURLSearchParams {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof value.get === "function"
  );
}

function getParam(source: SearchParamSource, key: string): string | null {
  if (!source) return null;

  if (hasGetMethod(source)) {
    const value = source.get(key);
    return value ?? null;
  }

  const record = source as Record<string, string | string[] | undefined>;
  const value = record?.[key];
  if (!value) return null;

  if (Array.isArray(value)) {
    return value.length > 0 ? (value[0] ?? null) : null;
  }

  return value;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clampWindowDays(value: number | null): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_WINDOW_DAYS;
  if (value < 7) return 7;
  if (value > 120) return 120;
  return Math.round(value);
}

function generatePriceSeries(days: number): number[] {
  const points: number[] = [];
  for (let index = 0; index < days; index += 1) {
    const progress = days > 1 ? index / (days - 1) : 0;
    const seasonal = Math.sin(progress * Math.PI * 1.6) * 55;
    const trend = Math.cos(progress * Math.PI * 0.8) * 35;
    const base = 280 + progress * 90;
    const noise = Math.sin(progress * 17) * 12;
    points.push(Math.round(base + seasonal + trend + noise));
  }
  return points;
}

function buildChartPath(
  values: number[],
  width: number,
  height: number,
): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const coordinates = values.map((value, index) => {
    const x = Math.round(index * step * 100) / 100;
    const normalized = (value - min) / range;
    const y = Math.round((height - normalized * height) * 100) / 100;
    return `${x},${y}`;
  });

  return coordinates.join(" ");
}

function getDateRange(
  start: Date | null,
  end: Date | null,
  windowDays: number,
): { from: Date; to: Date; windowDays: number } {
  if (start && end) {
    const computedWindow = Math.max(
      1,
      differenceInCalendarDays(end, start) + 1,
    );
    return { from: start, to: end, windowDays: computedWindow };
  }

  const today = new Date();
  const rangeStart = start ?? today;
  const rangeEnd = end ?? addDays(rangeStart, windowDays - 1);
  return {
    from: rangeStart,
    to: rangeEnd,
    windowDays,
  };
}

export default function SearchOpenGraphImage({ searchParams }: SearchOgParams) {
  const origin = getParam(searchParams, "origin")?.toUpperCase() ?? null;
  const destination =
    getParam(searchParams, "destination")?.toUpperCase() ?? null;
  const rawWindow = Number.parseInt(
    getParam(searchParams, "searchWindowDays") ?? "",
    10,
  );

  const dateFrom = parseDate(getParam(searchParams, "dateFrom"));
  const dateTo = parseDate(getParam(searchParams, "dateTo"));

  const windowDays = clampWindowDays(
    Number.isFinite(rawWindow) ? rawWindow : null,
  );

  const {
    from,
    to,
    windowDays: effectiveWindow,
  } = getDateRange(dateFrom, dateTo, windowDays);

  const prices = generatePriceSeries(effectiveWindow);
  const chartWidth = 900;
  const chartHeight = 260;
  const chartPath = buildChartPath(prices, chartWidth, chartHeight);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minIndex = prices.indexOf(minPrice);
  const minX =
    prices.length > 1 ? (minIndex / (prices.length - 1)) * chartWidth : 0;
  const minY = (() => {
    const range = maxPrice - minPrice || 1;
    const normalized = (minPrice - minPrice) / range;
    return chartHeight - normalized * chartHeight;
  })();

  const routeLabel =
    origin && destination
      ? `${origin} → ${destination}`
      : "Smart route insights";
  const windowLabel = `${effectiveWindow}-day fare outlook`;
  const dateRangeLabel = `${format(from, "MMM d")} – ${format(to, "MMM d")}`;

  return new ImageResponse(
    <OgCard
      badge={routeLabel}
      title={windowLabel}
      subtitle={`Lowest fares dip to $${minPrice.toLocaleString()} | High of $${maxPrice.toLocaleString()}`}
      footer={dateRangeLabel}
    >
      <div
        style={{
          marginTop: 36,
          padding: "32px",
          borderRadius: 36,
          background: "rgba(15, 23, 42, 0.55)",
          border: "1px solid rgba(148, 163, 184, 0.25)",
          backdropFilter: "blur(18px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
          }}
        >
          <span>Fare trend simulation</span>
          <span>USD</span>
        </div>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          width={chartWidth}
          height={chartHeight}
          style={{ width: "100%", height: "100%" }}
        >
          <title>Flight fare trend chart</title>
          <defs>
            <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="rgba(96, 165, 250, 0.6)" />
              <stop offset="95%" stopColor="rgba(59, 130, 246, 0.05)" />
            </linearGradient>
          </defs>
          <polyline
            points={`0,${chartHeight} ${chartPath} ${chartWidth},${chartHeight}`}
            fill="url(#trendFill)"
            stroke="none"
          />
          <polyline
            points={chartPath}
            fill="none"
            stroke="rgba(96, 165, 250, 0.95)"
            strokeWidth={8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={minX}
            cy={minY}
            r={14}
            fill="#fbbf24"
            stroke="rgba(15, 23, 42, 0.85)"
            strokeWidth={8}
          />
        </svg>
        <div style={{ fontSize: 24, color: "rgba(226, 232, 240, 0.85)" }}>
          Highlighting the most affordable day and illustrating the expected
          volatility over the selected window.
        </div>
      </div>
    </OgCard>,
    {
      ...size,
    },
  );
}

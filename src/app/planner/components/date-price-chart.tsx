import { format, parseISO } from "date-fns";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DatePrice } from "../types";

interface DatePriceChartProps {
  dates: DatePrice[];
  cheapestPrice?: number;
  onSelectDate?: (date: DatePrice) => void;
}

const CHART_CONFIG = {
  price: {
    label: "Price (USD)",
    color: "hsl(var(--chart-1))",
  },
} as const;

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatChartDate(dateStr: string): string {
  try {
    // Handle round-trip dates (contains " - ")
    if (dateStr.includes(" - ")) {
      const [departDate] = dateStr.split(" - ");
      if (departDate) {
        const parsed = parseISO(departDate);
        if (!Number.isNaN(parsed.getTime())) {
          return format(parsed, "MMM d");
        }
      }
      return dateStr;
    }

    // Handle single date
    const parsed = parseISO(dateStr);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, "MMM d");
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function DatePriceChart({
  dates,
  cheapestPrice,
  onSelectDate,
}: DatePriceChartProps) {
  if (dates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No dates found in this range.</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = dates.map((datePrice) => ({
    date: datePrice.departureDate ?? datePrice.date,
    price: datePrice.price,
    formattedDate: formatChartDate(datePrice.departureDate ?? datePrice.date),
    isCheapest: datePrice.price === cheapestPrice,
    original: datePrice,
  }));

  // Find min/max for Y-axis domain
  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const yAxisMin = Math.max(0, Math.floor(minPrice - priceRange * 0.1));
  const yAxisMax = Math.ceil(maxPrice + priceRange * 0.1);

  return (
    <div className="space-y-4">
      {/* Summary */}
      {cheapestPrice && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {dates.length} {dates.length === 1 ? "date" : "dates"} available
          </span>
          <span className="font-semibold text-green-600">
            Best Price: {USD_FORMATTER.format(cheapestPrice)}
          </span>
        </div>
      )}

      {/* Line Chart */}
      <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
        <LineChart
          data={chartData}
          margin={{ left: 12, right: 12 }}
          onClick={(data) => {
            if (data?.activePayload?.[0]?.payload?.original && onSelectDate) {
              onSelectDate(data.activePayload[0].payload.original);
            }
          }}
          className={onSelectDate ? "cursor-pointer" : ""}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="formattedDate"
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis
            dataKey="price"
            tickLine={false}
            axisLine={false}
            width={56}
            domain={[yAxisMin, yAxisMax]}
            tickFormatter={(value: number) => USD_FORMATTER.format(value)}
          />
          <ChartTooltip
            cursor={{ strokeDasharray: "4 4" }}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => {
                  const dataPoint = chartData.find(
                    (d) => d.formattedDate === value,
                  );
                  if (
                    dataPoint?.original.departureDate &&
                    dataPoint.original.returnDate
                  ) {
                    return `${formatChartDate(dataPoint.original.departureDate)} - ${formatChartDate(dataPoint.original.returnDate)}`;
                  }
                  return value;
                }}
                formatter={(value) => [
                  USD_FORMATTER.format(value as number),
                  "Price",
                ]}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--color-price)"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const isCheapest = payload.isCheapest;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isCheapest ? 6 : 4}
                  fill={
                    isCheapest ? "hsl(var(--chart-2))" : "var(--color-price)"
                  }
                  stroke={
                    isCheapest ? "hsl(var(--chart-2))" : "var(--color-price)"
                  }
                  strokeWidth={isCheapest ? 3 : 2}
                />
              );
            }}
          />
        </LineChart>
      </ChartContainer>

      {/* Legend */}
      <div className="text-xs text-muted-foreground text-center">
        {onSelectDate
          ? "Click a point on the chart to select that date"
          : "Hover over points to see details"}
      </div>
    </div>
  );
}

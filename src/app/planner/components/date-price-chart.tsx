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
    color: "var(--chart-1)",
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
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p className="text-sm">No dates found in this range.</p>
      </div>
    );
  }

  // Prepare chart data and sort chronologically
  const chartData = dates
    .map((datePrice) => ({
      date: datePrice.departureDate ?? datePrice.date,
      price: datePrice.price,
      formattedDate: formatChartDate(datePrice.departureDate ?? datePrice.date),
      isCheapest: datePrice.price === cheapestPrice,
      original: datePrice,
    }))
    .sort((a, b) => {
      try {
        // Parse dates for comparison
        const dateA = parseISO(a.date);
        const dateB = parseISO(b.date);

        // Sort chronologically
        return dateA.getTime() - dateB.getTime();
      } catch {
        // If parsing fails, maintain original order
        return 0;
      }
    });

  // Find min/max for Y-axis domain
  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const yAxisMin = Math.max(0, Math.floor(minPrice - priceRange * 0.1));
  const yAxisMax = Math.ceil(maxPrice + priceRange * 0.1);

  return (
    <div className="space-y-2">
      {/* Summary */}
      {cheapestPrice && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {dates.length} {dates.length === 1 ? "date" : "dates"} available
          </span>
          <span className="font-semibold text-green-600">
            Best: {USD_FORMATTER.format(cheapestPrice)}
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
            dot={{ r: 3, cursor: "pointer" }}
            activeDot={{ r: 5, cursor: "pointer" }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

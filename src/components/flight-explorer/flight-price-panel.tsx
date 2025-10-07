"use client";

import { addDays, addYears, format, parseISO, startOfDay } from "date-fns";
import { CalendarIcon, Loader2, LogIn, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { renderAlertCreatedToast } from "@/components/alerts/alert-created-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getDefaultAlertDateRange } from "@/core/alert-defaults";
import { serializeTimeRangeForAlert } from "@/core/alert-filter-utils";
import { AlertType } from "@/core/alert-types";
import type { AlertFilters } from "@/core/filters";
import type {
  FlightExplorerFiltersState,
  FlightExplorerPriceState,
  TimeRangeValue,
} from "@/hooks/use-flight-explorer";
import {
  DEFAULT_TIME_RANGE,
  isFullDayTimeRange,
} from "@/hooks/use-flight-explorer";
import { useIsMobile } from "@/hooks/use-mobile";
import { MaxStops, SeatType } from "@/lib/fli/models";
import { createClient } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/react";
import type { AirportData } from "@/server/services/airports";
import { PRICE_CHART_CONFIG, USD_FORMATTER } from "./constants";
import { FlightFiltersPanel } from "./flight-filters-panel";
import { FlightOptionsList } from "./flight-options-list";

type FlightPricePanelProps = {
  state: FlightExplorerPriceState;
  filters: FlightExplorerFiltersState;
  originAirport: AirportData | null;
  destinationAirport: AirportData | null;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const SEAT_TYPE_VALUE_MAP: Record<
  SeatType,
  "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST"
> = {
  [SeatType.ECONOMY]: "ECONOMY",
  [SeatType.PREMIUM_ECONOMY]: "PREMIUM_ECONOMY",
  [SeatType.BUSINESS]: "BUSINESS",
  [SeatType.FIRST]: "FIRST",
};

const SEAT_TYPE_LABEL_MAP: Record<SeatType, string> = {
  [SeatType.ECONOMY]: "Economy",
  [SeatType.PREMIUM_ECONOMY]: "Premium Economy",
  [SeatType.BUSINESS]: "Business",
  [SeatType.FIRST]: "First",
};

const STOP_VALUE_MAP: Record<
  MaxStops,
  "ANY" | "NONSTOP" | "ONE_STOP" | "TWO_STOPS"
> = {
  [MaxStops.ANY]: "ANY",
  [MaxStops.NON_STOP]: "NONSTOP",
  [MaxStops.ONE_STOP_OR_FEWER]: "ONE_STOP",
  [MaxStops.TWO_OR_FEWER_STOPS]: "TWO_STOPS",
};

const STOP_LABEL_MAP: Record<MaxStops, string> = {
  [MaxStops.ANY]: "Any",
  [MaxStops.NON_STOP]: "Nonstop",
  [MaxStops.ONE_STOP_OR_FEWER]: "Up to 1 stop",
  [MaxStops.TWO_OR_FEWER_STOPS]: "Up to 2 stops",
};

function formatHourLabel(hourValue: number) {
  if (hourValue >= 24) return "11:59 PM";
  const rounded = Math.max(0, Math.min(23, Math.round(hourValue)));
  const suffix = rounded >= 12 ? "PM" : "AM";
  const normalized = rounded % 12 === 0 ? 12 : rounded % 12;
  return `${normalized} ${suffix}`;
}

function formatTimeRange(range: TimeRangeValue | null | undefined) {
  if (isFullDayTimeRange(range)) {
    return "12 AM – 11:59 PM";
  }

  const value = range ?? DEFAULT_TIME_RANGE;
  return `${formatHourLabel(value.from)} – ${formatHourLabel(value.to)}`;
}

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function FlightPricePanel({
  state,
  filters,
  originAirport,
  destinationAirport,
}: FlightPricePanelProps) {
  const {
    shouldShowPanel,
    chartData,
    cheapestEntry,
    searchError,
    isSearching,
    searchWindowDays,
    selectedDate,
    selectedPriceIndex,
    flightOptions,
    isFlightOptionsLoading,
    flightOptionsError,
    canRefetch,
    onRefetch,
    onSelectDate,
  } = state;

  const isMobile = useIsMobile();
  const defaultAlertRange = useMemo(() => getDefaultAlertDateRange(), []);
  const defaultRangeStart = defaultAlertRange.start;
  const defaultRangeEnd = defaultAlertRange.end;
  const [alertDateRange, setAlertDateRange] = useState<DateRange>({
    from: filters.dateRange?.from ?? defaultRangeStart,
    to: filters.dateRange?.to ?? defaultRangeEnd,
  });
  const minSelectableDate = useMemo(
    () => startOfDay(addDays(new Date(), 1)),
    [],
  );
  const maxSelectableDate = useMemo(
    () => startOfDay(addYears(minSelectableDate, 1)),
    [minSelectableDate],
  );
  const minMaxDescription = useMemo(
    () =>
      `${format(minSelectableDate, "MMM d, yyyy")} – ${format(maxSelectableDate, "MMM d, yyyy")}`,
    [maxSelectableDate, minSelectableDate],
  );

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSheetOpen) {
      return;
    }

    setAlertDateRange({
      from: filters.dateRange?.from ?? defaultRangeStart,
      to: filters.dateRange?.to ?? defaultRangeEnd,
    });
  }, [
    defaultRangeEnd,
    defaultRangeStart,
    filters.dateRange?.from,
    filters.dateRange?.to,
    isSheetOpen,
  ]);

  const createAlertMutation = trpc.useMutation(["alerts.create"], {
    onSuccess: () => {
      toast.custom(renderAlertCreatedToast, { duration: 6000 });
      setIsSheetOpen(false);
    },
    onError: (error) => {
      const message =
        (error instanceof Error && error.message) ||
        (typeof error?.message === "string" && error.message) ||
        "Unable to create alert. Please try again.";
      toast.error(message);
    },
  });

  useEffect(() => {
    if (!isSheetOpen || userEmail) {
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setUserEmail(data.user?.email ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUserEmail(session?.user?.email ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [isSheetOpen, userEmail]);

  const travelDateState = useMemo(() => {
    const start = alertDateRange?.from ?? defaultRangeStart;
    const endCandidate =
      alertDateRange?.to ??
      (alertDateRange?.from ? alertDateRange.from : defaultRangeEnd);
    const normalizedEnd = endCandidate < start ? start : endCandidate;
    const complete = Boolean(alertDateRange?.from && alertDateRange?.to);

    let label = `${format(start, "MMM d, yyyy")} – ${format(normalizedEnd, "MMM d, yyyy")}`;
    if (!complete && alertDateRange?.from) {
      label = `${format(start, "MMM d, yyyy")} – Select end date`;
    }

    return {
      start,
      end: normalizedEnd,
      label,
      complete,
    };
  }, [alertDateRange, defaultRangeEnd, defaultRangeStart]);

  const { alertPayload, filterSummary } = useMemo(() => {
    if (!originAirport || !destinationAirport) {
      return {
        alertPayload: null,
        filterSummary: [] as Array<{ label: string; value: string }>,
      };
    }

    const items: Array<{ label: string; value: string }> = [];
    const criteria: AlertFilters["filters"] = {};

    if (filters.stops !== MaxStops.ANY) {
      const stopValue = STOP_VALUE_MAP[filters.stops];
      criteria.stops = stopValue;
      items.push({ label: "Stops", value: STOP_LABEL_MAP[filters.stops] });
    }

    if (filters.seatType !== SeatType.ECONOMY) {
      const seatClass = SEAT_TYPE_VALUE_MAP[filters.seatType];
      criteria.class = seatClass;
      items.push({
        label: "Cabin",
        value: SEAT_TYPE_LABEL_MAP[filters.seatType],
      });
    }

    if (filters.airlines.length > 0) {
      criteria.airlines = [...filters.airlines];
      items.push({ label: "Airlines", value: filters.airlines.join(", ") });
    }

    if (filters.daysOfWeek.length > 0) {
      const dayNames = filters.daysOfWeek
        .slice()
        .sort((a, b) => a - b)
        .map((day) => DAY_NAMES[day] ?? null)
        .filter((day): day is (typeof DAY_NAMES)[number] => Boolean(day))
        .join(", ");
      if (dayNames) {
        items.push({ label: "Days", value: dayNames });
      }
    }

    if (!isFullDayTimeRange(filters.departureTimeRange)) {
      const storedDeparture = serializeTimeRangeForAlert(
        filters.departureTimeRange,
        DEFAULT_TIME_RANGE,
      );
      if (storedDeparture) {
        criteria.departureTimeRange = storedDeparture;
      }
      items.push({
        label: "Departure time",
        value: formatTimeRange(filters.departureTimeRange),
      });
    }

    if (!isFullDayTimeRange(filters.arrivalTimeRange)) {
      const storedArrival = serializeTimeRangeForAlert(
        filters.arrivalTimeRange,
        DEFAULT_TIME_RANGE,
      );
      if (storedArrival) {
        criteria.arrivalTimeRange = storedArrival;
      }
      items.push({
        label: "Arrival time",
        value: formatTimeRange(filters.arrivalTimeRange),
      });
    }

    if (!travelDateState.complete) {
      return {
        alertPayload: null,
        filterSummary: items,
      };
    }

    const payload: AlertFilters = {
      version: 1,
      route: {
        from: originAirport.iata,
        to: destinationAirport.iata,
      },
      filters: {
        ...criteria,
        dateFrom: toIsoDate(travelDateState.start),
        dateTo: toIsoDate(travelDateState.end),
      },
    };

    return {
      alertPayload: payload,
      filterSummary: items,
    };
  }, [destinationAirport, filters, originAirport, travelDateState]);

  const handleAlertDateRangeSelect = useCallback(
    (range: DateRange | undefined) => {
      if (!range || !range.from) {
        setAlertDateRange({
          from: defaultRangeStart,
          to: defaultRangeEnd,
        });
        return;
      }

      let nextFrom = startOfDay(range.from);
      let nextTo = range.to ? startOfDay(range.to) : nextFrom;

      if (nextFrom < minSelectableDate) {
        nextFrom = minSelectableDate;
      }
      if (nextFrom > maxSelectableDate) {
        nextFrom = maxSelectableDate;
      }

      if (nextTo < minSelectableDate) {
        nextTo = minSelectableDate;
      }
      if (nextTo > maxSelectableDate) {
        nextTo = maxSelectableDate;
      }

      if (nextTo < nextFrom) {
        nextTo = nextFrom;
      }

      setAlertDateRange({ from: nextFrom, to: nextTo });
    },
    [defaultRangeEnd, defaultRangeStart, maxSelectableDate, minSelectableDate],
  );

  const handleCreateAlert = useCallback(() => {
    if (!alertPayload) {
      toast.error(
        "Select an origin, destination, and travel dates to create an alert.",
      );
      return;
    }

    createAlertMutation.mutate({
      type: AlertType.DAILY,
      filters: alertPayload,
    });
  }, [alertPayload, createAlertMutation]);

  if (!shouldShowPanel) {
    return null;
  }

  const firstChartDate = chartData.length ? parseISO(chartData[0].date) : null;
  const lastChartDate = chartData.length
    ? parseISO(chartData[chartData.length - 1].date)
    : null;

  const currentSelection =
    selectedPriceIndex !== null && chartData[selectedPriceIndex]
      ? chartData[selectedPriceIndex]
      : null;

  const canOpenCreate = Boolean(originAirport && destinationAirport);
  const emailDisplay = userEmail ?? "your account email";
  const createDisabled =
    !alertPayload || createAlertMutation.isLoading || !canOpenCreate;
  const sheetCloseHiddenClass = "[&>[data-slot=sheet-close]]:hidden";
  const sheetClassName = isMobile
    ? `flex h-[85vh] w-full flex-col ${sheetCloseHiddenClass}`
    : `flex w-full flex-col sm:max-w-md ${sheetCloseHiddenClass}`;

  return (
    <div className="h-full w-full overflow-auto bg-muted/10">
      <div className="container mx-auto flex flex-col gap-4 p-4">
        <FlightFiltersPanel
          filters={filters}
          price={{ isSearching, canRefetch, onRefetch }}
        />

        <Card className="space-y-6 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Cheapest fares over the next {searchWindowDays} days
              </p>
              {cheapestEntry && (
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(cheapestEntry.date), "MMM d")} •{" "}
                  {USD_FORMATTER.format(cheapestEntry.price)}
                </p>
              )}
              {!cheapestEntry && !isSearching && !searchError && (
                <p className="text-xs text-muted-foreground">
                  No fares found for this route.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isSearching ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              ) : null}
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="gap-2 font-semibold"
                    disabled={!canOpenCreate}
                  >
                    + Create Alert
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side={isMobile ? "bottom" : "right"}
                  className={sheetClassName}
                >
                  <SheetHeader className="flex-row items-center justify-between gap-2 px-4 pt-6">
                    <SheetTitle className="text-base font-semibold">
                      Create alert
                    </SheetTitle>
                    <SheetClose asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Close</span>
                      </Button>
                    </SheetClose>
                  </SheetHeader>
                  <div className="flex flex-1 flex-col gap-4 overflow-auto px-4">
                    {userEmail ? (
                      <>
                        <div className="space-y-2">
                          <div className="rounded-md border bg-background p-3 text-sm">
                            {originAirport && destinationAirport ? (
                              <div className="space-y-3">
                                <div>
                                  <p className="font-medium">
                                    {originAirport.name} ({originAirport.iata})
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {[originAirport.city, originAirport.country]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                </div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  to
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {destinationAirport.name} (
                                    {destinationAirport.iata})
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {[
                                      destinationAirport.city,
                                      destinationAirport.country,
                                    ]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Select an origin and destination to continue.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">
                            Travel dates
                          </h4>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start gap-2 text-left font-medium"
                              >
                                <CalendarIcon
                                  className="h-4 w-4 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate text-sm">
                                  {travelDateState.label}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-auto p-0"
                            >
                              <Calendar
                                mode="range"
                                numberOfMonths={isMobile ? 1 : 2}
                                defaultMonth={travelDateState.start}
                                selected={alertDateRange}
                                onSelect={handleAlertDateRangeSelect}
                                fromDate={minSelectableDate}
                                toDate={maxSelectableDate}
                                disabled={(date) => {
                                  const current = startOfDay(date);
                                  return (
                                    current < minSelectableDate ||
                                    current > maxSelectableDate
                                  );
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-muted-foreground">
                            Choose any range between {minMaxDescription} for
                            your alert window.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">
                            Additional filters
                          </h4>
                          {filterSummary.length > 0 ? (
                            <ul className="space-y-2 text-sm">
                              {filterSummary.map((item) => (
                                <li
                                  key={item.label}
                                  className="flex items-start justify-between gap-3"
                                >
                                  <span className="text-muted-foreground">
                                    {item.label}
                                  </span>
                                  <span className="text-right font-medium">
                                    {item.value}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No additional filters selected.
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
                        <div className="text-center space-y-4">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <LogIn className="h-6 w-6 text-primary" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold">
                              Login Required
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                              To create price alerts and receive notifications
                              about fare changes, you'll need to sign in to your
                              account.
                            </p>
                          </div>
                        </div>
                        <Button asChild className="gap-2">
                          <Link
                            href="/login"
                            onClick={() => setIsSheetOpen(false)}
                          >
                            <LogIn className="h-4 w-4" />
                            Sign in to create alerts
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                  {userEmail && (
                    <SheetFooter className="px-4 pb-4">
                      <div className="rounded-md border bg-muted/40 p-3 text-sm leading-relaxed">
                        <p>
                          You agree to receive a daily email notification to{" "}
                          <span className="font-semibold">{emailDisplay}</span>{" "}
                          with the available flight options for your alerts
                          until the day before the flight.
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="w-full gap-2"
                        onClick={handleCreateAlert}
                        disabled={createDisabled}
                      >
                        {createAlertMutation.isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create alert"
                        )}
                      </Button>
                    </SheetFooter>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {searchError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {searchError}
            </div>
          ) : null}

          {chartData.length > 0 && !searchError ? (
            <ChartContainer config={PRICE_CHART_CONFIG} className="h-64 w-full">
              <LineChart
                data={chartData}
                margin={{ left: 12, right: 12 }}
                onClick={(data) => {
                  if (data?.activePayload?.[0]?.payload?.date) {
                    onSelectDate(data.activePayload[0].payload.date);
                  }
                }}
                className="cursor-pointer"
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
                  tickFormatter={(value: number) => USD_FORMATTER.format(value)}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "4 4" }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, items) => {
                        const isoDate = items?.[0]?.payload?.date;
                        if (typeof isoDate === "string") {
                          const parsed = parseISO(isoDate);
                          if (!Number.isNaN(parsed.getTime())) {
                            return format(parsed, "EEE, MMM d");
                          }
                        }
                        const fallback = items?.[0]?.payload?.formattedDate;
                        return typeof fallback === "string" ? fallback : "";
                      }}
                      formatter={(value) =>
                        typeof value === "number"
                          ? USD_FORMATTER.format(value)
                          : (value ?? "")
                      }
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--color-price)"
                  strokeWidth={2}
                  dot={{ r: 2, cursor: "pointer" }}
                  activeDot={{ r: 5, cursor: "pointer" }}
                />
              </LineChart>
            </ChartContainer>
          ) : null}

          {chartData.length === 0 && !searchError ? (
            <p className="text-xs text-muted-foreground">
              Adjust your filters or search window to uncover more fares.
            </p>
          ) : null}
        </Card>

        {chartData.length > 0 && !searchError ? (
          <Card className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Choose a travel date</h4>
                <p className="text-xs text-muted-foreground">
                  Click a date on the chart or pick from the calendar to load
                  detailed flight options.
                </p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 gap-2"
                    disabled={!firstChartDate || !lastChartDate}
                  >
                    <CalendarIcon className="h-4 w-4" aria-hidden="true" />
                    {selectedDate
                      ? format(parseISO(selectedDate), "EEE, MMM d")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate ? parseISO(selectedDate) : undefined}
                    onSelect={(date) => {
                      if (!date) {
                        onSelectDate(null);
                        return;
                      }
                      onSelectDate(toIsoDate(date));
                    }}
                    disabled={(date) => {
                      if (!firstChartDate || !lastChartDate) {
                        return false;
                      }
                      return date < firstChartDate || date > lastChartDate;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {currentSelection ? (
              <div className="flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold">
                    {format(parseISO(currentSelection.date), "EEEE, MMM d")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Calendar fare •{" "}
                    {USD_FORMATTER.format(currentSelection.price)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start sm:self-auto"
                  onClick={() => onSelectDate(null)}
                >
                  Clear selection
                </Button>
              </div>
            ) : null}

            <FlightOptionsList
              options={flightOptions}
              selectedDate={selectedDate}
              isLoading={isFlightOptionsLoading}
              error={flightOptionsError}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { addDays, addYears, format, startOfDay } from "date-fns";
import { CalendarIcon, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { renderAlertCreatedToast } from "@/components/alerts/alert-created-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  TimeRangeValue,
} from "@/hooks/use-flight-explorer";
import {
  DEFAULT_TIME_RANGE,
  isFullDayTimeRange,
} from "@/hooks/use-flight-explorer";
import { useIsMobile } from "@/hooks/use-mobile";
import { MaxStops, SeatType } from "@/lib/fli/models";
import { trpc } from "@/lib/trpc/react";
import type { AirportData } from "@/server/services/airports";

interface CreateAlertSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  originAirport: AirportData | null;
  destinationAirport: AirportData | null;
  filters: FlightExplorerFiltersState;
  userEmail: string;
  trigger: React.ReactNode;
}

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

/**
 * Sheet component for creating flight price alerts
 */
export function CreateAlertSheet({
  isOpen,
  onOpenChange,
  originAirport,
  destinationAirport,
  filters,
  userEmail,
  trigger,
}: CreateAlertSheetProps) {
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

  useEffect(() => {
    if (!isOpen) {
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
    isOpen,
  ]);

  const createAlertMutation = trpc.useMutation(["alerts.create"], {
    onSuccess: () => {
      toast.custom(renderAlertCreatedToast, { duration: 6000 });
      onOpenChange(false);
    },
    onError: (error) => {
      const message =
        (error instanceof Error && error.message) ||
        (typeof error?.message === "string" && error.message) ||
        "Unable to create alert. Please try again.";
      toast.error(message);
    },
  });

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

  const canOpenCreate = Boolean(originAirport && destinationAirport);
  const emailDisplay = userEmail;
  const createDisabled =
    !alertPayload || createAlertMutation.isLoading || !canOpenCreate;
  const sheetCloseHiddenClass = "[&>[data-slot=sheet-close]]:hidden";
  const sheetClassName = isMobile
    ? `flex h-[85vh] w-full flex-col ${sheetCloseHiddenClass}`
    : `flex w-full flex-col sm:max-w-md ${sheetCloseHiddenClass}`;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
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
                      {destinationAirport.name} ({destinationAirport.iata})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[destinationAirport.city, destinationAirport.country]
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
            <h4 className="text-sm font-semibold">Travel dates</h4>
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
              <PopoverContent align="start" className="w-auto p-0">
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
                      current < minSelectableDate || current > maxSelectableDate
                    );
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Choose any range between {minMaxDescription} for your alert
              window.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Additional filters</h4>
            {filterSummary.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {filterSummary.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-right font-medium">{item.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No additional filters selected.
              </p>
            )}
          </div>
        </div>
        <SheetFooter className="px-4 pb-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm leading-relaxed">
            <p>
              You agree to receive a daily email notification to{" "}
              <span className="font-semibold">{emailDisplay}</span> with the
              available flight options for your alerts until the day before the
              flight.
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
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { Check, Loader2, RefreshCcw, X } from "lucide-react";
import {
  type FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_TIME_RANGE,
  type FlightExplorerFiltersState,
  type FlightExplorerPriceState,
  isFullDayTimeRange,
} from "@/hooks/use-flight-explorer";
import { Airline, MaxStops, SeatType } from "@/lib/fli/models";
import { cn } from "@/lib/utils";
import { DEFAULT_SEARCH_WINDOW_DAYS, SEARCH_WINDOW_OPTIONS } from "./constants";

type FlightFiltersPanelProps = {
  filters: FlightExplorerFiltersState;
  price: Pick<
    FlightExplorerPriceState,
    "isSearching" | "canRefetch" | "onRefetch"
  >;
};

const seatTypeOptions: Array<{ value: SeatType; label: string }> = [
  { value: SeatType.ECONOMY, label: "Economy" },
  { value: SeatType.PREMIUM_ECONOMY, label: "Premium" },
  { value: SeatType.BUSINESS, label: "Business" },
  { value: SeatType.FIRST, label: "First" },
];

const stopOptions: Array<{ value: MaxStops; label: string }> = [
  { value: MaxStops.ANY, label: "Any" },
  { value: MaxStops.NON_STOP, label: "Nonstop" },
  { value: MaxStops.ONE_STOP_OR_FEWER, label: "≤1 stop" },
  { value: MaxStops.TWO_OR_FEWER_STOPS, label: "≤2 stops" },
];

const dayOptions: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const ALL_HOURS_RANGE: [number, number] = [0, 24];

function formatHourLabel(hourValue: number) {
  if (hourValue >= 24) return "11:59 PM";
  const rounded = Math.max(0, Math.min(23, Math.round(hourValue)));
  const suffix = rounded >= 12 ? "PM" : "AM";
  const normalized = rounded % 12 === 0 ? 12 : rounded % 12;
  return `${normalized} ${suffix}`;
}

function formatTimeRange(
  range: { from: number; to: number } | null | undefined,
) {
  if (isFullDayTimeRange(range)) {
    return "12 AM – 11:59 PM";
  }

  const value = range ?? DEFAULT_TIME_RANGE;
  return `${formatHourLabel(value.from)} – ${formatHourLabel(value.to)}`;
}

export function FlightFiltersPanel({
  filters,
  price,
}: FlightFiltersPanelProps) {
  const airlineOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ code: string; name: string }> = [];
    for (const [code, name] of Object.entries(Airline)) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;
      const normalizedCode = code.replace(/^_/, "").toUpperCase();
      if (normalizedCode.length === 0 || normalizedCode.length > 3) continue;
      if (seen.has(normalizedCode)) continue;
      seen.add(normalizedCode);
      list.push({ code: normalizedCode, name: trimmedName });
    }
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, []);

  const airlineNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of airlineOptions) {
      map.set(option.code, option.name);
    }
    return map;
  }, [airlineOptions]);

  const renderAirlineLabel = useCallback(
    (code: string) => {
      const name = airlineNameByCode.get(code);
      return name ? `${code} - ${name}` : code;
    },
    [airlineNameByCode],
  );

  const getAirlineSummaryName = useCallback(
    (code: string) => {
      const name = airlineNameByCode.get(code);
      if (!name) return code;
      return name.replace(/\s+Airlines?$/i, "").trim() || name;
    },
    [airlineNameByCode],
  );

  const renderAirlineSummaryLabel = useCallback(
    (code: string) => `${getAirlineSummaryName(code)} (${code})`,
    [getAirlineSummaryName],
  );

  const formatListWithAnd = (items: string[]) => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  };

  const isDisabled = price.isSearching;
  const [isAirlinePickerOpen, setIsAirlinePickerOpen] = useState(false);
  const [airlineSearch, setAirlineSearch] = useState("");
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  const handleAirlineFocus = useCallback(() => {
    if (!isDisabled) {
      setIsAirlinePickerOpen(true);
    }
  }, [isDisabled]);

  const handleAirlineBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsAirlinePickerOpen(false);
    }
  }, []);

  const handleAirlineSearchChange = useCallback(
    (value: string) => {
      setAirlineSearch(value);
      if (!isDisabled) {
        setIsAirlinePickerOpen(true);
      }
    },
    [isDisabled],
  );

  const handleAirlineClearSearch = useCallback(() => {
    setAirlineSearch("");
    commandInputRef.current?.focus();
  }, []);

  const departureRange = filters.departureTimeRange ?? DEFAULT_TIME_RANGE;
  const arrivalRange = filters.arrivalTimeRange ?? DEFAULT_TIME_RANGE;

  const departureValues: [number, number] = [
    departureRange.from,
    departureRange.to,
  ];

  const arrivalValues: [number, number] = [arrivalRange.from, arrivalRange.to];

  const hasCustomDeparture = !isFullDayTimeRange(departureRange);
  const hasCustomArrival = !isFullDayTimeRange(arrivalRange);

  const departureLabel = formatTimeRange(departureRange);
  const arrivalLabel = formatTimeRange(arrivalRange);

  const toggleAirline = (code: string) => {
    const normalized = code.toUpperCase();
    if (filters.airlines.includes(normalized)) {
      filters.onAirlinesChange(
        filters.airlines.filter((airlineCode) => airlineCode !== normalized),
      );
      return;
    }
    filters.onAirlinesChange([...filters.airlines, normalized]);
  };

  const handleAirlineSelect = (code: string) => {
    toggleAirline(code);
    handleAirlineClearSearch();
  };

  const handleDepartureSliderChange = (values: number[]) => {
    const [from, to] = values;
    if (from <= ALL_HOURS_RANGE[0] && to >= ALL_HOURS_RANGE[1]) {
      filters.onDepartureTimeRangeChange(null);
      return;
    }
    filters.onDepartureTimeRangeChange({ from, to });
  };

  const handleArrivalSliderChange = (values: number[]) => {
    const [from, to] = values;
    if (from <= ALL_HOURS_RANGE[0] && to >= ALL_HOURS_RANGE[1]) {
      filters.onArrivalTimeRangeChange(null);
      return;
    }
    filters.onArrivalTimeRangeChange({ from, to });
  };

  let _airlineSummary = "All airlines";
  if (filters.airlines.length > 0) {
    const sortedAirlines = [...filters.airlines].sort((a, b) =>
      getAirlineSummaryName(a).localeCompare(getAirlineSummaryName(b)),
    );
    if (filters.airlines.length <= 3) {
      _airlineSummary = formatListWithAnd(
        sortedAirlines.map((code) => renderAirlineSummaryLabel(code)),
      );
    } else {
      const formatted = sortedAirlines
        .slice(0, 3)
        .map((code) => renderAirlineSummaryLabel(code));
      _airlineSummary = `${formatted.join(", ")} +${filters.airlines.length - 3}`;
    }
  }

  const _hasCustomWindow =
    filters.searchWindowDays !== DEFAULT_SEARCH_WINDOW_DAYS;

  const commandClasses = isDisabled ? "pointer-events-none opacity-60" : "";
  const showAirlineList =
    !isDisabled && (isAirlinePickerOpen || airlineSearch.trim().length > 0);

  // Auto-refetch with 2-second debounce
  const refetchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!price.canRefetch) {
      // Clear any pending timeout if we can't refetch
      if (refetchTimeoutRef.current !== null) {
        window.clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
      return;
    }

    // Clear any existing timeout
    if (refetchTimeoutRef.current !== null) {
      window.clearTimeout(refetchTimeoutRef.current);
    }

    // Set new timeout for 2 seconds
    refetchTimeoutRef.current = window.setTimeout(() => {
      price.onRefetch();
      refetchTimeoutRef.current = null;
    }, 2000);

    // Cleanup on unmount
    return () => {
      if (refetchTimeoutRef.current !== null) {
        window.clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
    };
  }, [price.canRefetch, price.onRefetch]);

  return (
    <Card className="space-y-4 border bg-card/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Refine results</h3>
          <p className="text-xs text-muted-foreground">
            Filter the window, cabin, stops, times, and airline filters below.
          </p>
        </div>
        <div className="flex justify-end md:self-start">
          <Button
            type="button"
            variant="default"
            className="h-9 gap-2"
            onClick={price.onRefetch}
            disabled={!price.canRefetch}
          >
            {price.isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="text-sm font-semibold">
              {price.isSearching ? "Refetching" : "Refetch"}
            </span>
          </Button>
        </div>
      </div>

      {/* Row 1: Stops and Cabin */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stops
          </span>
          <ToggleGroup
            type="single"
            value={String(filters.stops)}
            onValueChange={(value) => {
              if (!value) return;
              filters.onStopsChange(Number(value) as MaxStops);
            }}
            variant="outline"
            size="sm"
            disabled={isDisabled}
            className="flex w-full gap-px"
          >
            {stopOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={String(option.value)}
                className="text-xs font-medium"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cabin
          </span>
          <ToggleGroup
            type="single"
            value={String(filters.seatType)}
            onValueChange={(value) => {
              if (!value) return;
              filters.onSeatTypeChange(Number(value) as SeatType);
            }}
            variant="outline"
            size="sm"
            disabled={isDisabled}
            className="flex w-full gap-px"
          >
            {seatTypeOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={String(option.value)}
                className="text-xs font-medium"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Row 2: Days and Search Window */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Days
          </span>
          <ToggleGroup
            type="multiple"
            value={filters.daysOfWeek.map(String)}
            onValueChange={(values) => {
              const normalized = values
                .map((value) => Number.parseInt(value, 10))
                .filter((value) => Number.isInteger(value));
              filters.onDaysOfWeekChange(normalized);
            }}
            variant="outline"
            size="sm"
            disabled={isDisabled}
            className="flex w-full gap-px"
            aria-label="Select days of week"
          >
            {dayOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={String(option.value)}
                className="text-xs font-medium"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Search window</span>
            <span>{filters.searchWindowDays} days</span>
          </div>
          <Slider
            min={SEARCH_WINDOW_OPTIONS[0]}
            max={SEARCH_WINDOW_OPTIONS[SEARCH_WINDOW_OPTIONS.length - 1]}
            step={30}
            value={[filters.searchWindowDays]}
            disabled={isDisabled}
            onValueChange={(values) => {
              if (!values.length) return;
              filters.onSearchWindowDaysChange(values[0]);
            }}
          />
          <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            {SEARCH_WINDOW_OPTIONS.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Departure time
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => filters.onDepartureTimeRangeChange(null)}
              disabled={isDisabled || !hasCustomDeparture}
            >
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{departureLabel}</p>
          <Slider
            value={departureValues}
            min={ALL_HOURS_RANGE[0]}
            max={ALL_HOURS_RANGE[1]}
            step={1}
            onValueChange={handleDepartureSliderChange}
            disabled={isDisabled}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Arrival time
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => filters.onArrivalTimeRangeChange(null)}
              disabled={isDisabled || !hasCustomArrival}
            >
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{arrivalLabel}</p>
          <Slider
            value={arrivalValues}
            min={ALL_HOURS_RANGE[0]}
            max={ALL_HOURS_RANGE[1]}
            step={1}
            onValueChange={handleArrivalSliderChange}
            disabled={isDisabled}
          />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Airlines
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              filters.onAirlinesChange([]);
              handleAirlineClearSearch();
            }}
            disabled={isDisabled || filters.airlines.length === 0}
          >
            Clear
          </Button>
        </div>
        {filters.airlines.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.airlines.map((code) => (
              <Badge
                key={code}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {renderAirlineLabel(code)}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted"
                  onClick={() => toggleAirline(code)}
                  disabled={isDisabled}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">Remove {code}</span>
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div
          className={cn(
            "relative rounded-lg border",
            commandClasses,
            !showAirlineList && "overflow-hidden",
          )}
        >
          <Command
            className="flex flex-col"
            onFocus={handleAirlineFocus}
            onBlur={handleAirlineBlur}
          >
            <div className="relative">
              <CommandInput
                ref={commandInputRef}
                placeholder="Search airlines to filter"
                value={airlineSearch}
                onValueChange={handleAirlineSearchChange}
                disabled={isDisabled}
                className="pr-10"
              />
              {airlineSearch && !isDisabled && (
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground transition hover:text-foreground"
                  onClick={handleAirlineClearSearch}
                  aria-label="Clear airline search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            {showAirlineList && (
              <CommandList className="max-h-52 overflow-y-auto border-t">
                <CommandEmpty>No airlines found.</CommandEmpty>
                <CommandGroup>
                  {airlineOptions.map((option) => {
                    const isSelected = filters.airlines.includes(option.code);
                    return (
                      <CommandItem
                        key={option.code}
                        value={`${option.code} ${option.name}`}
                        onSelect={() => handleAirlineSelect(option.code)}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium leading-tight">
                            {option.code}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {option.name}
                          </span>
                        </div>
                        {isSelected && (
                          <Check
                            className="h-4 w-4 text-primary"
                            aria-hidden="true"
                          />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            )}
          </Command>
        </div>
      </section>
    </Card>
  );
}

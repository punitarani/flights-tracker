"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertsTable,
  type AlertTableRow,
} from "@/components/alerts/alerts-table";
import { SEARCH_WINDOW_OPTIONS } from "@/components/flight-explorer/constants";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AlertFiltersV1, SeatClass, Stops } from "@/core/filters";
import type { Alert } from "@/db/schema";
import { MaxStops, SeatType } from "@/lib/fli/models/google-flights/base";
import { trpc } from "@/lib/trpc/react";

const STOP_LABELS: Record<Stops, string> = {
  ANY: "Any",
  NONSTOP: "Nonstop",
  ONE_STOP: "Up to 1 stop",
  TWO_STOPS: "Up to 2 stops",
};

const STOP_QUERY_MAP: Record<Stops, number> = {
  ANY: MaxStops.ANY,
  NONSTOP: MaxStops.NON_STOP,
  ONE_STOP: MaxStops.ONE_STOP_OR_FEWER,
  TWO_STOPS: MaxStops.TWO_OR_FEWER_STOPS,
};

const SEAT_CLASS_LABELS: Record<SeatClass, string> = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "Premium Economy",
  BUSINESS: "Business",
  FIRST: "First",
};

const SEAT_QUERY_MAP: Record<SeatClass, number> = {
  ECONOMY: SeatType.ECONOMY,
  PREMIUM_ECONOMY: SeatType.PREMIUM_ECONOMY,
  BUSINESS: SeatType.BUSINESS,
  FIRST: SeatType.FIRST,
};

const SEARCH_WINDOW_SET = new Set<number>(SEARCH_WINDOW_OPTIONS);

function clampToAllowedWindow(days: number): number {
  if (SEARCH_WINDOW_SET.has(days)) {
    return days;
  }

  return SEARCH_WINDOW_OPTIONS.reduce((closest, option) => {
    const diff = Math.abs(option - days);
    const bestDiff = Math.abs(closest - days);
    return diff < bestDiff ? option : closest;
  }, SEARCH_WINDOW_OPTIONS[0]);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toAlertRow(alert: Alert): AlertTableRow | null {
  const filters = alert.filters as AlertFiltersV1 | undefined;
  if (!filters || filters.version !== 1) {
    return null;
  }

  const route = filters.route;
  const criteria = filters.filters ?? {};
  const dateFromIso = criteria.dateFrom ?? null;
  const dateToIso = criteria.dateTo ?? null;
  const dateFrom = dateFromIso ? parseISO(dateFromIso) : null;
  const dateTo = dateToIso ? parseISO(dateToIso) : null;

  if (
    !dateFromIso ||
    !dateToIso ||
    !dateFrom ||
    !dateTo ||
    Number.isNaN(dateFrom.getTime()) ||
    Number.isNaN(dateTo.getTime())
  ) {
    return null;
  }

  const totalDays = Math.max(1, differenceInCalendarDays(dateTo, dateFrom) + 1);
  const searchWindowDays = clampToAllowedWindow(totalDays);

  const params = new URLSearchParams({
    origin: route.from,
    destination: route.to,
    dateFrom: dateFromIso,
    dateTo: dateToIso,
    searchWindowDays: searchWindowDays.toString(),
  });

  if (criteria.stops) {
    const stopsValue = STOP_QUERY_MAP[criteria.stops];
    if (typeof stopsValue === "number") {
      params.set("stops", stopsValue.toString());
    }
  }

  if (criteria.class) {
    const seatValue = SEAT_QUERY_MAP[criteria.class];
    if (typeof seatValue === "number") {
      params.set("seatType", seatValue.toString());
    }
  }

  if (criteria.airlines?.length) {
    params.set("airlines", criteria.airlines.join(","));
  }

  const travelDatesLabel = `${format(dateFrom, "MMM d, yyyy")} – ${format(
    dateTo,
    "MMM d, yyyy",
  )} (${totalDays} days)`;

  const createdAtValue = new Date(alert.createdAt);

  return {
    id: alert.id,
    routeLabel: `${route.from} → ${route.to}`,
    travelDatesLabel,
    stopsLabel: criteria.stops ? STOP_LABELS[criteria.stops] : "Any",
    seatClassLabel: criteria.class
      ? SEAT_CLASS_LABELS[criteria.class]
      : "Economy",
    airlines: criteria.airlines ?? [],
    statusLabel: capitalize(alert.status),
    createdAtLabel: Number.isNaN(createdAtValue.getTime())
      ? "—"
      : format(createdAtValue, "MMM d, yyyy"),
    searchUrl: `/search?${params.toString()}`,
    createdAtValue,
  };
}

export default function AlertsPage() {
  const { data, isLoading } = trpc.useQuery(["alerts.list"]);
  const utils = trpc.useContext();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const deleteMutation = trpc.useMutation(["alerts.delete"], {
    onMutate: ({ id }) => {
      setPendingDeleteId(id);
    },
    onSuccess: () => {
      toast.success("Alert deleted");
      void utils.invalidateQueries(["alerts.list"]);
    },
    onError: (error) => {
      const message =
        (error instanceof Error && error.message) ||
        (typeof error?.message === "string" && error.message) ||
        "Failed to delete alert.";
      toast.error(message);
    },
    onSettled: () => {
      setPendingDeleteId(null);
    },
  });

  const rows = useMemo(() => {
    if (!data) {
      return [] as AlertTableRow[];
    }

    return data
      .map(toAlertRow)
      .filter((row): row is AlertTableRow => Boolean(row))
      .sort((a, b) => b.createdAtValue.getTime() - a.createdAtValue.getTime());
  }, [data]);

  const handleDelete = useCallback(
    (alertRow: AlertTableRow) => {
      deleteMutation.mutate({ id: alertRow.id });
    },
    [deleteMutation],
  );

  const showEmptyState = !isLoading && rows.length === 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <main className="container mx-auto flex-1 overflow-y-auto px-4 py-6">
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
            <p className="text-sm text-muted-foreground">
              View and manage your flight price alerts.
            </p>
          </div>

          {showEmptyState ? (
            <Card className="mx-auto w-full max-w-xl text-center">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl">No alerts yet</CardTitle>
                <CardDescription>
                  Create an alert to track fare trends and receive daily
                  updates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="lg">
                  <Link href="/search">Go to search</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <AlertsTable
              data={rows}
              isLoading={isLoading}
              onDelete={handleDelete}
              pendingDeleteId={pendingDeleteId}
            />
          )}
        </div>
      </main>
    </div>
  );
}

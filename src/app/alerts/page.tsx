"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertsTable,
  type AlertTableRow,
} from "@/components/alerts/alerts-table";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildSearchParamsFromNormalizedFilters,
  normalizeAlertFilters,
} from "@/core/alert-filter-utils";
import type { AlertFiltersV1, SeatClass, Stops } from "@/core/filters";
import type { Alert } from "@/db/schema";
import { trpc } from "@/lib/trpc/react";

const STOP_LABELS: Record<Stops, string> = {
  ANY: "Any",
  NONSTOP: "Nonstop",
  ONE_STOP: "Up to 1 stop",
  TWO_STOPS: "Up to 2 stops",
};

const SEAT_CLASS_LABELS: Record<SeatClass, string> = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "Premium Economy",
  BUSINESS: "Business",
  FIRST: "First",
};

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toAlertRow(alert: Alert): AlertTableRow | null {
  const filters = alert.filters as AlertFiltersV1 | undefined;
  if (!filters || filters.version !== 1) {
    return null;
  }

  const normalized = normalizeAlertFilters(filters);
  if (!normalized) {
    return null;
  }

  const params = buildSearchParamsFromNormalizedFilters(normalized);

  const travelDatesLabel = `${format(normalized.dateFrom, "MMM d, yyyy")} – ${format(
    normalized.dateTo,
    "MMM d, yyyy",
  )} (${normalized.searchWindowDays} days)`;

  const createdAtValue = new Date(alert.createdAt);

  return {
    id: alert.id,
    routeLabel: `${normalized.origin} → ${normalized.destination}`,
    travelDatesLabel,
    stopsLabel: normalized.stops ? STOP_LABELS[normalized.stops] : "Any",
    seatClassLabel: normalized.seatClass
      ? SEAT_CLASS_LABELS[normalized.seatClass]
      : "Economy",
    airlines: normalized.airlines,
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

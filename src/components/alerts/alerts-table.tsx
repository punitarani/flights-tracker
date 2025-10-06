"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type AlertTableRow = {
  id: string;
  routeLabel: string;
  travelDatesLabel: string;
  stopsLabel: string;
  seatClassLabel: string;
  airlines: string[];
  statusLabel: string;
  createdAtLabel: string;
  searchUrl: string;
  createdAtValue: Date;
};

type AlertsTableProps = {
  data: AlertTableRow[];
  isLoading: boolean;
};

const columns: ColumnDef<AlertTableRow>[] = [
  {
    id: "open",
    header: () => <span className="sr-only">Open</span>,
    cell: ({ row }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon" variant="ghost" className="h-8 w-8">
            <Link
              href={row.original.searchUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open alert in search</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open search in new tab</TooltipContent>
      </Tooltip>
    ),
    enableSorting: false,
    size: 48,
  },
  {
    accessorKey: "routeLabel",
    header: "Route",
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {row.original.routeLabel}
      </span>
    ),
  },
  {
    accessorKey: "travelDatesLabel",
    header: "Travel window",
  },
  {
    accessorKey: "stopsLabel",
    header: "Stops",
  },
  {
    accessorKey: "seatClassLabel",
    header: "Cabin",
  },
  {
    id: "airlines",
    header: "Airlines",
    cell: ({ row }) => {
      if (!row.original.airlines.length) {
        return <span className="text-muted-foreground">Any</span>;
      }

      return (
        <div className="flex flex-wrap gap-1">
          {row.original.airlines.map((airline) => (
            <Badge key={airline} variant="outline">
              {airline}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "statusLabel",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="secondary" className="capitalize">
        {row.original.statusLabel}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAtLabel",
    header: "Created",
  },
];

export function AlertsTable({ data, isLoading }: AlertsTableProps) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const columnCount = columns.length;

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-32">
                <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading alerts…</span>
                    </>
                  ) : (
                    <span>No alerts found.</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

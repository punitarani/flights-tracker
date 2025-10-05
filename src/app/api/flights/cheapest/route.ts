import { NextResponse } from "next/server";
import { z } from "zod";

import {
  Airport,
  DateSearchFiltersSchema,
  MaxStops,
  PassengerInfoSchema,
  SeatType,
  TripType,
} from "@/lib/fli/models";
import { SearchDates } from "@/lib/fli/search";

const requestSchema = z
  .object({
    origin: z
      .string()
      .trim()
      .min(3)
      .max(3)
      .transform((value) => value.toUpperCase()),
    destination: z
      .string()
      .trim()
      .min(3)
      .max(3)
      .transform((value) => value.toUpperCase()),
    days: z.number().int().min(1).max(90).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.origin === data.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Origin and destination must be different",
        path: ["destination"],
      });
    }
  });

const DEFAULT_DAYS = 90;

function resolveAirport(code: string): Airport | null {
  if (Object.hasOwn(Airport, code)) {
    return Airport[code as keyof typeof Airport];
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { origin, destination } = parsed.data;
  const days = parsed.data.days ?? DEFAULT_DAYS;

  const originAirport = resolveAirport(origin);
  const destinationAirport = resolveAirport(destination);

  if (!originAirport || !destinationAirport) {
    return NextResponse.json(
      { error: "Unsupported airport code" },
      { status: 400 },
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const searchStartDate = new Date(today);
  searchStartDate.setDate(searchStartDate.getDate() + 1);
  const fromDate = searchStartDate.toISOString().split("T")[0];

  const toDateObj = new Date(searchStartDate);
  toDateObj.setDate(toDateObj.getDate() + days - 1);
  const toDate = toDateObj.toISOString().split("T")[0];

  const passengerInfo = PassengerInfoSchema.parse({
    adults: 1,
    children: 0,
    infantsInSeat: 0,
    infantsOnLap: 0,
  });

  const filters = DateSearchFiltersSchema.parse({
    tripType: TripType.ONE_WAY,
    passengerInfo,
    flightSegments: [
      {
        departureAirport: [[originAirport, 0]],
        arrivalAirport: [[destinationAirport, 0]],
        travelDate: fromDate,
      },
    ],
    stops: MaxStops.ANY,
    seatType: SeatType.ECONOMY,
    fromDate,
    toDate,
  });

  try {
    const search = new SearchDates();
    const results = await search.search(filters);

    const prices =
      results
        ?.map(({ date, price }) => ({
          date: (date[0] ?? null)?.toISOString().split("T")[0] ?? null,
          price,
        }))
        .filter((entry): entry is { date: string; price: number } =>
          Boolean(entry.date),
        ) ?? [];

    prices.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return NextResponse.json({ prices, currency: "USD" });
  } catch (error) {
    console.error("Failed to search flights", error);
    return NextResponse.json(
      { error: "Failed to search flights" },
      { status: 500 },
    );
  }
}

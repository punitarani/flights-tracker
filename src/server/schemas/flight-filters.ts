import { z } from "zod";

import {
  Airline,
  Airport,
  Currency,
  type DateSearchFilters,
  DateSearchFiltersSchema,
  type FlightSearchFilters,
  FlightSearchFiltersSchema,
  LayoverRestrictionsSchema,
  MaxStops,
  type PassengerInfo,
  PassengerInfoSchema,
  PriceLimitSchema,
  SeatType,
  type TimeRestrictions,
  TimeRestrictionsSchema,
  TripType,
} from "@/lib/fli/models";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const airportCodeSchema = z
  .string()
  .trim()
  .length(3, "Airport code must be 3 letters")
  .regex(/^[A-Za-z]{3}$/u, "Airport code must use only letters")
  .transform((value) => value.toUpperCase());

const airlineCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(3)
  .regex(/^[0-9A-Za-z]{2,3}$/u, "Airline code must be alphanumeric")
  .transform((value) => value.toUpperCase());

const isoDateSchema = z
  .string()
  .regex(ISO_DATE_REGEX, "Date must be in YYYY-MM-DD format");

const timeValueSchema = z.number().int().min(0).max(24);

const timeRangeSchema = z
  .object({
    from: timeValueSchema.optional(),
    to: timeValueSchema.optional(),
  })
  .refine(
    (range) => {
      if (range.from !== undefined && range.to !== undefined) {
        return range.from <= range.to;
      }
      return true;
    },
    { message: "Time range start must be before end" },
  );

const passengerInputSchema = z
  .object({
    adults: z.number().int().min(0).max(9).default(1),
    children: z.number().int().min(0).max(9).default(0),
    infantsInSeat: z.number().int().min(0).max(9).default(0),
    infantsOnLap: z.number().int().min(0).max(9).default(0),
  })
  .refine(
    (data) =>
      data.adults + data.children + data.infantsInSeat + data.infantsOnLap > 0,
    { message: "At least one passenger is required" },
  );

const segmentInputSchema = z
  .object({
    origin: airportCodeSchema,
    destination: airportCodeSchema,
    departureDate: isoDateSchema.optional(),
    returnDate: isoDateSchema.optional(),
    departureTimeRange: timeRangeSchema.optional(),
    arrivalTimeRange: timeRangeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.origin === data.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination"],
        message: "Origin and destination must be different",
      });
    }

    if (data.returnDate && !data.departureDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["returnDate"],
        message: "Return date requires a departure date",
      });
    }
  });

const dayOfWeekValueSchema = z.number().int().min(0).max(6);

const dateRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine(
    (value) => new Date(value.from).getTime() <= new Date(value.to).getTime(),
    { message: "From date must be before or equal to to date", path: ["to"] },
  );

const DEFAULT_PASSENGERS = {
  adults: 1,
  children: 0,
  infantsInSeat: 0,
  infantsOnLap: 0,
} as const;

export const FlightFiltersInputSchema = z
  .object({
    tripType: z.nativeEnum(TripType).default(TripType.ONE_WAY),
    segments: z.array(segmentInputSchema).min(1).max(2),
    passengers: passengerInputSchema.optional(),
    seatType: z.nativeEnum(SeatType).default(SeatType.ECONOMY),
    stops: z.nativeEnum(MaxStops).default(MaxStops.ANY),
    dateRange: dateRangeSchema,
    airlines: z.array(airlineCodeSchema).max(16).optional(),
    daysOfWeek: z.array(dayOfWeekValueSchema).max(7).optional(),
    priceLimit: z
      .object({
        amount: z.number().positive(),
        currency: z.nativeEnum(Currency).optional(),
      })
      .optional(),
    maxDurationMinutes: z.number().int().positive().optional(),
    layoverAirports: z.array(airportCodeSchema).max(8).optional(),
    layoverMaxDurationMinutes: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tripType === TripType.ONE_WAY && data.segments.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segments"],
        message: "One-way trips require exactly one segment",
      });
    }

    if (data.tripType === TripType.ROUND_TRIP && data.segments.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segments"],
        message: "Round trips require two segments",
      });
    }

    for (const [index, segment] of data.segments.entries()) {
      if (!resolveAirport(segment.origin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments", index, "origin"],
          message: "Unsupported airport code",
        });
      }

      if (!resolveAirport(segment.destination)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments", index, "destination"],
          message: "Unsupported airport code",
        });
      }

      if (
        segment.departureDate &&
        !ISO_DATE_REGEX.test(segment.departureDate)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments", index, "departureDate"],
          message: "Departure date must be in YYYY-MM-DD format",
        });
      }

      if (segment.returnDate && !ISO_DATE_REGEX.test(segment.returnDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments", index, "returnDate"],
          message: "Return date must be in YYYY-MM-DD format",
        });
      }
    }

    if (data.airlines) {
      data.airlines.forEach((code, index) => {
        if (!resolveAirline(code)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["airlines", index],
            message: "Unsupported airline code",
          });
        }
      });
    }

    if (data.layoverAirports) {
      data.layoverAirports.forEach((code, index) => {
        if (!resolveAirport(code)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["layoverAirports", index],
            message: "Unsupported layover airport code",
          });
        }
      });
    }

    if (data.tripType === TripType.ROUND_TRIP) {
      const [outbound, inbound] = data.segments;
      if (outbound?.departureDate && inbound?.departureDate) {
        const outboundDate = new Date(outbound.departureDate);
        const inboundDate = new Date(inbound.departureDate);
        if (inboundDate < outboundDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["segments", 1, "departureDate"],
            message: "Return date must be on or after departure",
          });
        }
      }
    }
  });

export type FlightFiltersInput = z.infer<typeof FlightFiltersInputSchema>;

function resolveAirport(code: string): Airport | null {
  const normalized = code.toUpperCase();
  if (Object.hasOwn(Airport, normalized)) {
    return Airport[normalized as keyof typeof Airport];
  }
  return null;
}

function resolveAirline(code: string): Airline | null {
  const normalized = code.toUpperCase();
  const key = /^\d/.test(normalized) ? `_${normalized}` : normalized;
  if (Object.hasOwn(Airline, key)) {
    return Airline[key as keyof typeof Airline];
  }
  return null;
}

function normalizePassengers(
  input?: FlightFiltersInput["passengers"],
): PassengerInfo {
  const passengers = input ?? DEFAULT_PASSENGERS;
  return PassengerInfoSchema.parse(passengers);
}

function normalizeAirlines(input?: string[]): Airline[] | undefined {
  if (!input || input.length === 0) {
    return undefined;
  }
  const airlines: Airline[] = [];
  for (const code of input) {
    const airline = resolveAirline(code);
    if (!airline) {
      throw new Error(`Unsupported airline code: ${code}`);
    }
    airlines.push(airline);
  }
  return airlines;
}

function normalizeLayoverRestrictions(input: FlightFiltersInput) {
  if (!input.layoverAirports && !input.layoverMaxDurationMinutes) {
    return undefined;
  }

  return LayoverRestrictionsSchema.parse({
    airports: input.layoverAirports?.map((code) => {
      const airport = resolveAirport(code);
      if (!airport) {
        throw new Error(`Unsupported layover airport: ${code}`);
      }
      return airport;
    }),
    maxDuration: input.layoverMaxDurationMinutes,
  });
}

function computeRoundTripDuration(
  segments: FlightFiltersInput["segments"],
): number | undefined {
  if (segments.length !== 2) return undefined;
  const [outbound, inbound] = segments;
  if (!outbound?.departureDate || !inbound?.departureDate) return undefined;
  const outboundDate = new Date(outbound.departureDate);
  const inboundDate = new Date(inbound.departureDate);
  const diffMs = inboundDate.getTime() - outboundDate.getTime();
  if (Number.isNaN(diffMs)) return undefined;
  if (diffMs < 0) {
    throw new Error("Return date must be on or after departure");
  }
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

function buildTimeRestrictions(
  segment: FlightFiltersInput["segments"][number],
): TimeRestrictions | undefined {
  const departureRange = segment.departureTimeRange;
  const arrivalRange = segment.arrivalTimeRange;

  if (!departureRange && !arrivalRange) {
    return undefined;
  }

  return TimeRestrictionsSchema.parse({
    earliestDeparture: departureRange?.from,
    latestDeparture: departureRange?.to,
    earliestArrival: arrivalRange?.from,
    latestArrival: arrivalRange?.to,
  });
}

function buildSegments(
  input: FlightFiltersInput,
): FlightSearchFilters["flightSegments"] {
  return input.segments.map((segment, index) => {
    const departureAirport = resolveAirport(segment.origin);
    const arrivalAirport = resolveAirport(segment.destination);

    if (!departureAirport || !arrivalAirport) {
      throw new Error("Unsupported airport code in segment");
    }

    const fallbackDate =
      index === 1
        ? (segment.returnDate ?? input.dateRange.to)
        : input.dateRange.from;
    const travelDate = segment.departureDate ?? fallbackDate;

    const timeRestrictions = buildTimeRestrictions(segment);

    return {
      departureAirport: [[departureAirport, 0]],
      arrivalAirport: [[arrivalAirport, 0]],
      travelDate,
      ...(timeRestrictions ? { timeRestrictions } : {}),
    };
  });
}

export function toDateSearchFilters(
  input: FlightFiltersInput,
): DateSearchFilters {
  const passengerInfo = normalizePassengers(input.passengers);
  const airlines = normalizeAirlines(input.airlines);
  const flightSegments = buildSegments(input);
  const layoverRestrictions = normalizeLayoverRestrictions(input);
  const duration =
    input.tripType === TripType.ROUND_TRIP
      ? computeRoundTripDuration(input.segments)
      : undefined;

  return DateSearchFiltersSchema.parse({
    tripType: input.tripType,
    passengerInfo,
    flightSegments,
    stops: input.stops,
    seatType: input.seatType,
    priceLimit: input.priceLimit
      ? PriceLimitSchema.parse({
          maxPrice: input.priceLimit.amount,
          currency: input.priceLimit.currency,
        })
      : undefined,
    airlines,
    maxDuration: input.maxDurationMinutes,
    layoverRestrictions,
    fromDate: input.dateRange.from,
    toDate: input.dateRange.to,
    duration,
  });
}

export function toFlightSearchFilters(
  input: FlightFiltersInput,
): FlightSearchFilters {
  const passengerInfo = normalizePassengers(input.passengers);
  const airlines = normalizeAirlines(input.airlines);
  const flightSegments = buildSegments(input);
  const layoverRestrictions = normalizeLayoverRestrictions(input);

  return FlightSearchFiltersSchema.parse({
    tripType: input.tripType,
    passengerInfo,
    flightSegments,
    stops: input.stops,
    seatType: input.seatType,
    priceLimit: input.priceLimit
      ? PriceLimitSchema.parse({
          maxPrice: input.priceLimit.amount,
          currency: input.priceLimit.currency,
        })
      : undefined,
    airlines,
    maxDuration: input.maxDurationMinutes,
    layoverRestrictions,
  });
}

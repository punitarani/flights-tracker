import { z } from "zod";
import { Airline } from "../airline";
import { Airport } from "../airport";
import {
  FlightSegmentSchema,
  LayoverRestrictionsSchema,
  MaxStops,
  PassengerInfoSchema,
  PriceLimitSchema,
  SeatType,
  TripType,
} from "./base";

/**
 * Filters for searching flights across a date range.
 *
 * Similar to FlightSearchFilters but includes date range parameters
 * for finding the cheapest dates to fly.
 */
export const DateSearchFiltersSchema = z
  .object({
    tripType: z.nativeEnum(TripType).default(TripType.ONE_WAY),
    passengerInfo: PassengerInfoSchema,
    flightSegments: z.array(FlightSegmentSchema),
    stops: z.nativeEnum(MaxStops).default(MaxStops.ANY),
    seatType: z.nativeEnum(SeatType).default(SeatType.ECONOMY),
    priceLimit: PriceLimitSchema.optional(),
    airlines: z.array(z.nativeEnum(Airline)).optional(),
    maxDuration: z.number().positive().optional(),
    layoverRestrictions: LayoverRestrictionsSchema.optional(),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    duration: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      // Ensure duration is set if trip_type is ROUND_TRIP
      if (data.tripType === TripType.ROUND_TRIP && !data.duration) {
        return false;
      }
      return true;
    },
    { message: "Duration must be set for round trip flights" },
  )
  .refine(
    (data) => {
      // Ensure only one flight segment if trip_type is ONE_WAY
      if (
        data.tripType === TripType.ONE_WAY &&
        data.flightSegments.length !== 1
      ) {
        return false;
      }
      // Ensure only two flight segments if trip_type is ROUND_TRIP
      if (
        data.tripType === TripType.ROUND_TRIP &&
        data.flightSegments.length !== 2
      ) {
        return false;
      }
      return true;
    },
    { message: "Incorrect number of flight segments for trip type" },
  )
  .refine(
    (data) => {
      // Validate that to_date is in the future
      const toDate = new Date(data.toDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return toDate > today;
    },
    { message: "To date must be in the future" },
  )
  .refine(
    (data) => {
      // Ensure from_date is before to_date (swap if needed)
      const fromDate = new Date(data.fromDate);
      const toDate = new Date(data.toDate);
      if (fromDate > toDate) {
        const temp = data.toDate;
        data.toDate = data.fromDate;
        data.fromDate = temp;
      }
      return true;
    },
    { message: "Invalid date range" },
  )
  .transform((data) => {
    // Adjust from_date to current date if it's in the past
    const fromDate = new Date(data.fromDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (fromDate < today) {
      data.fromDate = today.toISOString().split("T")[0];
    }

    return data;
  });

export type DateSearchFilters = z.infer<typeof DateSearchFiltersSchema>;

/**
 * Get the enum key from an enum value (reverse lookup)
 */
function getEnumKey<T extends Record<string, string | number>>(
  enumObj: T,
  value: T[keyof T],
): string {
  const entry = Object.entries(enumObj).find(
    ([, enumValue]) => enumValue === value,
  );
  if (!entry) {
    throw new Error(`Could not find enum key for value: ${value}`);
  }
  return entry[0];
}

const airportEnumValues = new Set<string>(Object.values(Airport));

function isAirportEnumValue(value: unknown): value is Airport {
  return typeof value === "string" && airportEnumValues.has(value);
}

/**
 * DateSearchFilters with formatting methods.
 */
export class DateSearchFiltersModel {
  constructor(private filters: DateSearchFilters) {}

  /**
   * Format filters into Google Flights API structure.
   *
   * This method converts the DateSearchFilters model into the specific nested list/dict
   * structure required by Google Flights' API.
   *
   * @returns A formatted list structure ready for the Google Flights API request
   */
  format(): unknown[] {
    const serialize = (obj: unknown): unknown => {
      if (typeof obj === "string" && Object.hasOwn(Airport, obj)) {
        return obj;
      }
      if (typeof obj === "string" && Object.hasOwn(Airline, obj)) {
        return obj;
      }
      if (
        typeof obj === "string" ||
        typeof obj === "number" ||
        typeof obj === "boolean"
      ) {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(serialize);
      }
      if (typeof obj === "object" && obj !== null) {
        const source = obj as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(source)) {
          if (value !== undefined) {
            result[key] = serialize(value);
          }
        }
        return result;
      }
      return obj;
    };

    // Format flight segments
    const formattedSegments: unknown[] = [];
    for (const segment of this.filters.flightSegments) {
      // Format airport codes with correct nesting
      const departureAirports = segment.departureAirport
        .map((airportEntry) => {
          const [airportValue, metadata] = airportEntry;
          if (!isAirportEnumValue(airportValue)) {
            return null;
          }

          return [getEnumKey(Airport, airportValue), serialize(metadata)] as [
            string,
            unknown,
          ];
        })
        .filter((entry): entry is [string, unknown] => entry !== null);

      const arrivalAirports = segment.arrivalAirport
        .map((airportEntry) => {
          const [airportValue, metadata] = airportEntry;
          if (!isAirportEnumValue(airportValue)) {
            return null;
          }

          return [getEnumKey(Airport, airportValue), serialize(metadata)] as [
            string,
            unknown,
          ];
        })
        .filter((entry): entry is [string, unknown] => entry !== null);

      const segmentFilters: [
        Array<Array<[string, unknown]>>,
        Array<Array<[string, unknown]>>,
      ] = [[departureAirports], [arrivalAirports]];

      // Time restrictions
      const timeFilters = segment.timeRestrictions
        ? [
            segment.timeRestrictions.earliestDeparture ?? null,
            segment.timeRestrictions.latestDeparture ?? null,
            segment.timeRestrictions.earliestArrival ?? null,
            segment.timeRestrictions.latestArrival ?? null,
          ]
        : null;

      // Airlines
      const airlinesFilters = this.filters.airlines
        ? this.filters.airlines
            .sort()
            .map((airline) => getEnumKey(Airline, airline))
        : null;

      // Layover restrictions
      const layoverAirports =
        this.filters.layoverRestrictions?.airports?.map((a) =>
          getEnumKey(Airport, a),
        ) ?? null;
      const layoverDuration =
        this.filters.layoverRestrictions?.maxDuration ?? null;

      const segmentFormatted = [
        segmentFilters[0], // departure airport
        segmentFilters[1], // arrival airport
        timeFilters, // time restrictions
        serialize(this.filters.stops), // stops
        airlinesFilters, // airlines
        null, // placeholder
        segment.travelDate, // travel date
        this.filters.maxDuration ? [this.filters.maxDuration] : null, // max duration
        null, // placeholder
        layoverAirports, // layover airports
        null, // placeholder
        null, // placeholder
        layoverDuration, // layover duration
        null, // emissions
        3, // constant value
      ];
      formattedSegments.push(segmentFormatted);
    }

    // Format duration filters for round trips
    const durationFilters: unknown[] =
      this.filters.tripType === TripType.ROUND_TRIP
        ? [null, [this.filters.duration, this.filters.duration]]
        : [];

    // Create the main filters structure
    const filters: unknown[] = [
      null, // placeholder
      [
        null, // placeholder
        null, // placeholder
        serialize(this.filters.tripType), // trip type
        null, // placeholder
        [], // empty array
        serialize(this.filters.seatType), // seat type
        [
          this.filters.passengerInfo.adults,
          this.filters.passengerInfo.children,
          this.filters.passengerInfo.infantsOnLap,
          this.filters.passengerInfo.infantsInSeat,
        ],
        this.filters.priceLimit
          ? [null, this.filters.priceLimit.maxPrice]
          : null,
        null, // placeholder
        null, // placeholder
        null, // placeholder
        null, // placeholder
        null, // placeholder
        formattedSegments,
        null, // placeholder
        null, // placeholder
        null, // placeholder
        1, // placeholder (hardcoded to 1)
      ],
      [serialize(this.filters.fromDate), serialize(this.filters.toDate)],
      ...durationFilters,
    ];

    return filters;
  }

  /**
   * URL encode the formatted filters for API request.
   */
  encode(): string {
    const formattedFilters = this.format();
    // First convert the formatted filters to a JSON string
    const formattedJson = JSON.stringify(formattedFilters);
    // Then wrap it in a list with null
    const wrappedFilters = [null, formattedJson];
    // Finally, encode the whole thing
    return encodeURIComponent(JSON.stringify(wrappedFilters));
  }
}

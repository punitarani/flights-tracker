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
  SortBy,
  TripType,
} from "./base";

/**
 * Complete set of filters for flight search.
 *
 * This model matches required Google Flights' API structure.
 */
export const FlightSearchFiltersSchema = z.object({
  tripType: z.enum(TripType).default(TripType.ONE_WAY),
  passengerInfo: PassengerInfoSchema,
  flightSegments: z.array(FlightSegmentSchema),
  stops: z.enum(MaxStops).default(MaxStops.ANY),
  seatType: z.enum(SeatType).default(SeatType.ECONOMY),
  priceLimit: PriceLimitSchema.optional(),
  airlines: z.array(z.enum(Airline)).optional(),
  maxDuration: z.number().positive().optional(),
  layoverRestrictions: LayoverRestrictionsSchema.optional(),
  sortBy: z.enum(SortBy).default(SortBy.NONE),
});

export type FlightSearchFilters = z.infer<typeof FlightSearchFiltersSchema>;

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
 * FlightSearchFilters with formatting methods.
 */
export class FlightSearchFiltersModel {
  constructor(private filters: FlightSearchFilters) {}

  /**
   * Format filters into Google Flights API structure.
   *
   * This method converts the FlightSearchFilters model into the specific nested list/dict
   * structure required by Google Flights' API.
   *
   * The output format matches Google Flights' internal API structure, with careful handling
   * of nested arrays and proper serialization of enums and model objects.
   *
   * @returns A formatted list structure ready for the Google Flights API request
   */
  format(): unknown[] {
    const serialize = (obj: unknown): unknown => {
      if (
        typeof obj === "string" &&
        (Object.hasOwn(Airport, obj) || Object.hasOwn(Airline, obj))
      ) {
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

      // Selected flight (to fetch return flights)
      let selectedFlights = null;
      if (
        this.filters.tripType === TripType.ROUND_TRIP &&
        segment.selectedFlight !== undefined
      ) {
        selectedFlights = segment.selectedFlight.legs.map((leg) => [
          getEnumKey(Airport, leg.departureAirport),
          leg.departureDateTime.toISOString().split("T")[0],
          getEnumKey(Airport, leg.arrivalAirport),
          null,
          getEnumKey(Airline, leg.airline),
          leg.flightNumber,
        ]);
      }

      const segmentFormatted = [
        segmentFilters[0], // departure airport
        segmentFilters[1], // arrival airport
        timeFilters, // time restrictions
        serialize(this.filters.stops), // stops
        airlinesFilters, // airlines
        null, // placeholder
        segment.travelDate, // travel date
        this.filters.maxDuration ? [this.filters.maxDuration] : null, // max duration
        selectedFlights, // selected flight (to fetch return flights)
        layoverAirports, // layover airports
        null, // placeholder
        null, // placeholder
        layoverDuration, // layover duration
        null, // emissions
        3, // constant value
      ];
      formattedSegments.push(segmentFormatted);
    }

    // Create the main filters structure
    const filters: unknown[] = [
      [], // empty array at start
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
      serialize(this.filters.sortBy),
      0, // constant
      0, // constant
      2, // constant
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

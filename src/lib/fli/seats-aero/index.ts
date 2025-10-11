/**
 * Seats.aero API integration.
 *
 * Provides a client for querying award flight availability from seats.aero.
 */

export {
  createSeatsAeroClient,
  SeatsAeroAPIError,
  SeatsAeroClient,
  type SeatsAeroClientConfig,
} from "./client";

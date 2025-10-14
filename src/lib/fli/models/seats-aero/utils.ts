/**
 * Utility functions for processing seats.aero API data
 */

/**
 * Parses and formats comma-separated flight numbers from the API.
 * Converts "UA2076, F91234" to ["UA 2076", "F9 1234"]
 *
 * @param flightNumbers - Comma-separated flight numbers from the API
 * @returns Array of formatted flight numbers with spaces between airline code and number
 */
export function parseFlightNumbers(flightNumbers: string): string[] {
  return flightNumbers
    .split(",")
    .map((flightNum) => flightNum.trim())
    .filter((flightNum) => flightNum.length > 0)
    .map((flightNum) => {
      // Insert space between airline code (2 alphanumeric chars) and flight number (digits)
      // Matches: exactly 2 alphanumeric characters followed by digits, inserts space between them
      return flightNum.replace(/^([A-Z0-9]{2})(\d+)$/, "$1 $2");
    });
}

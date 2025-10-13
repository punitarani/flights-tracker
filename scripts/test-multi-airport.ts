/**
 * Test script for multi-airport flight search using fli.
 *
 * Usage: bun scripts/test-multi-airport.ts
 *
 * This script tests searching from multiple origin airports (SFO/ONT)
 * to multiple destination airports (LAX/SNA/ONT).
 */

import {
  Airport,
  FlightSearchFiltersSchema,
  MaxStops,
  PassengerInfoSchema,
  SeatType,
  SortBy,
  TripType,
} from "@/lib/fli/models";
import { SearchFlights } from "@/lib/fli/search";

async function testMultiAirportSearch() {
  console.log("🔍 Testing multi-airport search with fli\n");

  const search = new SearchFlights();

  // Set date 30 days from now
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 30);

  // Build search parameters with multiple origin and destination airports
  const searchParams = FlightSearchFiltersSchema.parse({
    passengerInfo: PassengerInfoSchema.parse({
      adults: 1,
      children: 0,
      infantsInSeat: 0,
      infantsOnLap: 0,
    }),
    flightSegments: [
      {
        // Multiple departure airports: SFO, ONT
        departureAirport: [
          [Airport.SFO, 0],
          [Airport.ONT, 0],
        ],
        // Multiple arrival airports: LAX, SNA, ONT
        arrivalAirport: [
          [Airport.LAX, 0],
          [Airport.SNA, 0],
          [Airport.ONT, 0],
        ],
        travelDate: futureDate.toISOString().split("T")[0],
      },
    ],
    stops: MaxStops.ANY,
    seatType: SeatType.ECONOMY,
    sortBy: SortBy.CHEAPEST,
    tripType: TripType.ONE_WAY,
  });

  console.log("Search Parameters:");
  console.log("─".repeat(60));
  console.log(`Origins:      SFO, ONT`);
  console.log(`Destinations: LAX, SNA, ONT`);
  console.log(`Travel Date:  ${searchParams.flightSegments[0].travelDate}`);
  console.log(`Passengers:   ${searchParams.passengerInfo.adults} adult(s)`);
  console.log(`Seat Type:    Economy`);
  console.log(`Stops:        Any`);
  console.log("─".repeat(60));
  console.log();

  try {
    console.log("⏳ Searching for flights...\n");

    const results = await search.search(searchParams, 10);

    if (!results || results.length === 0) {
      console.log("❌ No flights found");
      return;
    }

    console.log(`✅ Found ${results.length} flight option(s)\n`);
    console.log("Results:");
    console.log("═".repeat(60));

    for (let i = 0; i < results.length; i++) {
      const flight = results[i];

      // For one-way trips, results are FlightResult objects
      if (!Array.isArray(flight)) {
        const firstLeg = flight.legs[0];
        const lastLeg = flight.legs[flight.legs.length - 1];

        console.log(`\nFlight ${i + 1}:`);
        console.log(
          `  Route:    ${firstLeg.departureAirport} → ${lastLeg.arrivalAirport}`,
        );
        console.log(`  Price:    $${flight.price}`);
        console.log(
          `  Duration: ${Math.floor(flight.duration / 60)}h ${flight.duration % 60}m`,
        );
        console.log(`  Stops:    ${flight.stops}`);
        console.log(`  Legs:     ${flight.legs.length}`);

        // Show details for each leg
        for (let j = 0; j < flight.legs.length; j++) {
          const leg = flight.legs[j];
          const depTime = new Date(leg.departureDateTime).toLocaleTimeString(
            "en-US",
            {
              hour: "2-digit",
              minute: "2-digit",
            },
          );
          const arrTime = new Date(leg.arrivalDateTime).toLocaleTimeString(
            "en-US",
            {
              hour: "2-digit",
              minute: "2-digit",
            },
          );

          console.log(`    Leg ${j + 1}: ${leg.airline} ${leg.flightNumber}`);
          console.log(
            `           ${leg.departureAirport} ${depTime} → ${leg.arrivalAirport} ${arrTime}`,
          );
          console.log(
            `           Duration: ${Math.floor(leg.duration / 60)}h ${leg.duration % 60}m`,
          );
        }
      }
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log("\n✨ Multi-airport search test completed successfully!");
  } catch (error) {
    console.error("❌ Search failed:", (error as Error).message);
    console.error((error as Error).stack);
    process.exitCode = 1;
  }
}

// Run the test
testMultiAirportSearch();

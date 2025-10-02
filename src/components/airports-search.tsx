"use client";

import { useState } from "react";
import { trpc } from "./trpc-provider";

export function AirportsSearch() {
  const [query, setQuery] = useState("");

  // Example of using tRPC query
  const airportsQuery = trpc.airports.getAirports.useQuery(
    { query: query || undefined, limit: 10 },
    { enabled: query.length > 0 },
  );

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Search Airports with tRPC</h2>

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for airports..."
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {airportsQuery.isLoading && (
        <div className="text-gray-500">Loading airports...</div>
      )}

      {airportsQuery.error && (
        <div className="text-red-500">Error: {airportsQuery.error.message}</div>
      )}

      {airportsQuery.data && (
        <div>
          <p className="text-gray-600 mb-2">
            Found {airportsQuery.data.total} airports, showing{" "}
            {airportsQuery.data.returned}
          </p>

          <div className="space-y-2">
            {airportsQuery.data.airports.map((airport) => (
              <div
                key={airport.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="font-semibold">{airport.name}</div>
                <div className="text-sm text-gray-600">
                  {airport.city}, {airport.country} • {airport.iata} •{" "}
                  {airport.icao}
                </div>
                <div className="text-xs text-gray-500">
                  {airport.latitude}, {airport.longitude}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {query.length === 0 && (
        <div className="text-gray-500">
          Start typing to search for airports using tRPC...
        </div>
      )}
    </div>
  );
}

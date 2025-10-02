"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AirportData } from "@/app/api/airports/route";
import { AirportMap } from "@/components/airport-map";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [airports, setAirports] = useState<AirportData[]>([]);
  const [filteredAirports, setFilteredAirports] = useState<AirportData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAirport, setSelectedAirport] = useState<AirportData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [_userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  // Fetch all airports on mount
  useEffect(() => {
    const fetchAirports = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/airports");
        const data = await response.json();
        setAirports(data.airports);
        setFilteredAirports(data.airports);
      } catch (error) {
        console.error("Failed to fetch airports:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAirports();
  }, []);

  // Get user location for 100mi radius feature
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation error:", error);
        },
      );
    }
  }, []);

  // Handle map center changes for 100mi radius filtering
  const handleMapReady = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
    (map: any) => {
      setMapInstance(map);

      // Listen to region changes
      map.addEventListener("region-change-end", async () => {
        const center = map.center;

        // Fetch airports within 100mi radius of current center
        try {
          const response = await fetch(
            `/api/airports?lat=${center.latitude}&lon=${center.longitude}&radius=100`,
          );
          const data = await response.json();

          // Only update if no search query is active
          if (!searchQuery) {
            setFilteredAirports(data.airports);
          }
        } catch (error) {
          console.error("Failed to fetch nearby airports:", error);
        }
      });
    },
    [searchQuery],
  );

  // Handle search with debouncing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (!searchQuery.trim()) {
        // If no search, show airports within 100mi of map center
        if (mapInstance) {
          const center = mapInstance.center;
          fetch(
            `/api/airports?lat=${center.latitude}&lon=${center.longitude}&radius=100`,
          )
            .then((res) => res.json())
            .then((data) => setFilteredAirports(data.airports))
            .catch(console.error);
        } else {
          setFilteredAirports(airports);
        }
        setSelectedAirport(null);
        return;
      }

      // Search airports
      const query = searchQuery.toLowerCase();
      const results = airports.filter(
        (airport) =>
          airport.name.toLowerCase().includes(query) ||
          airport.iata.toLowerCase().includes(query) ||
          airport.icao.toLowerCase().includes(query) ||
          airport.city.toLowerCase().includes(query) ||
          airport.country.toLowerCase().includes(query),
      );

      setFilteredAirports(results);

      // Auto-select first result
      if (results.length === 1) {
        setSelectedAirport(results[0]);
      } else {
        setSelectedAirport(null);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, airports, mapInstance]);

  // Display count message
  const displayMessage = useMemo(() => {
    if (isLoading) return "Loading airports...";
    if (searchQuery) {
      return `Found ${filteredAirports.length} airport${filteredAirports.length !== 1 ? "s" : ""}`;
    }
    return `Showing ${filteredAirports.length} airports within 100 miles`;
  }, [isLoading, searchQuery, filteredAirports.length]);

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header with Search */}
      <div className="flex-none border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">
                Flights Tracker
              </h1>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              {airports.length.toLocaleString()} Total Airports
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, IATA, ICAO, city, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground flex items-center gap-2">
              {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {displayMessage}
            </p>
            {selectedAirport && (
              <Badge variant="default" className="text-xs">
                Selected: {selectedAirport.iata}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Card className="p-6 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Loading map...</span>
            </Card>
          </div>
        ) : (
          <AirportMap
            airports={filteredAirports}
            selectedAirport={selectedAirport}
            onMapReady={handleMapReady}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { MapPin, Plane, Search, X } from "lucide-react";
import * as React from "react";
import type { AirportData } from "@/app/api/airports/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AirportSearchProps {
  airports: AirportData[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (airport: AirportData | null) => void;
  onFocus?: () => void;
  placeholder?: string;
  inputAriaLabel?: string;
  autoFocus?: boolean;
  className?: string;
  isLoading?: boolean;
}

export function AirportSearch({
  airports,
  value,
  onChange,
  onSelect,
  onFocus,
  placeholder = "Search by name, IATA, ICAO, city, or country...",
  inputAriaLabel,
  autoFocus = false,
  className,
  isLoading = false,
}: AirportSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [filteredAirports, setFilteredAirports] = React.useState<AirportData[]>(
    [],
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [triggerWidth, setTriggerWidth] = React.useState<number>();

  // Keep the dropdown width in sync with the trigger
  React.useEffect(() => {
    const element = triggerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setTriggerWidth(element.offsetWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // Filter airports based on search query
  React.useEffect(() => {
    if (!value.trim()) {
      setFilteredAirports([]);
      setOpen(false);
      return;
    }

    const query = value.toLowerCase();
    const results = airports
      .filter(
        (airport) =>
          airport.name.toLowerCase().includes(query) ||
          airport.iata.toLowerCase().includes(query) ||
          airport.icao.toLowerCase().includes(query) ||
          airport.city.toLowerCase().includes(query) ||
          airport.country.toLowerCase().includes(query),
      )
      .slice(0, 10); // Top 10 results

    setFilteredAirports(results);
    setOpen(results.length > 0);
  }, [value, airports]);

  const handleSelect = React.useCallback(
    (airport: AirportData) => {
      onChange(`${airport.name} (${airport.iata})`);
      onSelect(airport);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange, onSelect],
  );

  const handleClear = React.useCallback(() => {
    onChange("");
    onSelect(null);
    setOpen(false);
    inputRef.current?.focus();
  }, [onChange, onSelect]);

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              // biome-ignore lint/suspicious/noArrayIndexKey: Static content
              key={index}
              className="bg-primary/20 text-foreground font-medium"
            >
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        ref={triggerRef}
        className={cn("relative w-full transition-all", className)}
      >
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              aria-label={inputAriaLabel}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => {
                onFocus?.();
                if (filteredAirports.length > 0) {
                  setOpen(true);
                }
              }}
              className={cn(
                "w-full h-12 pl-10 pr-10 text-base rounded-md border border-input bg-background",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "placeholder:text-muted-foreground",
                "transition-all duration-200",
              )}
            />
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: triggerWidth ? `${triggerWidth}px` : undefined }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList className="max-h-[400px]">
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading airports...
                </div>
              ) : filteredAirports.length === 0 ? (
                <CommandEmpty>
                  <div className="py-6 text-center">
                    <Plane className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No airports found
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try searching by name, IATA code, or city
                    </p>
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup heading={`${filteredAirports.length} Results`}>
                  {filteredAirports.map((airport) => (
                    <CommandItem
                      key={airport.id}
                      value={airport.id}
                      onSelect={() => handleSelect(airport)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="mt-0.5">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium truncate">
                              {highlightMatch(airport.name, value)}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0"
                            >
                              {highlightMatch(airport.iata, value)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="truncate">
                              {highlightMatch(airport.city, value)}
                            </span>
                            <span className="text-muted-foreground/50">•</span>
                            <span className="truncate">
                              {highlightMatch(airport.country, value)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </div>
    </Popover>
  );
}

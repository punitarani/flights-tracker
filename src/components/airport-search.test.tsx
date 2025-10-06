import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { AirportData } from "@/server/services/airports";
import { AirportSearch } from "./airport-search";

const airports: AirportData[] = [
  {
    id: "apt-jfk",
    name: "John F. Kennedy International Airport",
    city: "New York",
    country: "United States",
    iata: "JFK",
    icao: "KJFK",
    latitude: 40.6413,
    longitude: -73.7781,
  },
  {
    id: "apt-lax",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "United States",
    iata: "LAX",
    icao: "KLAX",
    latitude: 33.9416,
    longitude: -118.4085,
  },
];

function TestHarness({
  onSelect,
}: {
  onSelect: (airport: AirportData | null) => void;
}) {
  const [value, setValue] = React.useState("");

  return (
    <AirportSearch
      airports={airports}
      value={value}
      onChange={setValue}
      onSelect={onSelect}
    />
  );
}

describe("AirportSearch", () => {
  it("selects airport when a valid IATA code is submitted with Enter", async () => {
    const onSelect = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);

    await act(async () => {
      root.render(<TestHarness onSelect={onSelect} />);
    });

    const input = container.querySelector("input");
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected an input element");
    }

    await act(async () => {
      input.value = "jfk";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ iata: "JFK" }),
    );
    expect(input.value).toBe("John F. Kennedy International Airport (JFK)");

    await act(async () => {
      root.unmount();
    });

    container.remove();
  });
});

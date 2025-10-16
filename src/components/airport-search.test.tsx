/**
 * @jest-environment jsdom
 */

import { describe, expect, it, mock } from "bun:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import type { AirportData } from "@/server/services/airports";
import { AirportSearch } from "./airport-search";

// Ensure DOM is set up for this test
import { GlobalWindow } from "happy-dom";
if (typeof globalThis.document === "undefined") {
  const window = new GlobalWindow();
  globalThis.document = window.document;
  globalThis.window = window as unknown as Window & typeof globalThis;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Event = window.Event;
  globalThis.KeyboardEvent = window.KeyboardEvent;
}

// Mock ResizeObserver
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserverMock {
    constructor(callback: ResizeObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

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
  it.skip("selects airport when a valid IATA code is submitted with Enter", async () => {
    const onSelect = mock();
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

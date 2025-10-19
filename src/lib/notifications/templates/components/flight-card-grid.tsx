import type { FlightOptionSummary } from "../../types";

type FlightHighlight = {
  label: string;
  value: string;
};

type FlightCardProps = {
  title: string;
  description: string;
  highlights: FlightHighlight[];
  action?: { label: string; url: string };
};

function FlightCard({
  title,
  description,
  highlights,
  action,
}: FlightCardProps) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "20px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#0f172a" }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            {description}
          </p>
        </div>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "16px 0 0",
          display: "grid",
          gap: "8px",
        }}
      >
        {highlights.map((item) => (
          <li
            key={`${item.label}-${item.value}`}
            style={{ fontSize: "13px", color: "#475569" }}
          >
            <strong style={{ color: "#0f172a" }}>{item.label}:</strong>{" "}
            {item.value}
          </li>
        ))}
      </ul>
      {action ? (
        <div style={{ marginTop: "16px" }}>
          <a
            href={action.url}
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: "8px",
              background: "#4338ca",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {action.label}
          </a>
        </div>
      ) : null}
    </div>
  );
}

type FlightCardGridProps = {
  cards: FlightCardProps[];
};

export function FlightCardGrid({ cards }: FlightCardGridProps) {
  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {cards.map((card, index) => (
        <FlightCard key={`${card.title}-${index}`} {...card} />
      ))}
    </div>
  );
}

export function buildFlightHighlights(
  flight: FlightOptionSummary,
): FlightHighlight[] {
  const firstLeg = flight.slices[0]?.legs[0];
  const lastSlice = flight.slices[flight.slices.length - 1];
  const lastLeg = lastSlice?.legs[lastSlice.legs.length - 1];

  const durationMinutes = flight.slices.reduce(
    (acc, slice) => acc + (slice.durationMinutes ?? 0),
    0,
  );
  const totalStops = flight.slices.reduce((acc, slice) => acc + slice.stops, 0);

  return [
    {
      label: "Price",
      value: `${flight.totalPrice.toFixed(0)} ${flight.currency}`,
    },
    {
      label: "Duration",
      value: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
    },
    {
      label: "Stops",
      value:
        totalStops === 0
          ? "Nonstop"
          : `${totalStops} stop${totalStops > 1 ? "s" : ""}`,
    },
    firstLeg
      ? {
          label: "Departure",
          value: `${firstLeg.departureAirportCode} • ${new Date(
            firstLeg.departureDateTime,
          ).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
          })}`,
        }
      : null,
    lastLeg
      ? {
          label: "Arrival",
          value: `${lastLeg.arrivalAirportCode} • ${new Date(
            lastLeg.arrivalDateTime,
          ).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
          })}`,
        }
      : null,
  ].filter(Boolean) as FlightHighlight[];
}

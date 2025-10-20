import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { SearchDatesOutput, SearchFlightsOutput } from "../types";
import { DatePriceChart } from "./date-price-chart";
import { FlightsList } from "./flights-list";

interface ToolRendererProps {
  // biome-ignore lint/suspicious/noExplicitAny: Tool parts have dynamic types
  part: any;
}

export function ToolRenderer({ part }: ToolRendererProps) {
  // searchFlights tool
  if (part.type === "tool-searchFlights") {
    if (part.state === "call" || part.state === "input-available") {
      return (
        <Tool>
          <ToolHeader
            title="Flight search"
            type={part.type}
            state={part.state}
          />
          <ToolContent>
            <div className="space-y-3 p-3">
              <Shimmer className="text-sm">
                {`Searching for flights from ${part.input?.origin?.join(", ") ?? "origin"} to ${part.input?.destination?.join(", ") ?? "destination"} on ${part.input?.travelDate ?? "selected date"}...`}
              </Shimmer>
              <ToolInput input={part.input} />
            </div>
          </ToolContent>
        </Tool>
      );
    }

    if (part.state === "output-available") {
      const output = part.output as SearchFlightsOutput;

      if (!output.success) {
        return (
          <Tool>
            <ToolHeader
              title="Flight search"
              type={part.type}
              state="output-error"
            />
            <ToolContent>
              <div className="space-y-3 p-3">
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5">
                  <p className="text-sm text-destructive font-medium leading-relaxed">
                    {output.message}
                  </p>
                </div>
                <ToolInput input={part.input} />
                <ToolOutput output={output} errorText={output.message} />
              </div>
            </ToolContent>
          </Tool>
        );
      }

      const origin = part.input?.origin?.join(", ") ?? "origin";
      const destination = part.input?.destination?.join(", ") ?? "destination";

      return (
        <Tool>
          <ToolHeader
            title={`Found ${output.count ?? 0} flights from ${origin} → ${destination}`}
            type={part.type}
            state={part.state}
          />
          <ToolContent>
            <div className="space-y-3 p-3">
              <FlightsList flights={output.flights} />
              <ToolInput input={part.input} />
            </div>
          </ToolContent>
        </Tool>
      );
    }
  }

  // searchDates tool
  if (part.type === "tool-searchDates") {
    if (part.state === "call" || part.state === "input-available") {
      return (
        <Tool>
          <ToolHeader title="Date search" type={part.type} state={part.state} />
          <ToolContent>
            <div className="space-y-3 p-3">
              <Shimmer className="text-sm">
                {`Finding cheapest dates from ${part.input?.origin?.join(", ") ?? "origin"} to ${part.input?.destination?.join(", ") ?? "destination"} between ${part.input?.startDate ?? "start"} and ${part.input?.endDate ?? "end"}...`}
              </Shimmer>
              <ToolInput input={part.input} />
            </div>
          </ToolContent>
        </Tool>
      );
    }

    if (part.state === "output-available") {
      const output = part.output as SearchDatesOutput;

      if (!output.success) {
        return (
          <Tool>
            <ToolHeader
              title="Date search"
              type={part.type}
              state="output-error"
            />
            <ToolContent>
              <div className="space-y-3 p-3">
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5">
                  <p className="text-sm text-destructive font-medium leading-relaxed">
                    {output.message}
                  </p>
                </div>
                <ToolInput input={part.input} />
                <ToolOutput output={output} errorText={output.message} />
              </div>
            </ToolContent>
          </Tool>
        );
      }

      const origin = part.input?.origin?.join(", ") ?? "origin";
      const destination = part.input?.destination?.join(", ") ?? "destination";

      return (
        <Tool>
          <ToolHeader
            title={`Found ${output.count ?? 0} dates for ${origin} → ${destination}${output.cheapestPrice ? ` • Best: $${output.cheapestPrice}` : ""}`}
            type={part.type}
            state={part.state}
          />
          <div className="px-4 pt-3 pb-2">
            <DatePriceChart
              dates={output.dates}
              cheapestPrice={output.cheapestPrice}
            />
          </div>
          <ToolContent>
            <div className="p-3">
              <ToolInput input={part.input} />
            </div>
          </ToolContent>
        </Tool>
      );
    }
  }

  // controlScene tool - hidden from conversation
  if (part.type === "tool-controlScene") {
    return null;
  }

  // Unknown tool or state
  return null;
}

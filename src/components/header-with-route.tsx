"use client";

import { useQueryStates } from "nuqs";
import { flightExplorerQueryParsers } from "@/components/flight-explorer/query-state";
import { Header } from "@/components/header";

/**
 * Header component that reads route information from query parameters
 * This component is wrapped in Suspense to handle the CSR bailout from useSearchParams
 */
export function HeaderWithRoute() {
  const [queryState] = useQueryStates(flightExplorerQueryParsers);

  const route =
    queryState.origin && queryState.destination
      ? {
          origin: queryState.origin,
          destination: queryState.destination,
        }
      : undefined;

  return <Header route={route} />;
}

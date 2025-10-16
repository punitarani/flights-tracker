"use client";

import { httpBatchLink } from "@trpc/client/links/httpBatchLink";
import { httpLink } from "@trpc/client/links/httpLink";
import { loggerLink } from "@trpc/client/links/loggerLink";
import { splitLink } from "@trpc/client/links/splitLink";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { createWebStoragePersistor } from "react-query/createWebStoragePersistor-experimental";
import { persistQueryClient } from "react-query/persistQueryClient-experimental";
import superjson from "superjson";

import { trpc } from "./react";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

const PERSISTENCE_KEY = "flights-tracker-trpc-cache";

const PUBLIC_QUERY_KEYS = new Set([
  "airports.search",
  "seatsAero.getAvailabilityByDay",
  "seatsAero.getTrips",
  "seatsAero.search",
]);

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            cacheTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    queryClient.setQueryDefaults(["airports.search"], {
      staleTime: 60 * 60 * 1000,
      cacheTime: 2 * 60 * 60 * 1000,
    });

    queryClient.setQueryDefaults(["seatsAero.getAvailabilityByDay"], {
      staleTime: 60 * 60 * 1000,
      cacheTime: 2 * 60 * 60 * 1000,
    });

    queryClient.setQueryDefaults(["seatsAero.getTrips"], {
      staleTime: 15 * 60 * 1000,
      cacheTime: 60 * 60 * 1000,
    });

    queryClient.setQueryDefaults(["seatsAero.search"], {
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
    });

    queryClient.setQueryDefaults(["alerts.list"], {
      staleTime: 0,
      cacheTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    });
  }, [queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const persistor = createWebStoragePersistor({
      storage: window.localStorage,
      key: PERSISTENCE_KEY,
      throttleTime: 1000,
      serialize: (client) => JSON.stringify(client),
      deserialize: (cached) => JSON.parse(cached),
    });

    persistQueryClient({
      queryClient,
      persistor,
      maxAge: 60 * 60 * 1000,
      buster: "v1",
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          if (!query.state.dataUpdatedAt || query.state.status !== "success") {
            return false;
          }

          const [procedure] = query.queryKey;
          if (
            typeof procedure !== "string" ||
            !PUBLIC_QUERY_KEYS.has(procedure)
          ) {
            return false;
          }

          if (procedure === "seatsAero.search") {
            const data = query.state.data as { status?: string } | undefined;
            if (data?.status !== "completed") {
              return false;
            }
          }

          return true;
        },
      },
      hydrateOptions: {
        defaultOptions: {
          queries: {
            staleTime: 60 * 60 * 1000,
          },
        },
      },
    }).catch(() => {
      void persistor.removeClient();
    });
  }, [queryClient]);

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" || opts.direction === "down",
        }),
        splitLink({
          condition: (op) => op.type === "query",
          true: httpBatchLink({
            url: `${getBaseUrl()}/api/trpc`,
            maxBatchSize: 5,
          }),
          false: httpLink({
            url: `${getBaseUrl()}/api/trpc`,
          }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

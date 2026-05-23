"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink, splitLink } from "@trpc/client";
import { useEffect, useState } from "react";
import superjson from "superjson";

import { api } from "./react";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

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
    // Note: In v10, query keys are arrays like [["airports","search"],{input:...}]
    // We need to use getQueryKey() for proper type safety
    queryClient.setQueryDefaults(api.airports.search.getQueryKey(), {
      staleTime: 60 * 60 * 1000,
      cacheTime: 2 * 60 * 60 * 1000,
    });

    queryClient.setQueryDefaults(
      api.seatsAero.getAvailabilityByDay.getQueryKey(),
      {
        staleTime: 60 * 60 * 1000,
        cacheTime: 2 * 60 * 60 * 1000,
      },
    );

    queryClient.setQueryDefaults(api.seatsAero.getTrips.getQueryKey(), {
      staleTime: 15 * 60 * 1000,
      cacheTime: 60 * 60 * 1000,
    });

    queryClient.setQueryDefaults(api.seatsAero.search.getQueryKey(), {
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
    });

    queryClient.setQueryDefaults(api.alerts.list.getQueryKey(), {
      staleTime: 0,
      cacheTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    });
  }, [queryClient]);

  const [trpcClient] = useState(() =>
    api.createClient({
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
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}

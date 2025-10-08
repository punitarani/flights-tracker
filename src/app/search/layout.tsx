import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Metadata } from "next";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type SearchLayoutProps = {
  children: ReactNode;
};

type SearchParamSource =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | ReadonlyURLSearchParams
  | undefined;

type GenerateMetadataParams = {
  searchParams?: SearchParamSource;
};

const DEFAULT_WINDOW_DAYS = 60;

function hasGetMethod(
  value: SearchParamSource,
): value is URLSearchParams | ReadonlyURLSearchParams {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof value.get === "function"
  );
}

function getParam(source: SearchParamSource, key: string): string | null {
  if (!source) return null;

  if (hasGetMethod(source)) {
    const value = source.get(key);
    return value ?? null;
  }

  const value = source?.[key];
  if (!value) return null;

  if (Array.isArray(value)) {
    return value.length > 0 ? (value[0] ?? null) : null;
  }

  return value;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  searchParams,
}: GenerateMetadataParams): Promise<Metadata> {
  const origin = getParam(searchParams, "origin")?.toUpperCase() ?? null;
  const destination =
    getParam(searchParams, "destination")?.toUpperCase() ?? null;
  const dateFrom = parseDate(getParam(searchParams, "dateFrom"));
  const dateTo = parseDate(getParam(searchParams, "dateTo"));
  const windowInput = Number.parseInt(
    getParam(searchParams, "searchWindowDays") ?? "",
    10,
  );

  const windowDays =
    Number.isFinite(windowInput) && windowInput > 0
      ? windowInput
      : dateFrom && dateTo
        ? Math.max(1, differenceInCalendarDays(dateTo, dateFrom) + 1)
        : DEFAULT_WINDOW_DAYS;

  const routeLabel =
    origin && destination ? `${origin} → ${destination}` : null;

  let title = "Flight price explorer";
  if (routeLabel) {
    title = `${routeLabel} fare trends`;
  }

  const descriptionSegments: string[] = [];
  if (routeLabel) {
    descriptionSegments.push(
      `Explore real-time fare trends for the ${routeLabel} route and spot price drops fast.`,
    );
  } else {
    descriptionSegments.push(
      "Discover flight price insights across popular routes and plan smarter alerts.",
    );
  }

  if (dateFrom && dateTo) {
    const formattedFrom = format(dateFrom, "MMM d, yyyy");
    const formattedTo = format(dateTo, "MMM d, yyyy");
    descriptionSegments.push(
      `Tracking fares between ${formattedFrom} and ${formattedTo}.`,
    );
  } else {
    descriptionSegments.push(
      `Showing a ${windowDays}-day pricing window by default.`,
    );
  }

  const query = new URLSearchParams();
  if (origin) query.set("origin", origin);
  if (destination) query.set("destination", destination);
  if (dateFrom) query.set("dateFrom", format(dateFrom, "yyyy-MM-dd"));
  if (dateTo) query.set("dateTo", format(dateTo, "yyyy-MM-dd"));
  if (windowDays) query.set("searchWindowDays", windowDays.toString());

  const ogImagePath = `/search/opengraph-image${
    query.toString() ? `?${query.toString()}` : ""
  }`;
  const twitterImagePath = `/search/twitter-image${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  const description = descriptionSegments.join(" ");

  return {
    title,
    description,
    alternates: {
      canonical: "/search",
    },
    openGraph: {
      title,
      description,
      url: "/search",
      images: [
        {
          url: ogImagePath,
          width: 1200,
          height: 630,
          alt: routeLabel
            ? `${routeLabel} fare chart preview`
            : "Flight price chart preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: twitterImagePath,
          width: 1200,
          height: 630,
          alt: routeLabel
            ? `${routeLabel} fare chart preview`
            : "Flight price chart preview",
        },
      ],
    },
  };
}

export default function SearchLayout({ children }: SearchLayoutProps) {
  return <>{children}</>;
}

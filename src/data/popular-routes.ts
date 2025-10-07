export type PopularRouteEndpoint = {
  iata: string;
  city: string;
  airport: string;
  country: string;
};

export type PopularRoute = {
  id: string;
  origin: PopularRouteEndpoint;
  destination: PopularRouteEndpoint;
  distanceMiles?: number;
};

export type PopularRouteGroup = {
  id: string;
  title: string;
  description?: string;
  routes: PopularRoute[];
};

const usCountry = "United States";

export const POPULAR_ROUTE_GROUPS: PopularRouteGroup[] = [
  {
    id: "coastal-icons",
    title: "Coast-to-Coast Icons",
    description:
      "Signature transcontinental pairings connecting America’s creative and financial capitals.",
    routes: [
      {
        id: "LAX-JFK",
        distanceMiles: 2475,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
      },
      {
        id: "SFO-JFK",
        distanceMiles: 2586,
        origin: {
          iata: "SFO",
          city: "San Francisco",
          airport: "San Francisco International Airport",
          country: usCountry,
        },
        destination: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
      },
      {
        id: "SEA-JFK",
        distanceMiles: 2421,
        origin: {
          iata: "SEA",
          city: "Seattle",
          airport: "Seattle-Tacoma International Airport",
          country: usCountry,
        },
        destination: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
      },
      {
        id: "SAN-JFK",
        distanceMiles: 2446,
        origin: {
          iata: "SAN",
          city: "San Diego",
          airport: "San Diego International Airport",
          country: usCountry,
        },
        destination: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
      },
      {
        id: "LAX-BOS",
        distanceMiles: 2611,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "BOS",
          city: "Boston",
          airport: "Boston Logan International Airport",
          country: usCountry,
        },
      },
      {
        id: "SFO-BOS",
        distanceMiles: 2704,
        origin: {
          iata: "SFO",
          city: "San Francisco",
          airport: "San Francisco International Airport",
          country: usCountry,
        },
        destination: {
          iata: "BOS",
          city: "Boston",
          airport: "Boston Logan International Airport",
          country: usCountry,
        },
      },
      {
        id: "SEA-BOS",
        distanceMiles: 2496,
        origin: {
          iata: "SEA",
          city: "Seattle",
          airport: "Seattle-Tacoma International Airport",
          country: usCountry,
        },
        destination: {
          iata: "BOS",
          city: "Boston",
          airport: "Boston Logan International Airport",
          country: usCountry,
        },
      },
      {
        id: "LAX-DCA",
        distanceMiles: 2311,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "DCA",
          city: "Washington, D.C.",
          airport: "Ronald Reagan Washington National Airport",
          country: usCountry,
        },
      },
      {
        id: "SAN-BOS",
        distanceMiles: 2589,
        origin: {
          iata: "SAN",
          city: "San Diego",
          airport: "San Diego International Airport",
          country: usCountry,
        },
        destination: {
          iata: "BOS",
          city: "Boston",
          airport: "Boston Logan International Airport",
          country: usCountry,
        },
      },
      {
        id: "LAX-EWR",
        distanceMiles: 2455,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "EWR",
          city: "Newark",
          airport: "Newark Liberty International Airport",
          country: usCountry,
        },
      },
    ],
  },
  {
    id: "business-hubs",
    title: "Business Hub Connectors",
    description:
      "High-frequency shuttles linking America’s financial, political, and technology corridors.",
    routes: [
      {
        id: "ORD-LGA",
        distanceMiles: 733,
        origin: {
          iata: "ORD",
          city: "Chicago",
          airport: "Chicago O'Hare International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LGA",
          city: "New York",
          airport: "LaGuardia Airport",
          country: usCountry,
        },
      },
      {
        id: "DFW-LGA",
        distanceMiles: 1389,
        origin: {
          iata: "DFW",
          city: "Dallas–Fort Worth",
          airport: "Dallas/Fort Worth International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LGA",
          city: "New York",
          airport: "LaGuardia Airport",
          country: usCountry,
        },
      },
      {
        id: "ATL-LGA",
        distanceMiles: 761,
        origin: {
          iata: "ATL",
          city: "Atlanta",
          airport: "Hartsfield-Jackson Atlanta International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LGA",
          city: "New York",
          airport: "LaGuardia Airport",
          country: usCountry,
        },
      },
      {
        id: "DEN-LGA",
        distanceMiles: 1620,
        origin: {
          iata: "DEN",
          city: "Denver",
          airport: "Denver International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LGA",
          city: "New York",
          airport: "LaGuardia Airport",
          country: usCountry,
        },
      },
      {
        id: "IAH-LGA",
        distanceMiles: 1417,
        origin: {
          iata: "IAH",
          city: "Houston",
          airport: "George Bush Intercontinental Airport",
          country: usCountry,
        },
        destination: {
          iata: "LGA",
          city: "New York",
          airport: "LaGuardia Airport",
          country: usCountry,
        },
      },
      {
        id: "ORD-DCA",
        distanceMiles: 612,
        origin: {
          iata: "ORD",
          city: "Chicago",
          airport: "Chicago O'Hare International Airport",
          country: usCountry,
        },
        destination: {
          iata: "DCA",
          city: "Washington, D.C.",
          airport: "Ronald Reagan Washington National Airport",
          country: usCountry,
        },
      },
      {
        id: "ATL-DCA",
        distanceMiles: 547,
        origin: {
          iata: "ATL",
          city: "Atlanta",
          airport: "Hartsfield-Jackson Atlanta International Airport",
          country: usCountry,
        },
        destination: {
          iata: "DCA",
          city: "Washington, D.C.",
          airport: "Ronald Reagan Washington National Airport",
          country: usCountry,
        },
      },
      {
        id: "DFW-DCA",
        distanceMiles: 1192,
        origin: {
          iata: "DFW",
          city: "Dallas–Fort Worth",
          airport: "Dallas/Fort Worth International Airport",
          country: usCountry,
        },
        destination: {
          iata: "DCA",
          city: "Washington, D.C.",
          airport: "Ronald Reagan Washington National Airport",
          country: usCountry,
        },
      },
      {
        id: "SFO-ORD",
        distanceMiles: 1846,
        origin: {
          iata: "SFO",
          city: "San Francisco",
          airport: "San Francisco International Airport",
          country: usCountry,
        },
        destination: {
          iata: "ORD",
          city: "Chicago",
          airport: "Chicago O'Hare International Airport",
          country: usCountry,
        },
      },
      {
        id: "SEA-ORD",
        distanceMiles: 1721,
        origin: {
          iata: "SEA",
          city: "Seattle",
          airport: "Seattle-Tacoma International Airport",
          country: usCountry,
        },
        destination: {
          iata: "ORD",
          city: "Chicago",
          airport: "Chicago O'Hare International Airport",
          country: usCountry,
        },
      },
    ],
  },
  {
    id: "sun-and-leisure",
    title: "Sun & Leisure Escapes",
    description:
      "Warm-weather getaways that define peak travel seasons from coast to coast.",
    routes: [
      {
        id: "JFK-MIA",
        distanceMiles: 1093,
        origin: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
        destination: {
          iata: "MIA",
          city: "Miami",
          airport: "Miami International Airport",
          country: usCountry,
        },
      },
      {
        id: "BOS-MIA",
        distanceMiles: 1258,
        origin: {
          iata: "BOS",
          city: "Boston",
          airport: "Boston Logan International Airport",
          country: usCountry,
        },
        destination: {
          iata: "MIA",
          city: "Miami",
          airport: "Miami International Airport",
          country: usCountry,
        },
      },
      {
        id: "ORD-MCO",
        distanceMiles: 1005,
        origin: {
          iata: "ORD",
          city: "Chicago",
          airport: "Chicago O'Hare International Airport",
          country: usCountry,
        },
        destination: {
          iata: "MCO",
          city: "Orlando",
          airport: "Orlando International Airport",
          country: usCountry,
        },
      },
      {
        id: "ATL-MCO",
        distanceMiles: 403,
        origin: {
          iata: "ATL",
          city: "Atlanta",
          airport: "Hartsfield-Jackson Atlanta International Airport",
          country: usCountry,
        },
        destination: {
          iata: "MCO",
          city: "Orlando",
          airport: "Orlando International Airport",
          country: usCountry,
        },
      },
      {
        id: "LAX-HNL",
        distanceMiles: 2556,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "HNL",
          city: "Honolulu",
          airport: "Daniel K. Inouye International Airport",
          country: usCountry,
        },
      },
      {
        id: "SFO-HNL",
        distanceMiles: 2398,
        origin: {
          iata: "SFO",
          city: "San Francisco",
          airport: "San Francisco International Airport",
          country: usCountry,
        },
        destination: {
          iata: "HNL",
          city: "Honolulu",
          airport: "Daniel K. Inouye International Airport",
          country: usCountry,
        },
      },
      {
        id: "SEA-SAN",
        distanceMiles: 1050,
        origin: {
          iata: "SEA",
          city: "Seattle",
          airport: "Seattle-Tacoma International Airport",
          country: usCountry,
        },
        destination: {
          iata: "SAN",
          city: "San Diego",
          airport: "San Diego International Airport",
          country: usCountry,
        },
      },
      {
        id: "LAX-LAS",
        distanceMiles: 236,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LAS",
          city: "Las Vegas",
          airport: "Harry Reid International Airport",
          country: usCountry,
        },
      },
      {
        id: "DEN-LAS",
        distanceMiles: 628,
        origin: {
          iata: "DEN",
          city: "Denver",
          airport: "Denver International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LAS",
          city: "Las Vegas",
          airport: "Harry Reid International Airport",
          country: usCountry,
        },
      },
      {
        id: "DFW-PHX",
        distanceMiles: 868,
        origin: {
          iata: "DFW",
          city: "Dallas–Fort Worth",
          airport: "Dallas/Fort Worth International Airport",
          country: usCountry,
        },
        destination: {
          iata: "PHX",
          city: "Phoenix",
          airport: "Phoenix Sky Harbor International Airport",
          country: usCountry,
        },
      },
    ],
  },
  {
    id: "transatlantic",
    title: "Transatlantic Classics",
    description:
      "Flagship international crossings pairing U.S. gateways with Europe’s premier hubs.",
    routes: [
      {
        id: "JFK-LHR",
        distanceMiles: 3451,
        origin: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LHR",
          city: "London",
          airport: "London Heathrow Airport",
          country: "United Kingdom",
        },
      },
      {
        id: "BOS-LHR",
        distanceMiles: 3262,
        origin: {
          iata: "BOS",
          city: "Boston",
          airport: "Boston Logan International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LHR",
          city: "London",
          airport: "London Heathrow Airport",
          country: "United Kingdom",
        },
      },
      {
        id: "JFK-CDG",
        distanceMiles: 3622,
        origin: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
        destination: {
          iata: "CDG",
          city: "Paris",
          airport: "Paris Charles de Gaulle Airport",
          country: "France",
        },
      },
      {
        id: "LAX-LHR",
        distanceMiles: 5456,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LHR",
          city: "London",
          airport: "London Heathrow Airport",
          country: "United Kingdom",
        },
      },
      {
        id: "SFO-CDG",
        distanceMiles: 5584,
        origin: {
          iata: "SFO",
          city: "San Francisco",
          airport: "San Francisco International Airport",
          country: usCountry,
        },
        destination: {
          iata: "CDG",
          city: "Paris",
          airport: "Paris Charles de Gaulle Airport",
          country: "France",
        },
      },
      {
        id: "DFW-LHR",
        distanceMiles: 4767,
        origin: {
          iata: "DFW",
          city: "Dallas–Fort Worth",
          airport: "Dallas/Fort Worth International Airport",
          country: usCountry,
        },
        destination: {
          iata: "LHR",
          city: "London",
          airport: "London Heathrow Airport",
          country: "United Kingdom",
        },
      },
      {
        id: "ATL-CDG",
        distanceMiles: 4380,
        origin: {
          iata: "ATL",
          city: "Atlanta",
          airport: "Hartsfield-Jackson Atlanta International Airport",
          country: usCountry,
        },
        destination: {
          iata: "CDG",
          city: "Paris",
          airport: "Paris Charles de Gaulle Airport",
          country: "France",
        },
      },
      {
        id: "JFK-AMS",
        distanceMiles: 3634,
        origin: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
        destination: {
          iata: "AMS",
          city: "Amsterdam",
          airport: "Amsterdam Airport Schiphol",
          country: "Netherlands",
        },
      },
      {
        id: "BOS-AMS",
        distanceMiles: 3436,
        origin: {
          iata: "BOS",
          city: "Boston",
          airport: "Boston Logan International Airport",
          country: usCountry,
        },
        destination: {
          iata: "AMS",
          city: "Amsterdam",
          airport: "Amsterdam Airport Schiphol",
          country: "Netherlands",
        },
      },
      {
        id: "JFK-FCO",
        distanceMiles: 4277,
        origin: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
        destination: {
          iata: "FCO",
          city: "Rome",
          airport: "Rome Fiumicino Airport",
          country: "Italy",
        },
      },
    ],
  },
  {
    id: "global-gateways",
    title: "Global Gateways",
    description:
      "Far-reaching journeys that connect North America to Asia-Pacific, South America, and beyond.",
    routes: [
      {
        id: "LAX-NRT",
        distanceMiles: 5476,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "NRT",
          city: "Tokyo",
          airport: "Narita International Airport",
          country: "Japan",
        },
      },
      {
        id: "SFO-HND",
        distanceMiles: 5124,
        origin: {
          iata: "SFO",
          city: "San Francisco",
          airport: "San Francisco International Airport",
          country: usCountry,
        },
        destination: {
          iata: "HND",
          city: "Tokyo",
          airport: "Tokyo Haneda Airport",
          country: "Japan",
        },
      },
      {
        id: "SEA-ICN",
        distanceMiles: 5217,
        origin: {
          iata: "SEA",
          city: "Seattle",
          airport: "Seattle-Tacoma International Airport",
          country: usCountry,
        },
        destination: {
          iata: "ICN",
          city: "Seoul",
          airport: "Incheon International Airport",
          country: "South Korea",
        },
      },
      {
        id: "JFK-GRU",
        distanceMiles: 4817,
        origin: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
        destination: {
          iata: "GRU",
          city: "São Paulo",
          airport: "São Paulo–Guarulhos International Airport",
          country: "Brazil",
        },
      },
      {
        id: "MIA-GRU",
        distanceMiles: 4071,
        origin: {
          iata: "MIA",
          city: "Miami",
          airport: "Miami International Airport",
          country: usCountry,
        },
        destination: {
          iata: "GRU",
          city: "São Paulo",
          airport: "São Paulo–Guarulhos International Airport",
          country: "Brazil",
        },
      },
      {
        id: "LAX-SYD",
        distanceMiles: 7488,
        origin: {
          iata: "LAX",
          city: "Los Angeles",
          airport: "Los Angeles International Airport",
          country: usCountry,
        },
        destination: {
          iata: "SYD",
          city: "Sydney",
          airport: "Sydney Kingsford Smith Airport",
          country: "Australia",
        },
      },
      {
        id: "SFO-HKG",
        distanceMiles: 6905,
        origin: {
          iata: "SFO",
          city: "San Francisco",
          airport: "San Francisco International Airport",
          country: usCountry,
        },
        destination: {
          iata: "HKG",
          city: "Hong Kong",
          airport: "Hong Kong International Airport",
          country: "China (Hong Kong SAR)",
        },
      },
      {
        id: "JFK-DXB",
        distanceMiles: 6838,
        origin: {
          iata: "JFK",
          city: "New York",
          airport: "John F. Kennedy International Airport",
          country: usCountry,
        },
        destination: {
          iata: "DXB",
          city: "Dubai",
          airport: "Dubai International Airport",
          country: "United Arab Emirates",
        },
      },
      {
        id: "ORD-FRA",
        distanceMiles: 4342,
        origin: {
          iata: "ORD",
          city: "Chicago",
          airport: "Chicago O'Hare International Airport",
          country: usCountry,
        },
        destination: {
          iata: "FRA",
          city: "Frankfurt",
          airport: "Frankfurt Airport",
          country: "Germany",
        },
      },
      {
        id: "IAH-EZE",
        distanceMiles: 5121,
        origin: {
          iata: "IAH",
          city: "Houston",
          airport: "George Bush Intercontinental Airport",
          country: usCountry,
        },
        destination: {
          iata: "EZE",
          city: "Buenos Aires",
          airport: "Buenos Aires Ministro Pistarini International Airport",
          country: "Argentina",
        },
      },
    ],
  },
];

export const POPULAR_ROUTES: PopularRoute[] = POPULAR_ROUTE_GROUPS.flatMap(
  (group) => group.routes,
);

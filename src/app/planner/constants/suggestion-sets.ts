export type SuggestionSet = {
  id: string;
  popularRoutes: string[];
  funIdeas: string[];
};

export const SUGGESTION_SETS: SuggestionSet[] = [
  {
    id: "domestic-popular",
    popularRoutes: [
      "Flights from SFO to NYC next week",
      "LAX to London in December",
      "Chicago to Miami this weekend",
      "Boston to San Francisco direct",
    ],
    funIdeas: [
      "Beach getaways under $300",
      "Weekend in wine country",
      "Ski trip destinations",
      "Cozy winter cabin escapes",
    ],
  },
  {
    id: "international-hubs",
    popularRoutes: [
      "NYC to London next month",
      "LAX to Tokyo in spring",
      "SFO to Paris for the holidays",
      "Seattle to Seoul nonstop",
    ],
    funIdeas: [
      "European capital cities tour",
      "Asia adventure deals",
      "South America exploration",
      "Romantic escapes abroad",
    ],
  },
  {
    id: "west-coast-explorer",
    popularRoutes: [
      "Seattle to San Diego direct",
      "Portland to Las Vegas weekend",
      "SFO to Honolulu deals",
      "LA to Vancouver getaway",
    ],
    funIdeas: [
      "Pacific coast road trip spots",
      "Desert escapes from LA",
      "Island hopping routes",
      "Surf trips this month",
    ],
  },
  {
    id: "east-coast-favorites",
    popularRoutes: [
      "Boston to Miami direct flights",
      "DC to Orlando family trips",
      "NYC to Charleston getaway",
      "Philadelphia to Nashville weekend",
    ],
    funIdeas: [
      "Fall foliage tours",
      "Historic city breaks",
      "Coastal beach towns",
      "Southern food adventures",
    ],
  },
  {
    id: "budget-friendly",
    popularRoutes: [
      "Cheapest dates to Vegas",
      "Under $200 to Florida",
      "Budget flights to Mexico",
      "Austin to Denver low fares",
    ],
    funIdeas: [
      "Weekend trips under $150",
      "Off-season deals",
      "Flash sale destinations",
      "Last-minute adventure ideas",
    ],
  },
  {
    id: "adventure-seekers",
    popularRoutes: [
      "Denver to Jackson Hole",
      "SFO to Anchorage summer",
      "Phoenix to Moab direct",
      "Salt Lake City to Banff",
    ],
    funIdeas: [
      "National parks tours",
      "Mountain adventure trips",
      "Hiking destination deals",
      "Glacier viewing itineraries",
    ],
  },
  {
    id: "warm-weather-escapes",
    popularRoutes: [
      "Winter flights to Caribbean",
      "LA to Cabo this month",
      "Phoenix to Maui deals",
      "Houston to Cancun weekend",
    ],
    funIdeas: [
      "Tropical beach destinations",
      "Sun & sand getaways",
      "Resort vacation ideas",
      "Snorkeling paradise escapes",
    ],
  },
  {
    id: "city-breaks",
    popularRoutes: [
      "LA to NYC direct",
      "Chicago to Austin weekend",
      "Seattle to San Francisco",
      "Dallas to Chicago quick trip",
    ],
    funIdeas: [
      "Urban exploration trips",
      "Food & culture cities",
      "Nightlife destinations",
      "Art & design weekends",
    ],
  },
  {
    id: "seasonal-specials",
    popularRoutes: [
      "Spring break to Miami",
      "Summer in Europe deals",
      "Holiday flights to home",
      "Autumn escape to New England",
    ],
    funIdeas: [
      "Cherry blossom season trips",
      "Summer festival destinations",
      "Winter wonderland getaways",
      "Fourth of July escapes",
    ],
  },
  {
    id: "long-haul-dreams",
    popularRoutes: [
      "SFO to Sydney deals",
      "NYC to Dubai direct",
      "LA to Singapore cheapest dates",
      "Chicago to Cape Town adventure",
    ],
    funIdeas: [
      "Around the world routes",
      "Bucket list destinations",
      "Once-in-a-lifetime trips",
      "Luxury long-haul escapes",
    ],
  },
];

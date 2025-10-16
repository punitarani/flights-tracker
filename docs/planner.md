# AI Flight Planner

## Overview

The AI Flight Planner is an intelligent assistant that helps users find optimal flight options through natural language conversation. Built with the Vercel AI SDK and Groq's Llama 3.3 70B model, it provides fast, streaming responses with AI-generated React Server Components.

## Architecture

### Technology Stack

- **AI Provider**: Groq (Llama 3.3 70B Versatile)
- **Framework**: Vercel AI SDK with React Server Components
- **UI**: Next.js 15 + React 19 with streaming
- **Backend**: TRPC for type-safe API calls
- **Data**: Google Flights via existing flight search services

### Key Components

#### 1. Agent Service (`src/server/services/planner-agent.ts`)

The core agent that orchestrates AI interactions using `streamUI` from the AI SDK. Provides four main tools:

- `searchAirport` - Find airports by name, city, or code
- `searchFlightPrices` - Get calendar of prices across date range
- `searchFlightDetails` - Fetch detailed flight options for specific dates
- `getPopularRoutes` - Suggest popular routes for inspiration

#### 2. UI Components

**Server Components** (Streamed from AI):
- `PlannerLoadingState` - Shows progress during AI processing
- `PlannerResultCard` - Displays final recommendations
- `PlannerErrorState` - Handles error states

**Client Components**:
- `PlannerShell` - Main container with state management
- `PlannerPromptForm` - User input interface with quick prompts

#### 3. State Management

`usePlanner` hook manages:
- User prompt input
- Planning status (idle → planning → success/error)
- Streaming results from AI
- Error handling

### Data Flow

```
User Input → PlannerShell → TRPC Mutation → Agent Service → Groq API
                ↓                                    ↓
          usePlanner Hook ← ← ← ← ← ← Streaming RSCs
                ↓
          Real-time UI Updates
```

## Environment Variables

Add to `.env.local`:

```bash
# Groq AI
GROQ_API_KEY=gsk_...  # Get from https://console.groq.com
```

## Usage

### Basic Example

```typescript
// User prompt
"Find me a cheap flight from NYC to LA next month"

// AI agent will:
1. Search for NYC and LA airports (if needed)
2. Determine date range (next month)
3. Fetch calendar prices
4. Get detailed options for cheapest dates
5. Return 1-3 recommendations with reasoning
```

### Advanced Example

```typescript
// User prompt
"I want to visit Japan in spring under $800, prefer non-stop"

// AI agent will:
1. Identify spring dates (March-May)
2. Search popular US → Japan routes
3. Filter by budget and stops
4. Recommend best options with seasonal insights
```

## Features

### ✅ Implemented

- [x] Natural language processing of flight requests
- [x] Airport search and code resolution
- [x] Calendar price overview
- [x] Detailed flight options
- [x] Popular route suggestions
- [x] Real-time streaming UI updates
- [x] React Server Component generation
- [x] Error handling and retry
- [x] Mobile-responsive design

### 🚧 Future Enhancements

- [ ] Multi-city / complex itineraries
- [ ] Price alerts integration
- [ ] Award flight suggestions
- [ ] Hotel and car rental bundling
- [ ] Session persistence
- [ ] Conversation history
- [ ] Advanced filters (layover duration, aircraft type)
- [ ] Export itineraries to calendar

## Performance

- **Latency**: ~200-500ms first token (Groq hardware acceleration)
- **Throughput**: Streams results in real-time
- **Cost**: ~$0.05-0.10 per planning session
- **Caching**: In-memory deduplication during agent runs

## Limitations

### Current Constraints

1. **Stateless Sessions**: No conversation history between page refreshes
2. **Price-Only**: Award/points flights not yet supported
3. **Economy Default**: Other cabin classes require explicit mention
4. **Google Flights Data**: Limited to scraped availability
5. **Single User**: No multi-user planning or collaboration
6. **Max 3 Recommendations**: Keeps responses focused

### Known Issues

- Very ambiguous prompts may require follow-up questions
- Date parsing for relative terms ("next summer") may be imprecise
- Complex multi-city routes not fully supported
- Currency always defaults to USD

## Testing

### Manual Testing

1. Navigate to `/planner`
2. Enter a test prompt
3. Verify streaming updates appear
4. Check recommendations are relevant
5. Test error handling (invalid inputs)

### Unit Tests

```bash
bun test src/server/services/planner-agent.test.ts
```

### Integration Tests

```bash
bun run test:planner
```

(Tests to be added in future iteration)

## Monitoring

Agent actions are logged via `src/lib/logger.ts`:

```typescript
logger.info("Agent tool: searchAirport", { query, limit });
logger.error("Failed to plan itinerary", { error });
```

View logs in production via your logging provider.

## API Reference

### TRPC Endpoint

```typescript
// Mutation: planner.plan
const result = await trpc.planner.plan.mutate({
  prompt: string,        // Required: user's request
  filters?: {            // Optional: structured overrides
    origin?: string,     // 3-letter IATA code
    destination?: string,
    dateFrom?: string,   // YYYY-MM-DD
    dateTo?: string,
    maxPrice?: number,   // USD
  }
});
```

### Response

Returns a React Server Component (streamed):
- Loading states during processing
- Final recommendation card with text
- Error card if something fails

## Best Practices

### For Users

1. **Be Specific**: Include origin, destination, and dates
2. **Mention Budget**: If price is important
3. **State Preferences**: Non-stop, airlines, etc.
4. **Ask Follow-ups**: "What about next week?" works

### For Developers

1. **Keep Tools Fast**: <2s per tool execution
2. **Cache Aggressively**: Use `PlannerCache` for dupes
3. **Handle Errors Gracefully**: Return partial results if possible
4. **Monitor Token Usage**: Set appropriate `maxTokens`
5. **Test Prompt Variations**: Edge cases reveal issues

## Troubleshooting

### "Failed to plan itinerary"

- Check `GROQ_API_KEY` is set correctly
- Verify Groq API quota not exceeded
- Check network connectivity
- Review server logs for specific errors

### Streaming Not Working

- Ensure React 19 and Next.js 15+ installed
- Verify TRPC configured for streaming
- Check browser supports streaming responses

### Inaccurate Recommendations

- Review system prompt in `planner-agent.ts`
- Adjust temperature (lower = more deterministic)
- Add more examples to tool descriptions
- Improve tool result formatting

## Contributing

When adding new features:

1. Update tool definitions in `planner-agent.ts`
2. Add corresponding UI components if needed
3. Update this documentation
4. Add tests for new functionality
5. Update examples and best practices

## Support

For issues or questions:
- Check existing GitHub issues
- Review server logs for errors
- Consult AI SDK documentation: https://sdk.vercel.ai
- Groq API docs: https://console.groq.com/docs

# Bug Fix: Seats.aero Workflow Timeout Issue

## Problem

The `ProcessSeatsAeroSearchWorkflow` was timing out after ~60 seconds during the fetch step, even though:
- The workflow step timeout was configured for 10 minutes
- Sentry traces showed the actual API calls were completing quickly
- The step never completed successfully

## Root Cause Analysis

### The Issue

The seats.aero API client (`src/lib/fli/seats-aero/client.ts`) was making fetch calls **without any timeout mechanism**:

```typescript
// Before (problematic code)
const response = await this.fetchImpl(url, {
  method: "GET",
  headers: {
    "Partner-Authorization": this.apiKey,
    Accept: "application/json",
  },
});
```

### Why This Caused Timeouts

1. **No fetch timeout**: The fetch call had no `AbortController` or timeout configured
2. **Hanging connections**: If the seats.aero API started responding but hung during the response (network issues, slow streaming, incomplete responses), the fetch would wait indefinitely
3. **Cloudflare Worker subrequest limits**: Cloudflare Workers likely impose a default ~60-second timeout on outbound subrequests
4. **Step never completes**: When the fetch hangs past this limit, the subrequest times out, but the workflow step never receives a proper completion signal

The workflow step configuration (10-minute timeout with 3 retries) was never the issue - the underlying fetch was timing out first due to lack of explicit timeout handling.

## Solution

### 1. Added Timeout to Seats.aero Client

Added `AbortController` with a **5-minute timeout** to the seats.aero API client:

```typescript
// After (fixed code)
// Create AbortController with 5-minute timeout to prevent indefinite hangs
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

try {
  const response = await this.fetchImpl(url, {
    method: "GET",
    headers: {
      "Partner-Authorization": this.apiKey,
      Accept: "application/json",
    },
    signal: controller.signal,
  });
  
  // ... handle response
  
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    throw new SeatsAeroAPIError(
      "Request timeout: seats.aero API did not respond within 5 minutes",
      408,
      "Request Timeout",
    );
  }
  throw error;
} finally {
  clearTimeout(timeoutId);
}
```

**Why 5 minutes?**
- The workflow step has a 10-minute timeout
- Seats.aero API can be slow when processing large date ranges or busy routes
- 5 minutes provides ample time while still preventing indefinite hangs
- Leaves buffer for workflow overhead and retry logic

### 2. Added Timeouts to Worker Trigger Calls

Also added 30-second timeouts to workflow trigger endpoints for safety:

**In `src/server/services/seats-aero-search.ts`:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(`${workerUrl}/trigger/seats-aero-search`, {
    // ... headers
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeoutId);
}
```

**In `scripts/trigger-alerts.ts`:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(`${workerUrl}/trigger/check-alerts`, {
    // ... headers
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeoutId);
}
```

### 3. Added Test Coverage

Added tests to verify timeout behavior in `src/lib/fli/__tests__/seats-aero/client.test.ts`:

1. **Timeout test**: Verifies that fetch throws `SeatsAeroAPIError` with 408 status when request exceeds 5 minutes
2. **Signal test**: Verifies that `AbortSignal` is properly passed to fetch calls

## Files Changed

1. `src/lib/fli/seats-aero/client.ts` - Added 5-minute timeout with `AbortController`
2. `src/server/services/seats-aero-search.ts` - Added 30-second timeout to worker trigger
3. `scripts/trigger-alerts.ts` - Added 30-second timeout to workflow trigger
4. `src/lib/fli/__tests__/seats-aero/client.test.ts` - Added timeout tests

## Impact

### Before
- ❌ Workflow steps timing out after ~60 seconds
- ❌ Fetch calls hanging indefinitely on slow/incomplete responses
- ❌ No visibility into timeout issues
- ❌ Workflow retries exhausting without resolution

### After
- ✅ Explicit 5-minute timeout prevents indefinite hangs
- ✅ Proper error handling with 408 status code
- ✅ Clear timeout error messages in logs
- ✅ Workflow can properly retry on timeout errors
- ✅ Worker trigger calls protected with 30-second timeouts

## Testing

Run the seats.aero client tests:
```bash
bun test src/lib/fli/__tests__/seats-aero/client.test.ts
```

The tests verify:
- Normal API calls work correctly
- Timeout triggers after 5 minutes on hanging requests
- AbortSignal is properly passed to fetch
- Timeout errors have correct status code (408)

## Monitoring

Look for these improvements in production:

1. **Sentry traces**: Should now show explicit timeout errors instead of mysterious step failures
2. **Workflow retries**: Will properly retry after timeout errors instead of hanging
3. **Error logs**: Will show clear "Request timeout: seats.aero API did not respond within 5 minutes" messages
4. **Success rate**: Should increase as workflows can properly handle and retry timeout scenarios

## Related Configuration

The workflow pagination step still maintains its defensive configuration:

```typescript
// src/workers/workflows/process-seats-aero-search-pagination.ts
const stepOptions = {
  retries: {
    limit: 3,
    delay: "30 seconds" as const,
    backoff: "constant" as const,
  },
  timeout: "10 minutes" as const, // Step timeout (higher than fetch timeout)
};
```

This ensures:
- If fetch times out (5 min), step still has time to handle the error
- Step can retry up to 3 times with 30-second delays
- Total maximum time per step: ~15 minutes (3 retries × 5 min + delays)

## Lessons Learned

1. **Always add timeouts to external API calls**: Never rely on default platform timeouts
2. **Layer timeouts appropriately**: Fetch timeout < Step timeout to allow proper error handling
3. **Test timeout scenarios**: Verify timeout behavior with proper test coverage
4. **Monitor all fetch calls**: Even "quick" trigger endpoints should have timeouts for safety

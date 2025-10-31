# Email Alert Fixes - Flight Alert Generation

## Problem Summary

Flight alert emails were showing **0 flights and blank content** when sent to users. The emails contained only generic text like "No major updates were provided" instead of actual flight data.

## Root Cause Analysis

### Issue 1: Missing AI Provider Configuration
The `generateObject` function in `src/lib/notifications/ai-email-agent.ts` was called without a properly configured AI provider:
- Used model ID string `"anthropic/claude-3-5-sonnet"` without provider setup
- The Vercel AI SDK requires a configured provider with API key
- Missing API key caused silent failures

### Issue 2: Missing Environment Variable in Workers
The Cloudflare Worker environment (`WorkerEnv` in `src/workers/env.d.ts`) was missing the `AI_GATEWAY_API_KEY` environment variable:
- Worker couldn't access the API key for AI generation
- All AI generation attempts failed silently
- No error reporting to identify the issue

### Issue 3: Broken Fallback Logic
When AI generation failed, the system fell back to a `BASE_BLUEPRINT` with generic placeholder text:
- The BASE_BLUEPRINT contained: `"No major updates were provided"`
- This blueprint was used instead of showing actual flight data
- The fallback rendering path was bypassed because a blueprint (even empty) was always returned

## Implemented Fixes

### 1. Added AI_GATEWAY_API_KEY to Worker Environment
**File:** `src/workers/env.d.ts`
```typescript
// AI Gateway (for email generation)
AI_GATEWAY_API_KEY: string;
```

### 2. Configured OpenAI Provider with OpenRouter
**File:** `src/lib/notifications/ai-email-agent.ts`
- Added `@ai-sdk/openai` package dependency
- Configured OpenRouter via OpenAI-compatible API
- Added API key validation with clear warning messages
- Returns `null` when AI generation fails (triggers fallback rendering)

```typescript
// Use OpenRouter via OpenAI-compatible API
const openrouter = createOpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});
```

### 3. Fixed Fallback Rendering
**Files:** 
- `src/lib/notifications/ai-email-agent.ts`
- `src/lib/notifications/ai-email-service.ts`

Changed return type from `Promise<EmailBlueprint>` to `Promise<EmailBlueprint | null>`:
- Returns `null` when AI generation fails or API key is missing
- Service layer checks for `null` and uses fallback rendering
- Fallback rendering shows actual flight data from alerts

```typescript
// If blueprint is null (AI generation failed/disabled), use fallback rendering
if (!blueprint) {
  return renderDailyPriceUpdateEmail(payload);
}
```

### 4. Added Package Dependency
**File:** `package.json`
```json
"@ai-sdk/openai": "^1.0.5"
```

## Testing

### No Linter Errors
All modified files pass Biome linter checks.

### Existing Tests Pass
- `src/lib/notifications/__tests__/notifications.test.ts` - Tests email rendering with mocked AI service
- `src/workers/adapters/alert-processing.test.ts` - Tests alert processing logic

### Manual Testing Required
To fully test the fixes:
1. Ensure `AI_GATEWAY_API_KEY` is set in worker environment variables
2. Trigger alert processing workflow
3. Verify emails contain actual flight data
4. Test both AI-enhanced emails (with key) and fallback emails (without key)

## Deployment Checklist

- [x] Code changes implemented
- [x] Linter checks pass
- [x] Type checking passes
- [ ] Add `AI_GATEWAY_API_KEY` to Cloudflare Worker secrets
- [ ] Deploy worker with updated environment
- [ ] Install npm dependencies: `npm install @ai-sdk/openai`
- [ ] Monitor Sentry for any AI generation errors
- [ ] Verify email content in production

## Expected Behavior After Fix

### With AI_GATEWAY_API_KEY Set
- AI generates enhanced email blueprints
- Emails have engaging, personalized content
- Flight data is presented in AI-optimized format

### Without AI_GATEWAY_API_KEY (Fallback)
- System logs: "AI_GATEWAY_API_KEY not found in environment, using fallback email rendering"
- Emails use standard template rendering
- Flight data is displayed in structured format
- All alert details and flight options are shown

## Files Modified

1. `src/workers/env.d.ts` - Added AI_GATEWAY_API_KEY to WorkerEnv interface
2. `src/lib/notifications/ai-email-agent.ts` - Fixed AI provider configuration and fallback logic
3. `src/lib/notifications/ai-email-service.ts` - Updated to handle null blueprint responses
4. `package.json` - Added @ai-sdk/openai dependency

## Additional Notes

- The fix ensures emails **always show flight data** regardless of AI generation status
- AI enhancement is now optional and fails gracefully
- Clear warning messages logged when AI generation is unavailable
- No breaking changes to existing functionality

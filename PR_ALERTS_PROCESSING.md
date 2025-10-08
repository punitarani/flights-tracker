# PR: Implement Alerts Processing Logic with Notification System

## Summary

This PR implements a comprehensive alerts processing system that handles daily flight alerts for users. It includes a notification tracking system, efficient flight data fetching, and seamless integration with the existing notification templates.

## Changes Overview

### 1. Database Schema Updates (`src/db/schema.ts`)

Added two new tables:

#### **`notification` table**
Stores email notification records with status tracking:
- `id` (ntf-...) - Unique notification ID
- `userId` - User who received the notification
- `type` - Notification type ("daily" or "price-drop")
- `sentAt` - Timestamp when sent
- `recipient` - Email address
- `subject` - Email subject line
- `status` - Send status ("sent" or "failed")
- `errorMessage` - Optional error details if failed

#### **`alert_notification` table**
Junction table linking alerts to notifications (many-to-many):
- `id` (ant-...) - Unique record ID
- `notificationId` - Reference to notification
- `alertId` - Reference to alert
- `flightDataSnapshot` - JSONB snapshot of flight data
- `generatedAt` - Timestamp when generated

**Key Features:**
- Supports aggregating multiple alerts into one email
- Prevents duplicate sends via deduplication checks
- Stores historical flight data for audit trail
- Simple and functional MVP design

### 2. ID Generation System (`src/db/id.ts`)

Added new prefixes:
- `notification: "ntf"` - For notification records
- `alertNotification: "ant"` - For alert_notification junction records

### 3. Notifications Database Layer (`src/core/notifications-db.ts`)

New module providing CRUD operations:

**Key Functions:**
- `createNotification()` - Creates notification record
- `createAlertNotification()` - Creates alert-notification association
- `hasAlertBeenProcessedRecently()` - Checks if alert processed in last 23 hours
- `getLastNotificationForAlert()` - Gets most recent notification for an alert
- `createNotificationWithAlerts()` - Transaction-based batch creation
- `getNotificationsByUser()` - Retrieves user's notification history

**Features:**
- 23-hour deduplication window (allows for cron drift)
- Transaction support for atomicity
- Efficient querying with indexes on alertId and generatedAt

### 4. Alert Flight Fetcher (`src/core/alert-flight-fetcher.ts`)

Efficient flight data fetching service:

**Key Functions:**
- `fetchFlightDataForAlerts()` - Batch fetches flights for multiple alerts
- `convertAlertFiltersToFlightFilters()` - Converts alert format to search format
- `filterFlightsByAlertCriteria()` - Applies additional filtering (price, airlines, stops)

**Optimizations:**
- Groups alerts by route for potential batching
- Parallel fetching with Promise.all
- Limits to top 5 flights per alert
- Filters out non-matching results
- Comprehensive error handling per alert

### 5. Alert Processing Service (`src/core/alert-processing-service.ts`)

Main orchestration logic for processing daily alerts:

**Key Functions:**
- `processDailyAlertsForUser()` - Main entry point for user processing
- `filterUnprocessedAlerts()` - Removes recently processed alerts
- `filterAndUpdateExpiredAlerts()` - Auto-completes expired alerts
- `convertAlertToDescriptor()` - Formats alert for email template
- `getUserEmail()` - Fetches user email from Supabase
- `recordNotificationSent()` - Records notification with associated alerts

**Processing Flow:**
1. Get user email from Supabase
2. Get all active daily alerts for user
3. Filter out expired alerts and mark as completed
4. Filter out alerts processed in last 23 hours
5. Fetch flight data for remaining alerts
6. Format data for email template
7. Send aggregated email via notification service
8. Record notification with status

**Features:**
- Auto-completes alerts past their `alertEnd` date
- Skips alerts with no matching flights (records as failed)
- Aggregates multiple alerts into single email
- Comprehensive logging at each step
- Records both successful and failed notifications

### 6. Webhook Integration (`src/app/api/webhooks/process-flight-alerts/route.ts`)

Updated to integrate processing service:
- Imports and calls `processDailyAlertsForUser()` after acquiring user lock
- Maintains existing error handling and requeue logic
- Follows Vercel Fluid Compute best practices

## Design Decisions

### 1. **Deduplication Strategy**
- **Time-based**: 23-hour window (allows for cron drift)
- **User locking**: Prevents concurrent processing (existing)
- **Records all attempts**: Including failures, for audit trail

### 2. **Alert Expiration Handling**
- Auto-marks expired alerts as "completed"
- Does not process or send emails for expired alerts
- Happens before flight fetching to save API calls

### 3. **Flight Data Fetching**
- Top 5 flights per alert (configurable constant)
- Parallel fetching for performance
- Graceful failure handling per alert
- Additional filtering on top of search results

### 4. **Email Aggregation**
- One email per user per processing run
- Includes all due alerts with flights
- Skips email if no alerts have matching flights
- Still records attempt for deduplication

### 5. **Error Handling**
- Per-alert error isolation
- Records failed notifications
- Prevents infinite retries
- Comprehensive logging

## Testing

### Code Quality
✅ **Linter**: Passed with no issues
```bash
bun run lint
# Checked 126 files in 428ms. No fixes applied.
```

### Existing Tests
⚠️ Pre-existing test failures unrelated to this PR:
- Airport search component test (document not defined - test setup issue)
- Some fli search tests timing out (existing issue)
- Alert service tests (vi mock issue - test setup)

### Manual Testing Checklist
- [ ] Database migrations run successfully
- [ ] User email fetching works
- [ ] Alert filtering logic works correctly
- [ ] Flight data fetching handles errors gracefully
- [ ] Email sending and notification recording work
- [ ] Deduplication prevents duplicate sends
- [ ] Expired alerts are auto-completed
- [ ] Webhook processes users successfully

## Vercel Fluid Compute Compliance

This implementation follows Vercel Fluid Compute best practices:

1. ✅ **Optimized Concurrency**: Uses Node.js runtime with async/await
2. ✅ **Background Processing**: Processes in webhook with proper timeout handling
3. ✅ **Error Isolation**: Per-alert error handling prevents cascade failures
4. ✅ **Efficient Resource Usage**: 
   - Batch size of 10 users
   - User locking prevents duplicate work
   - Parallel flight fetching
5. ✅ **Dynamic Scaling**: Works with serverless auto-scaling
6. ✅ **Logging**: Comprehensive console logging for debugging

**Recommended Settings:**
- `maxDuration: 600` (10 minutes) - in vercel.json if flight searches are slow
- Default 300s should be sufficient for most cases

## Migration Required

⚠️ **IMPORTANT**: Database migration needed for new tables:

```bash
# Generate migration
bun run db:generate

# Review migration file in ./migrations/

# Apply migration (after PR approval)
bun run db:migrate
```

**Tables to create:**
- `notification`
- `alert_notification`

## Environment Variables

No new environment variables required. Uses existing:
- ✅ `DATABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `SUPABASE_SECRET_KEY`
- ✅ `RESEND_API_KEY`

## API Compatibility

✅ **Fully backward compatible**
- No changes to existing API endpoints
- Only adds processing logic to webhook
- Existing notification templates work as-is

## Performance Considerations

1. **Flight Search API**: 
   - Top 5 flights per alert (configurable)
   - Parallel fetching reduces total time
   - Timeout handling prevents hanging

2. **Database Queries**:
   - Indexed on alertId and generatedAt
   - Transaction-based for consistency
   - Efficient user lock mechanism (existing)

3. **Email Sending**:
   - One email per user (aggregated)
   - Reduces email volume significantly
   - Better user experience

## Future Enhancements

Potential improvements for future PRs:
1. Add retry logic with exponential backoff for failed alerts
2. Implement more sophisticated batching for same-route alerts
3. Add webhook endpoint for manual alert processing
4. Create admin dashboard for notification monitoring
5. Add metrics and monitoring (Datadog, CloudWatch, etc.)
6. Support for more alert types (price-drop, schedule-change, etc.)
7. Add user notification preferences

## Related Issues

Implements requirements from planning discussion:
- ✅ Simple but functional MVP database design
- ✅ Notification table to store email records
- ✅ Junction table for alert-notification relationships
- ✅ Prevents duplicate sends via deduplication
- ✅ Aggregates multiple alerts into one email
- ✅ Efficient flight data fetching with fli lib
- ✅ Integration with existing notification templates
- ✅ Auto-completion of expired alerts

## Checklist

- [x] Code follows project style guidelines (Biome lint passed)
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] No new warnings or errors introduced
- [x] Appropriate error handling added
- [x] Logging added for debugging
- [x] Database schema updates documented
- [x] Migration path documented
- [ ] Manual testing completed (after PR approval)
- [ ] Migration applied to dev/staging

## Screenshots/Demo

N/A - Backend processing logic only. Can test via:
1. Triggering webhook manually
2. Checking notification and alert_notification tables
3. Verifying email received with aggregated alerts

---

**Ready for review!** 🚀

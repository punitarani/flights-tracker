# Workers Database Quick Reference

## Database Client Usage

### Correct Pattern ✅

```typescript
import { getWorkerDb } from "@/workers/db";
import type { WorkerEnv } from "@/workers/env";

async function myDatabaseOperation(env: WorkerEnv) {
  const db = getWorkerDb(env); // Cached connection
  
  const results = await db
    .select()
    .from(myTable)
    .where(eq(myTable.id, "some-id"));
    
  return results;
}
```

### Anti-Pattern ❌

```typescript
// Don't create postgres client directly in workers
const client = postgres(env.DATABASE_URL);
const db = drizzle({ client });
```

## Batch Operations

### Optimal Batch Size

```typescript
// Good: Small batches (5-15 rows)
const batchSize = 10;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await db.insert(table).values(batch);
}

// Bad: Large batches (>20 rows)
await db.insert(table).values(allItems); // May hit query limits
```

### Upsert Pattern

```typescript
// Correct SQL EXCLUDED syntax
await db
  .insert(table)
  .values(values)
  .onConflictDoUpdate({
    target: table.uniqueColumn,
    set: {
      field1: sql.raw('EXCLUDED.field1'),
      field2: sql.raw('EXCLUDED.field2'),
    },
  });
```

## Error Handling

### Workflow Step Pattern

```typescript
await step.do(
  "step-name",
  {
    retries: {
      limit: 3,
      delay: "10 seconds" as const,
      backoff: "exponential" as const,
    },
    timeout: "5 minutes" as const,
  },
  async () => {
    // Your operation here
    return result;
  },
);
```

### Error Logging

```typescript
import { workerLogger } from "@/workers/utils/logger";
import { captureException } from "@/workers/utils/sentry";

try {
  await riskyOperation();
} catch (error) {
  workerLogger.error("Operation failed", {
    context: "useful-context",
    id: someId,
    error: error instanceof Error ? error.message : String(error),
  });
  
  captureException(error, {
    context: "operation-name",
    additionalData: someId,
  });
  
  throw error; // Re-throw for step retry
}
```

## Data Processing

### Deduplication with Radash

```typescript
import { unique } from "radash";

// Before: Manual Map-based deduplication
const uniqueItems = new Map<string, Item>();
for (const item of items) {
  uniqueItems.set(item.id, item);
}
const result = [...uniqueItems.values()];

// After: Radash unique
const result = unique(items, (item) => item.id);
```

### Parallel Processing

```typescript
import { parallel } from "radash";

// Process batches in parallel (limit concurrency)
await parallel(3, batches, async (batch) => {
  await processBatch(batch);
});
```

## Common Gotchas

### 1. Prepared Statements

❌ **Don't use prepared statements with Pgbouncer**
```typescript
const client = postgres(url, { prepare: true }); // WRONG
```

✅ **Always disable prepared statements**
```typescript
const client = postgres(url, { prepare: false }); // CORRECT
```

### 2. Connection Limits

❌ **Don't create multiple connections**
```typescript
// Wrong - creates many connections
for (const item of items) {
  const db = getWorkerDb(env);
  await db.insert(table).values(item);
}
```

✅ **Reuse database client**
```typescript
// Correct - reuses cached connection
const db = getWorkerDb(env);
for (const item of items) {
  await db.insert(table).values(item);
}
```

### 3. Workflow Context

❌ **Don't store connections in class fields**
```typescript
class MyWorkflow extends WorkflowEntrypoint {
  db = getWorkerDb(this.env); // WRONG - timing issue
}
```

✅ **Get connection in methods**
```typescript
class MyWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const db = getWorkerDb(this.env); // CORRECT
  }
}
```

## Performance Tips

1. **Batch Size**: 10-15 rows for complex tables
2. **Connection Caching**: Automatically handled by `getWorkerDb()`
3. **Transform Disable**: Set `transform: undefined` for performance
4. **Keep-Alive**: Use `keep_alive: 5` for Pgbouncer
5. **Error Isolation**: Catch and log errors per batch

## Monitoring Checklist

- [ ] Check Sentry for error rates
- [ ] Monitor workflow execution times
- [ ] Verify database connection counts
- [ ] Review batch processing logs
- [ ] Check step retry rates

## Quick Commands

```bash
# Run worker tests
bun run test:workers

# Deploy worker
bun run worker:deploy

# Watch worker logs
bun run worker:tail

# Trigger workflow manually
bun run trigger:alerts
```

## Configuration Reference

### wrangler.toml
```toml
[limits]
cpu_ms = 300000  # 5 minutes max CPU time

[[workflows]]
binding = "MY_WORKFLOW"
class_name = "MyWorkflow"
```

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@host:port/db
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=production
WORKER_API_KEY=secret
```

## Resources

- [Worker DB Implementation](/workspace/src/workers/db.ts)
- [Seats.aero Adapter](/workspace/src/workers/adapters/seats-aero.db.ts)
- [Workflow Example](/workspace/src/workers/workflows/process-seats-aero-search.ts)
- [Full Documentation](/workspace/docs/workers-optimization-2025-10-17.md)

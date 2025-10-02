## Database

- SQL migrations live in `supabase/migrations` and are managed by the Supabase CLI.
- Zod schemas in `src/db/schemas.ts` mirror the typed shapes used in the app.
- Generate TypeScript types from the database with:

```
npm run db:gen
```

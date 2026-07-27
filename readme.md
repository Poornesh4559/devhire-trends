# DataRole Radar

A full-stack Cloudflare Worker + D1 + React/Vite job intelligence portal.

## What we built

- Cloudflare Worker backend using `hono`
- D1 database schema for:
  - `sources`
  - `jobs`
  - `job_skills`
  - `applications`
  - `candidate_profile`
  - `ingestion_runs`
- Demo seed data for jobs, applications, sources, and profile
- Secure ingestion endpoint protected by `X-Ingest-Key`
- Candidate profile matching and backend API analysis
- React/Vite frontend dashboard with job listings, applications, sources, and profile views
- Local D1 persistence support via Wrangler

## What is done

- Backend API endpoints:
  - `/api/health`
  - `/api/dashboard`
  - `/api/jobs`
  - `/api/jobs/:id`
  - `/api/jobs/:id/status`
  - `/api/jobs/:id/analyze`
  - `/api/applications`
  - `/api/profile`
  - `/api/sources`
  - `/api/ingest`
  - `/api/sources/:id/sync`
- D1 schema in `migrations/0001_initial.sql`
- Seed data in `migrations/0002_seed.sql`
- Frontend dashboard under `src/client`
- Build config via `vite.config.ts`
- Worker config via `wrangler.jsonc`

## Pending work

- Production deployment configuration and Cloudflare domain setup
- Finalize `wrangler.jsonc` production `database_id` value
- Set `INGEST_API_KEY` and optional `GEMINI_API_KEY` for production
- Add or document specific Greenhouse/Lever connector setup
- Improve deployment docs and operations workflow

## Local setup

1. Install dependencies

```bash
cd c:/Users/poorn/Dev/devhire-trends
npm install
```

2. Create a D1 database

```bash
npx wrangler d1 create datarole-radar-db
```

3. Paste the returned `database_id` into `wrangler.jsonc` under the `DB` binding.

4. Create the metadata namespace and any required secrets

```bash
wrangler kv:namespace create METADATA
wrangler secret put SCRAPE_SECRET
```

5. Apply migrations to local D1 persistence

```bash
npx wrangler d1 migrations apply datarole-radar-db --local --persist-to d1
```

## Launching the app

### Full Worker + frontend

```bash
npx wrangler dev -l --persist-to d1 --local-protocol http --port 8790
```

Open:

```text
http://127.0.0.1:8790
```

### Frontend-only development

```bash
npm run dev
```

That runs Vite only on `http://localhost:5173` and does not automatically wire the Worker backend.

## Deploying to Cloudflare

When deploying, the Worker build must include the generated `dist/client` assets directory.

Use this command in your Cloudflare build step or local shell:

```bash
npm run deploy
```

This runs the Vite build first and then invokes Wrangler.

If Cloudflare is executing `npx wrangler deploy` directly, it will fail unless `npm run build` has already created `dist/client`.

## Notes

- Use `http://127.0.0.1:8790` for the full Worker app.
- `npm run dev` is useful only for UI development.
- Ensure `wrangler.jsonc` has the real `database_id` from the `wrangler d1 create` command.
- Set `INGEST_API_KEY` in your environment to use `/api/ingest` and `/api/sources/:id/sync` securely.
- If you want, you can also point frontend API calls to the Worker URL instead of `localhost:5173`.

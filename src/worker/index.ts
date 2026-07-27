import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { ApplicationStatus, CandidateProfile, JobInput, JobStatus, Source, WorkMode } from '../shared/types';
import { analyzeJob } from './ai';
import { fetchSourceJobs } from './connectors';
import {
  applyAnalysis,
  getDashboardStats,
  getJob,
  getProfile,
  listApplications,
  listJobs,
  listSources,
  updateApplication,
  updateJobStatus,
  updateProfile,
  upsertJob,
} from './db';
import type { AppEnv } from './env';

const app = new Hono<{ Bindings: AppEnv }>();

const workModeSchema = z.enum(['remote', 'hybrid', 'onsite', 'unknown']);
const jobInputSchema = z.object({
  sourceName: z.string().min(1).max(120),
  externalId: z.string().min(1).max(240),
  title: z.string().min(1).max(240),
  company: z.string().min(1).max(160),
  location: z.string().max(240).optional(),
  country: z.string().max(80).optional(),
  workMode: workModeSchema.optional(),
  employmentType: z.string().max(80).optional(),
  experienceMin: z.number().min(0).max(50).optional(),
  experienceMax: z.number().min(0).max(50).optional(),
  salaryMin: z.number().nonnegative().optional(),
  salaryMax: z.number().nonnegative().optional(),
  salaryCurrency: z.string().max(12).optional(),
  description: z.string().max(60000).optional(),
  applyUrl: z.string().url().max(2048),
  canonicalUrl: z.string().url().max(2048).optional(),
  postedAt: z.string().max(40).optional(),
  category: z.string().max(100).optional(),
  seniority: z.string().max(80).optional(),
  skills: z.array(z.string().max(80)).max(40).optional(),
});

const profileSchema = z.object({
  headline: z.string().min(1).max(200),
  yearsExperience: z.number().min(0).max(50),
  preferredLocations: z.array(z.string().max(100)).max(30),
  preferredModes: z.array(workModeSchema).max(4),
  coreSkills: z.array(z.string().max(80)).max(60),
  certifications: z.array(z.string().max(160)).max(30),
  targetRoles: z.array(z.string().max(120)).max(30),
});

async function secureEqual(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

async function authorizeIngest(c: { req: { header(name: string): string | undefined }; env: AppEnv }): Promise<boolean> {
  const expected = c.env.INGEST_API_KEY;
  const provided = c.req.header('X-Ingest-Key') || '';
  return Boolean(expected) && secureEqual(provided, expected!);
}

async function syncSource(env: AppEnv, source: Source): Promise<{ discovered: number; accepted: number }> {
  const run = await env.DB.prepare(`INSERT INTO ingestion_runs (source_id, provider, status) VALUES (?, ?, 'running') RETURNING id`)
    .bind(source.id, source.provider).first<{ id: number }>();
  if (!run) throw new Error('Could not start ingestion run');
  try {
    const [jobs, profile] = await Promise.all([fetchSourceJobs(source), getProfile(env.DB)]);
    let accepted = 0;
    for (const job of jobs) {
      const id = await upsertJob(env.DB, job, profile);
      await env.DB.prepare('UPDATE jobs SET source_id = ? WHERE id = ?').bind(source.id, id).run();
      accepted += 1;
    }
    await env.DB.batch([
      env.DB.prepare(`UPDATE ingestion_runs SET status = 'success', discovered_count = ?, accepted_count = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(jobs.length, accepted, run.id),
      env.DB.prepare('UPDATE sources SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?').bind(source.id),
    ]);
    return { discovered: jobs.length, accepted };
  } catch (error) {
    await env.DB.prepare(`UPDATE ingestion_runs SET status = 'failed', error_message = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(String(error).slice(0, 1000), run.id).run();
    throw error;
  }
}

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'datarole-radar', timestamp: new Date().toISOString() }));

app.get('/api/dashboard', async (c) => c.json(await getDashboardStats(c.env.DB)));

app.get('/api/jobs', async (c) => c.json(await listJobs(c.env.DB, new URL(c.req.url).searchParams)));

app.get('/api/jobs/:id', async (c) => {
  const job = await getJob(c.env.DB, Number(c.req.param('id')));
  return job ? c.json(job) : c.json({ error: 'Job not found' }, 404);
});

app.patch('/api/jobs/:id/status', zValidator('json', z.object({ status: z.enum(['new', 'saved', 'applied', 'interview', 'offer', 'rejected', 'archived']) })), async (c) => {
  await updateJobStatus(c.env.DB, Number(c.req.param('id')), c.req.valid('json').status as JobStatus);
  return c.json({ ok: true });
});

app.post('/api/jobs/:id/analyze', async (c) => {
  const id = Number(c.req.param('id'));
  const [job, profile] = await Promise.all([getJob(c.env.DB, id), getProfile(c.env.DB)]);
  if (!job) return c.json({ error: 'Job not found' }, 404);
  const analysis = await analyzeJob(c.env, job, profile);
  await applyAnalysis(c.env.DB, id, analysis);
  return c.json(analysis);
});

app.get('/api/applications', async (c) => c.json(await listApplications(c.env.DB)));

app.put('/api/applications/:jobId', zValidator('json', z.object({
  status: z.enum(['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn']),
  notes: z.string().max(5000).optional(),
  nextActionAt: z.string().max(40).optional(),
})), async (c) => {
  const body = c.req.valid('json');
  await updateApplication(c.env.DB, Number(c.req.param('jobId')), body.status as ApplicationStatus, body.notes, body.nextActionAt);
  return c.json({ ok: true });
});

app.get('/api/profile', async (c) => c.json(await getProfile(c.env.DB)));

app.put('/api/profile', zValidator('json', profileSchema), async (c) => {
  await updateProfile(c.env.DB, c.req.valid('json') as CandidateProfile);
  return c.json({ ok: true });
});

app.get('/api/sources', async (c) => c.json(await listSources(c.env.DB)));

app.post('/api/sources', zValidator('json', z.object({
  name: z.string().min(1).max(120),
  provider: z.enum(['greenhouse', 'lever']),
  token: z.string().min(1).max(160),
  baseUrl: z.string().url().optional(),
})), async (c) => {
  const body = c.req.valid('json');
  const result = await c.env.DB.prepare(`INSERT INTO sources (name, provider, token, base_url) VALUES (?, ?, ?, ?)
    ON CONFLICT(provider, token) DO UPDATE SET name = excluded.name, base_url = excluded.base_url, enabled = 1 RETURNING id`)
    .bind(body.name, body.provider, body.token, body.baseUrl || null).first<{ id: number }>();
  return c.json({ id: result?.id }, 201);
});

app.post('/api/ingest', zValidator('json', z.object({ jobs: z.array(jobInputSchema).min(1).max(100), useAi: z.boolean().optional() })), async (c) => {
  if (!(await authorizeIngest(c))) return c.json({ error: 'Unauthorized' }, 401);
  const body = c.req.valid('json');
  const profile = await getProfile(c.env.DB);
  const ids: number[] = [];
  for (const job of body.jobs as JobInput[]) {
    const analysis = body.useAi ? await analyzeJob(c.env, job, profile) : undefined;
    ids.push(await upsertJob(c.env.DB, job, profile, analysis));
  }
  console.log(JSON.stringify({ message: 'ingestion complete', accepted: ids.length, ai: Boolean(body.useAi) }));
  return c.json({ accepted: ids.length, ids }, 202);
});

app.post('/api/sources/:id/sync', async (c) => {
  if (!(await authorizeIngest(c))) return c.json({ error: 'Unauthorized' }, 401);
  const source = (await listSources(c.env.DB)).find((item) => item.id === Number(c.req.param('id')));
  if (!source) return c.json({ error: 'Source not found' }, 404);
  return c.json(await syncSource(c.env, source));
});

app.onError((error, c) => {
  console.error(JSON.stringify({ message: 'request failed', path: new URL(c.req.url).pathname, error: error.message }));
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: AppEnv, ctx: ExecutionContext): Promise<void> {
    const task = (async () => {
      const sources = (await listSources(env.DB)).filter((source) => source.enabled && ['greenhouse', 'lever'].includes(source.provider));
      for (const source of sources) {
        try {
          const result = await syncSource(env, source);
          console.log(JSON.stringify({ message: 'scheduled source sync complete', source: source.name, ...result }));
        } catch (error) {
          console.error(JSON.stringify({ message: 'scheduled source sync failed', source: source.name, error: String(error) }));
        }
      }
    })();
    ctx.waitUntil(task);
  },
} satisfies ExportedHandler<AppEnv>;

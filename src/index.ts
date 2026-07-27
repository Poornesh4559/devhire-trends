import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { scrapeMonth } from './scraper';
import { getTrends, searchJobs, getJobsByMonth, getLatestMonth, getTechStackCounts } from './db';
import { renderDashboard } from './dashboard';

interface Env {
  DB: D1Database;
  METADATA: KVNamespace;
  SCRAPE_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/', async (c) => {
  const trends = await getTrends(c.env.DB, 12);
  const latestMonth = await getLatestMonth(c.env.DB);
  return c.html(renderDashboard(trends, latestMonth));
});

app.get('/api/trends', async (c) => {
  const months = parseInt(c.req.query('months') || '12');
  const trends = await getTrends(c.env.DB, months);
  return c.json(trends);
});

app.get('/api/search', async (c) => {
  const query = c.req.query('q');
  const month = c.req.query('month');
  if (!query) return c.json({ error: 'Query required' }, 400);
  
  const jobs = await searchJobs(c.env.DB, query, month || undefined);
  return c.json(jobs);
});

app.get('/api/jobs/:month', async (c) => {
  const month = c.req.param('month');
  const jobs = await getJobsByMonth(c.env.DB, month);
  return c.json(jobs);
});

app.get('/api/jobs/latest', async (c) => {
  const latestMonth = await getLatestMonth(c.env.DB);
  if (!latestMonth) return c.json([]);
  const jobs = await getJobsByMonth(c.env.DB, latestMonth);
  return c.json(jobs);
});

app.get('/api/tech-trends', async (c) => {
  const month = c.req.query('month');
  if (!month) {
    const latestMonth = await getLatestMonth(c.env.DB);
    if (!latestMonth) return c.json({ error: 'No data' }, 404);
    const counts = await getTechStackCounts(c.env.DB, latestMonth);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    return c.json({ month: latestMonth, tech: sorted });
  }
  const counts = await getTechStackCounts(c.env.DB, month);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  return c.json({ month, tech: sorted });
});

const scrapeAuth = bearerAuth<{ Bindings: Env }>({
  verifyToken: (token, c) => token === (c.env.SCRAPE_SECRET || 'dev-scrape-key'),
  noAuthenticationHeader: { message: { error: 'Scrape secret required' } },
  invalidToken: { message: { error: 'Invalid scrape secret' } }
});

app.post('/api/scrape', scrapeAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const month = body.month || getCurrentMonth();
  
  const result = await scrapeMonth(c.env.DB, c.env.METADATA, month);
  return c.json(result);
});

app.post('/api/scrape/:month', scrapeAuth, async (c) => {
  const month = c.req.param('month');
  const result = await scrapeMonth(c.env.DB, c.env.METADATA, month);
  return c.json(result);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const currentMonth = getCurrentMonth();
    console.log(`Cron triggered: Scraping ${currentMonth}`);
    
    const result = await scrapeMonth(env.DB, env.METADATA, currentMonth);
    console.log('Scrape result:', result);
    
    const prevMonth = getPreviousMonth();
    const prevScraped = await env.METADATA.get(`scraped:${prevMonth}`);
    if (!prevScraped) {
      const prevResult = await scrapeMonth(env.DB, env.METADATA, prevMonth);
      console.log('Previous month scrape result:', prevResult);
    }
  }
};

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousMonth(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
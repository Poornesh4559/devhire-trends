import type { JobInput, Source, WorkMode } from '../shared/types';

const DATA_ROLE = /data engineer|analytics engineer|data platform|etl|lakehouse|big data|spark engineer|data infrastructure/i;
const INDIA = /india|bengaluru|bangalore|hyderabad|pune|chennai|gurugram|gurgaon|mumbai|noida|remote/i;

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function inferMode(location: string, explicit?: string): WorkMode {
  const value = `${location} ${explicit || ''}`.toLowerCase();
  if (value.includes('hybrid')) return 'hybrid';
  if (value.includes('remote')) return 'remote';
  if (value.includes('on-site') || value.includes('onsite') || location) return 'onsite';
  return 'unknown';
}

function relevant(title: string, location: string): boolean {
  return DATA_ROLE.test(title) && INDIA.test(location);
}

interface GreenhouseResponse {
  jobs: Array<{
    id: number;
    title: string;
    updated_at?: string;
    absolute_url: string;
    location?: { name?: string };
    content?: string;
    departments?: Array<{ name: string }>;
  }>;
}

async function fetchGreenhouse(source: Source): Promise<JobInput[]> {
  if (!source.token) return [];
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.token)}/jobs?content=true`);
  if (!response.ok) throw new Error(`Greenhouse ${source.name} returned ${response.status}`);
  const payload = await response.json<GreenhouseResponse>();
  return payload.jobs
    .filter((job) => relevant(job.title, job.location?.name || ''))
    .slice(0, 200)
    .map((job) => ({
      sourceName: `Greenhouse · ${source.name}`,
      externalId: String(job.id),
      title: job.title,
      company: source.name,
      location: job.location?.name || 'India',
      country: 'India',
      workMode: inferMode(job.location?.name || ''),
      employmentType: 'Full-time',
      description: stripHtml(job.content || ''),
      applyUrl: job.absolute_url,
      canonicalUrl: job.absolute_url,
      postedAt: job.updated_at,
      category: job.departments?.[0]?.name,
    }));
}

interface LeverPosting {
  id: string;
  text: string;
  country?: string;
  categories?: { location?: string; commitment?: string; team?: string; department?: string; allLocations?: string[] };
  descriptionPlain?: string;
  openingPlain?: string;
  additionalPlain?: string;
  hostedUrl: string;
  applyUrl: string;
  workplaceType?: string;
  salaryRange?: { min?: number; max?: number; currency?: string };
}

async function fetchLever(source: Source): Promise<JobInput[]> {
  if (!source.token) return [];
  const base = source.baseUrl || 'https://api.lever.co/v0/postings';
  const response = await fetch(`${base}/${encodeURIComponent(source.token)}?mode=json&limit=200`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Lever ${source.name} returned ${response.status}`);
  const postings = await response.json<LeverPosting[]>();
  return postings
    .filter((job) => relevant(job.text, [job.categories?.location, ...(job.categories?.allLocations || [])].filter(Boolean).join(' ')))
    .map((job) => {
      const location = job.categories?.allLocations?.join(', ') || job.categories?.location || 'India';
      return {
        sourceName: `Lever · ${source.name}`,
        externalId: job.id,
        title: job.text,
        company: source.name,
        location,
        country: job.country || 'India',
        workMode: inferMode(location, job.workplaceType),
        employmentType: job.categories?.commitment,
        salaryMin: job.salaryRange?.min,
        salaryMax: job.salaryRange?.max,
        salaryCurrency: job.salaryRange?.currency,
        description: [job.openingPlain, job.descriptionPlain, job.additionalPlain].filter(Boolean).join('\n'),
        applyUrl: job.applyUrl || job.hostedUrl,
        canonicalUrl: job.hostedUrl,
        category: job.categories?.department || job.categories?.team,
      } satisfies JobInput;
    });
}

export async function fetchSourceJobs(source: Source): Promise<JobInput[]> {
  if (!source.enabled) return [];
  if (source.provider === 'greenhouse') return fetchGreenhouse(source);
  if (source.provider === 'lever') return fetchLever(source);
  return [];
}

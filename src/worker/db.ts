import type {
  ApplicationStatus,
  CandidateProfile,
  DashboardStats,
  Job,
  JobInput,
  JobStatus,
  MatchAnalysis,
  Source,
  WorkMode,
} from '../shared/types';

const SKILL_ALIASES: Record<string, string> = {
  pyspark: 'PySpark', spark: 'Spark', databricks: 'Databricks', 'delta lake': 'Delta Lake',
  python: 'Python', sql: 'SQL', etl: 'ETL', aws: 'AWS', gcp: 'GCP', airflow: 'Airflow',
  kafka: 'Kafka', dbt: 'dbt', snowflake: 'Snowflake', azure: 'Azure', flink: 'Flink',
  glue: 'AWS Glue', bigquery: 'BigQuery', redshift: 'Redshift', terraform: 'Terraform',
};

interface JobRow {
  id: number;
  source_id: number | null;
  source_name: string;
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  country: string | null;
  work_mode: WorkMode;
  employment_type: string | null;
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  description: string | null;
  apply_url: string;
  canonical_url: string;
  posted_at: string | null;
  discovered_at: string;
  category: string | null;
  seniority: string | null;
  match_score: number;
  match_reason: string | null;
  ai_summary: string | null;
  status: JobStatus;
  is_active: number;
  skills: string | null;
}

function splitSkills(value: string | null): string[] {
  return value ? value.split('|||').filter(Boolean) : [];
}

function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name,
    externalId: row.external_id,
    title: row.title,
    company: row.company,
    location: row.location ?? undefined,
    country: row.country ?? undefined,
    workMode: row.work_mode,
    employmentType: row.employment_type ?? undefined,
    experienceMin: row.experience_min ?? undefined,
    experienceMax: row.experience_max ?? undefined,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    salaryCurrency: row.salary_currency ?? undefined,
    description: row.description ?? undefined,
    applyUrl: row.apply_url,
    canonicalUrl: row.canonical_url,
    postedAt: row.posted_at ?? undefined,
    category: row.category ?? undefined,
    seniority: row.seniority ?? undefined,
    matchScore: row.match_score,
    matchReason: row.match_reason,
    aiSummary: row.ai_summary,
    status: row.status,
    discoveredAt: row.discovered_at,
    isActive: Boolean(row.is_active),
    skills: splitSkills(row.skills),
  };
}

const JOB_SELECT = `
  SELECT j.*, GROUP_CONCAT(js.skill, '|||') AS skills
  FROM jobs j
  LEFT JOIN job_skills js ON js.job_id = j.id
`;

export function deterministicAnalysis(job: JobInput, profile: CandidateProfile): MatchAnalysis {
  const text = `${job.title} ${job.description || ''} ${(job.skills || []).join(' ')}`.toLowerCase();
  const detected = new Set<string>(job.skills || []);
  for (const [needle, label] of Object.entries(SKILL_ALIASES)) {
    if (text.includes(needle)) detected.add(label);
  }

  const profileSkills = new Set(profile.coreSkills.map((skill) => skill.toLowerCase()));
  const matched = [...detected].filter((skill) => profileSkills.has(skill.toLowerCase()));
  const roleMatch = profile.targetRoles.some((role) => job.title.toLowerCase().includes(role.toLowerCase())) ||
    /data|analytics|etl|lakehouse|platform/.test(job.title.toLowerCase());
  const indiaMatch = /india|bengaluru|bangalore|hyderabad|pune|chennai|gurugram|gurgaon|mumbai|remote/i.test(job.location || job.country || '');
  const experienceMatch = job.experienceMin == null || job.experienceMin <= profile.yearsExperience + 1;
  const score = Math.min(100, 28 + matched.length * 7 + (roleMatch ? 20 : 0) + (indiaMatch ? 10 : 0) + (experienceMatch ? 8 : 0));
  const category = /analytics/i.test(job.title) ? 'Analytics Engineering' : /platform/i.test(job.title) ? 'Data Platform' : 'Data Engineering';
  const seniority = /lead|staff|principal/i.test(job.title) ? 'Lead' : /senior|sr\.?/i.test(job.title) ? 'Senior' : /intern|graduate|junior/i.test(job.title) ? 'Entry' : 'Mid-level';

  return {
    score,
    category,
    seniority,
    skills: [...detected],
    summary: `${job.title} at ${job.company} with ${matched.slice(0, 4).join(', ') || 'adjacent data platform'} overlap.`,
    reason: matched.length
      ? `Matches ${matched.join(', ')}${experienceMatch ? ' at a suitable experience level' : ''}.`
      : 'Role is relevant to data engineering, but the description has limited overlap with your core stack.',
  };
}

export async function getProfile(db: D1Database): Promise<CandidateProfile> {
  const row = await db.prepare('SELECT * FROM candidate_profile WHERE id = 1').first<{
    headline: string; years_experience: number; preferred_locations: string; preferred_modes: string;
    core_skills: string; certifications: string; target_roles: string;
  }>();
  if (!row) throw new Error('Candidate profile is not initialized');
  return {
    headline: row.headline,
    yearsExperience: row.years_experience,
    preferredLocations: JSON.parse(row.preferred_locations),
    preferredModes: JSON.parse(row.preferred_modes),
    coreSkills: JSON.parse(row.core_skills),
    certifications: JSON.parse(row.certifications),
    targetRoles: JSON.parse(row.target_roles),
  };
}

export async function updateProfile(db: D1Database, profile: CandidateProfile): Promise<void> {
  await db.prepare(`UPDATE candidate_profile SET headline = ?, years_experience = ?, preferred_locations = ?,
    preferred_modes = ?, core_skills = ?, certifications = ?, target_roles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`)
    .bind(profile.headline, profile.yearsExperience, JSON.stringify(profile.preferredLocations),
      JSON.stringify(profile.preferredModes), JSON.stringify(profile.coreSkills), JSON.stringify(profile.certifications),
      JSON.stringify(profile.targetRoles)).run();
}

export async function listJobs(db: D1Database, filters: URLSearchParams): Promise<Job[]> {
  const clauses = ['j.is_active = 1'];
  const values: unknown[] = [];
  const query = filters.get('q');
  if (query) {
    clauses.push('(j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ? OR j.location LIKE ?)');
    const term = `%${query}%`;
    values.push(term, term, term, term);
  }
  for (const [param, column] of [['status', 'j.status'], ['mode', 'j.work_mode'], ['source', 'j.source_name']] as const) {
    const value = filters.get(param);
    if (value && value !== 'all') { clauses.push(`${column} = ?`); values.push(value); }
  }
  const location = filters.get('location');
  if (location && location !== 'all') { clauses.push('j.location LIKE ?'); values.push(`%${location}%`); }
  const minimumScore = Number(filters.get('minScore') || 0);
  if (minimumScore > 0) { clauses.push('j.match_score >= ?'); values.push(minimumScore); }
  const limit = Math.min(200, Math.max(1, Number(filters.get('limit') || 100)));
  values.push(limit);
  const result = await db.prepare(`${JOB_SELECT} WHERE ${clauses.join(' AND ')} GROUP BY j.id ORDER BY j.match_score DESC, COALESCE(j.posted_at, j.discovered_at) DESC LIMIT ?`)
    .bind(...values).all<JobRow>();
  return result.results.map(mapJob);
}

export async function getJob(db: D1Database, id: number): Promise<Job | null> {
  const row = await db.prepare(`${JOB_SELECT} WHERE j.id = ? GROUP BY j.id`).bind(id).first<JobRow>();
  return row ? mapJob(row) : null;
}

export async function upsertJob(db: D1Database, input: JobInput, profile: CandidateProfile, analysis?: MatchAnalysis): Promise<number> {
  const match = analysis || deterministicAnalysis(input, profile);
  const canonicalUrl = input.canonicalUrl || input.applyUrl;
  const row = await db.prepare(`
    INSERT INTO jobs (source_name, external_id, title, company, location, country, work_mode, employment_type,
      experience_min, experience_max, salary_min, salary_max, salary_currency, description, apply_url,
      canonical_url, posted_at, category, seniority, match_score, match_reason, ai_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_name, external_id) DO UPDATE SET
      title = excluded.title, company = excluded.company, location = excluded.location, country = excluded.country,
      work_mode = excluded.work_mode, employment_type = excluded.employment_type, description = excluded.description,
      apply_url = excluded.apply_url, canonical_url = excluded.canonical_url, posted_at = excluded.posted_at,
      category = excluded.category, seniority = excluded.seniority, match_score = excluded.match_score,
      match_reason = excluded.match_reason, ai_summary = excluded.ai_summary, updated_at = CURRENT_TIMESTAMP, is_active = 1
    RETURNING id
  `).bind(input.sourceName, input.externalId, input.title, input.company, input.location || null, input.country || 'India',
    input.workMode || 'unknown', input.employmentType || null, input.experienceMin ?? null, input.experienceMax ?? null,
    input.salaryMin ?? null, input.salaryMax ?? null, input.salaryCurrency || null, input.description || null,
    input.applyUrl, canonicalUrl, input.postedAt || null, match.category, match.seniority, match.score, match.reason,
    match.summary).first<{ id: number }>();
  if (!row) throw new Error('Job upsert did not return an id');

  await db.prepare('DELETE FROM job_skills WHERE job_id = ?').bind(row.id).run();
  if (match.skills.length) {
    const statement = db.prepare('INSERT OR IGNORE INTO job_skills (job_id, skill, required) VALUES (?, ?, 0)');
    await db.batch(match.skills.slice(0, 30).map((skill) => statement.bind(row.id, skill)));
  }
  return row.id;
}

export async function applyAnalysis(db: D1Database, id: number, analysis: MatchAnalysis): Promise<void> {
  await db.prepare(`UPDATE jobs SET match_score = ?, category = ?, seniority = ?, match_reason = ?, ai_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(analysis.score, analysis.category, analysis.seniority, analysis.reason, analysis.summary, id).run();
  await db.prepare('DELETE FROM job_skills WHERE job_id = ?').bind(id).run();
  if (analysis.skills.length) {
    const statement = db.prepare('INSERT OR IGNORE INTO job_skills (job_id, skill, required) VALUES (?, ?, 0)');
    await db.batch(analysis.skills.slice(0, 30).map((skill) => statement.bind(id, skill)));
  }
}

export async function updateJobStatus(db: D1Database, id: number, status: JobStatus): Promise<void> {
  await db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, id).run();
  if (['saved', 'applied', 'interview', 'offer', 'rejected'].includes(status)) {
    await db.prepare(`INSERT INTO applications (job_id, status, applied_at) VALUES (?, ?, CASE WHEN ? = 'applied' THEN CURRENT_TIMESTAMP ELSE NULL END)
      ON CONFLICT(job_id) DO UPDATE SET status = excluded.status,
      applied_at = CASE WHEN applications.applied_at IS NULL AND excluded.status = 'applied' THEN CURRENT_TIMESTAMP ELSE applications.applied_at END,
      updated_at = CURRENT_TIMESTAMP`).bind(id, status, status).run();
  }
}

export async function updateApplication(db: D1Database, jobId: number, status: ApplicationStatus, notes?: string, nextActionAt?: string): Promise<void> {
  await db.batch([
    db.prepare(`INSERT INTO applications (job_id, status, applied_at, notes, next_action_at) VALUES (?, ?, CASE WHEN ? = 'applied' THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET status = excluded.status, notes = excluded.notes, next_action_at = excluded.next_action_at,
      applied_at = CASE WHEN applications.applied_at IS NULL AND excluded.status = 'applied' THEN CURRENT_TIMESTAMP ELSE applications.applied_at END,
      updated_at = CURRENT_TIMESTAMP`).bind(jobId, status, status, notes || null, nextActionAt || null),
    db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status === 'withdrawn' ? 'archived' : status, jobId),
  ]);
}

export async function listApplications(db: D1Database): Promise<Array<{ jobId: number; status: ApplicationStatus; notes: string | null; nextActionAt: string | null; job: Job }>> {
  const result = await db.prepare(`${JOB_SELECT}
    JOIN applications a ON a.job_id = j.id
    GROUP BY j.id ORDER BY CASE a.status WHEN 'offer' THEN 1 WHEN 'interview' THEN 2 WHEN 'applied' THEN 3 ELSE 4 END, a.updated_at DESC`)
    .all<JobRow & { status: JobStatus }>();
  const metadata = await db.prepare('SELECT job_id, status, notes, next_action_at FROM applications').all<{
    job_id: number; status: ApplicationStatus; notes: string | null; next_action_at: string | null;
  }>();
  const byJob = new Map(metadata.results.map((item) => [item.job_id, item]));
  return result.results.map((row) => {
    const item = byJob.get(row.id)!;
    return { jobId: row.id, status: item.status, notes: item.notes, nextActionAt: item.next_action_at, job: mapJob(row) };
  });
}

export async function getDashboardStats(db: D1Database): Promise<DashboardStats> {
  const [summary, skills, sources, trend] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total_active,
      SUM(CASE WHEN match_score >= 85 THEN 1 ELSE 0 END) AS strong_matches,
      SUM(CASE WHEN status = 'saved' THEN 1 ELSE 0 END) AS saved,
      SUM(CASE WHEN status IN ('applied','interview','offer') THEN 1 ELSE 0 END) AS active_applications,
      SUM(CASE WHEN discovered_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS new_this_week,
      ROUND(AVG(match_score), 0) AS average_score FROM jobs WHERE is_active = 1`),
    db.prepare(`SELECT skill, COUNT(*) AS count FROM job_skills GROUP BY skill ORDER BY count DESC LIMIT 8`),
    db.prepare(`SELECT source_name AS source, COUNT(*) AS count FROM jobs WHERE is_active = 1 GROUP BY source_name ORDER BY count DESC LIMIT 6`),
    db.prepare(`SELECT date(discovered_at) AS day, COUNT(*) AS count FROM jobs WHERE discovered_at >= datetime('now','-14 days') GROUP BY date(discovered_at) ORDER BY day`),
  ]);
  const totals = (summary.results[0] || {}) as Record<string, number | null>;
  return {
    totalActive: totals.total_active || 0,
    strongMatches: totals.strong_matches || 0,
    saved: totals.saved || 0,
    activeApplications: totals.active_applications || 0,
    newThisWeek: totals.new_this_week || 0,
    averageScore: totals.average_score || 0,
    topSkills: skills.results as Array<{ skill: string; count: number }>,
    sourceBreakdown: sources.results as Array<{ source: string; count: number }>,
    weeklyTrend: trend.results as Array<{ day: string; count: number }>,
  };
}

export async function listSources(db: D1Database): Promise<Source[]> {
  const result = await db.prepare('SELECT * FROM sources ORDER BY name').all<{
    id: number; name: string; provider: Source['provider']; token: string | null; base_url: string | null; enabled: number; last_synced_at: string | null;
  }>();
  return result.results.map((row) => ({ id: row.id, name: row.name, provider: row.provider, token: row.token,
    baseUrl: row.base_url, enabled: Boolean(row.enabled), lastSyncedAt: row.last_synced_at }));
}

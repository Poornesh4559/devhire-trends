import type { D1Database } from '@cloudflare/workers-types';

export interface JobPosting {
  id?: number;
  hn_id: string;
  thread_month: string;
  company: string | null;
  role: string | null;
  location: string | null;
  is_remote: number;
  is_hybrid: number;
  is_onsite: number;
  tech_stack: string | null;
  raw_comment: string;
  hn_url: string | null;
  posted_at: string | null;
  created_at?: string;
}

export async function insertJob(db: D1Database, job: JobPosting): Promise<void> {
  await db.prepare(`
    INSERT OR IGNORE INTO job_postings 
    (hn_id, thread_month, company, role, location, is_remote, is_hybrid, is_onsite, tech_stack, raw_comment, hn_url, posted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    job.hn_id,
    job.thread_month,
    job.company,
    job.role,
    job.location,
    job.is_remote,
    job.is_hybrid,
    job.is_onsite,
    job.tech_stack,
    job.raw_comment,
    job.hn_url,
    job.posted_at
  ).run();
}

export async function getJobsByMonth(db: D1Database, month: string): Promise<JobPosting[]> {
  const result = await db.prepare(
    'SELECT * FROM job_postings WHERE thread_month = ? ORDER BY created_at DESC'
  ).bind(month).all<JobPosting>();
  return result.results || [];
}

export async function searchJobs(db: D1Database, query: string, month?: string): Promise<JobPosting[]> {
  let sql = `SELECT * FROM job_postings WHERE 
    raw_comment LIKE ? OR 
    company LIKE ? OR 
    role LIKE ? OR 
    tech_stack LIKE ?`;
  const params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];
  
  if (month) {
    sql += ' AND thread_month = ?';
    params.push(month);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  
  const result = await db.prepare(sql).bind(...params).all<JobPosting>();
  return result.results || [];
}

export async function getTrends(db: D1Database, months: number = 12): Promise<any[]> {
  const result = await db.prepare(`
    SELECT 
      thread_month as month,
      COUNT(*) as total_jobs,
      SUM(is_remote) as remote_count,
      SUM(is_hybrid) as hybrid_count,
      SUM(is_onsite) as onsite_count,
      ROUND(SUM(is_remote) * 100.0 / COUNT(*), 1) as remote_pct
    FROM job_postings 
    WHERE thread_month >= date('now', '-' || ? || ' months')
    GROUP BY thread_month 
    ORDER BY thread_month ASC
  `).bind(months).all();
  return result.results || [];
}

export async function getTechStackCounts(db: D1Database, month: string): Promise<Record<string, number>> {
  const result = await db.prepare(
    'SELECT tech_stack FROM job_postings WHERE thread_month = ? AND tech_stack IS NOT NULL'
  ).bind(month).all<{ tech_stack: string }>();
  
  const counts: Record<string, number> = {};
  for (const row of result.results || []) {
    const techs = row.tech_stack.split(',').map(t => t.trim().toLowerCase());
    for (const tech of techs) {
      if (tech) counts[tech] = (counts[tech] || 0) + 1;
    }
  }
  return counts;
}

export async function getLatestMonth(db: D1Database): Promise<string | null> {
  const result = await db.prepare(
    'SELECT thread_month FROM job_postings ORDER BY thread_month DESC LIMIT 1'
  ).first<{ thread_month: string }>();
  return result?.thread_month || null;
}
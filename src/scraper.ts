import * as cheerio from 'cheerio';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { insertJob } from './db';

const HIRING_THREAD_TITLES = [
  'who is hiring',
  "who's hiring",
  'who is hiring?',
  "who's hiring?"
];

interface ScrapedJob {
  hn_id: string;
  company: string | null;
  role: string | null;
  location: string | null;
  is_remote: number;
  is_hybrid: number;
  is_onsite: number;
  tech_stack: string | null;
  raw_comment: string;
  hn_url: string;
  posted_at: string | null;
}

export async function findHiringThread(monthStr: string): Promise<number | null> {
  const [year, month] = monthStr.split('-').map(Number);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month - 1];
  
  const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
    `Who is hiring? (${monthName} ${year})`
  )}&tags=story&hitsPerPage=5`;
  
  const response = await fetch(searchUrl);
  if (!response.ok) return null;
  
  const data = await response.json() as { hits: Array<{ objectID: string; title: string }> };
  
  for (const hit of data.hits) {
    const title = hit.title.toLowerCase();
    if (HIRING_THREAD_TITLES.some(t => title.includes(t))) {
      return parseInt(hit.objectID);
    }
  }
  return null;
}

async function fetchThreadComments(threadId: number): Promise<Array<{ id: number; text: string; time: number; by: string }>> {
  const response = await fetch(`https://hn.algolia.com/api/v1/items/${threadId}`);
  if (!response.ok) return [];

  const thread = await response.json() as {
    children?: Array<{
      id: number;
      text?: string;
      author?: string;
      created_at_i?: number;
    }>;
  };

  return (thread.children || [])
    .filter((comment) => comment.text && comment.author && comment.author !== 'whoishiring')
    .map((comment) => ({
      id: comment.id,
      text: comment.text!,
      time: comment.created_at_i || 0,
      by: comment.author!
    }));
}

function parseJobComment(comment: { id: number; text: string; time: number; by: string }): ScrapedJob {
  const $ = cheerio.load(comment.text);
  const rawText = $.text().trim();
  
  let company: string | null = null;
  const firstLine = rawText.split('\n')[0].trim();
  const companyMatch = firstLine.match(/^([^|\-—\(]+)/);
  if (companyMatch) {
    company = companyMatch[1].trim();
    company = company.replace(/^(we are|join|hiring)/i, '').trim();
    if (company.length < 2) company = comment.by;
  }
  if (!company) company = comment.by;
  
  const lowerText = rawText.toLowerCase();
  const isRemote = /\bremote\b/.test(lowerText) ? 1 : 0;
  const isHybrid = /\bhybrid\b/.test(lowerText) ? 1 : 0;
  const isOnsite = /\b(on-?site|in-?office|office-?based)\b/.test(lowerText) ? 1 : 0;
  
  let location: string | null = null;
  const locationPatterns = [
    /Location[:\s]+([^\n]+)/i,
    /\b(located in|based in|location)[:\s]+([^\n,]+)/i,
    /\b(remote[,\s]+)?([^\n,]{3,50})([,\s]+)?(hybrid|remote|onsite)/i
  ];
  for (const pattern of locationPatterns) {
    const match = rawText.match(pattern);
    if (match) {
      location = (match[2] || match[1] || match[0]).trim();
      break;
    }
  }
  
  let role: string | null = null;
  const rolePatterns = [
    /\b(software engineer|backend|frontend|full-?stack|devops|sre|data scientist|ml engineer|product manager|designer|architect)\b/i,
    /\b(looking for|hiring)[:\s]+([^\n]+)/i,
    /\b(role|position)[:\s]+([^\n]+)/i
  ];
  for (const pattern of rolePatterns) {
    const match = rawText.match(pattern);
    if (match) {
      role = match[0].trim().substring(0, 100);
      break;
    }
  }
  
  const techKeywords = [
    'rust', 'go', 'golang', 'python', 'typescript', 'javascript', 'java', 'kotlin',
    'scala', 'elixir', 'erlang', 'haskell', 'clojure', 'ruby', 'php', 'c++', 'c#',
    'swift', 'dart', 'flutter', 'react', 'vue', 'svelte', 'angular', 'nextjs', 'nuxt',
    'node', 'deno', 'bun', 'django', 'rails', 'laravel', 'spring', 'fastapi',
    'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'postgres', 'mysql',
    'mongodb', 'redis', 'elasticsearch', 'kafka', 'rabbitmq', 'graphql', 'rest',
    'react native', 'ios', 'android', 'flutter', 'electron', 'tailwind', 'wasm'
  ];
  
  const foundTech: string[] = [];
  for (const tech of techKeywords) {
    const regex = new RegExp(`\\b${tech.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      foundTech.push(tech);
    }
  }
  
  return {
    hn_id: String(comment.id),
    company: company?.substring(0, 100) || null,
    role: role?.substring(0, 200) || null,
    location: location?.substring(0, 100) || null,
    is_remote: isRemote,
    is_hybrid: isHybrid,
    is_onsite: isOnsite || (isRemote === 0 && isHybrid === 0 ? 1 : 0),
    tech_stack: foundTech.length > 0 ? foundTech.join(', ') : null,
    raw_comment: rawText.substring(0, 5000),
    hn_url: `https://news.ycombinator.com/item?id=${comment.id}`,
    posted_at: comment.time ? new Date(comment.time * 1000).toISOString() : null
  };
}

export async function scrapeMonth(
  db: D1Database,
  kv: KVNamespace,
  monthStr: string
): Promise<{ success: boolean; count: number; message: string }> {
  const cacheKey = `scraped:${monthStr}`;
  const alreadyScraped = await kv.get(cacheKey);
  if (alreadyScraped) {
    return { success: true, count: 0, message: `Already scraped ${monthStr}` };
  }
  
  const threadId = await findHiringThread(monthStr);
  if (!threadId) {
    return { success: false, count: 0, message: `No hiring thread found for ${monthStr}` };
  }
  
  console.log(`Found thread ${threadId} for ${monthStr}`);
  
  const comments = await fetchThreadComments(threadId);
  console.log(`Fetched ${comments.length} comments`);
  
  let inserted = 0;
  for (const comment of comments) {
    const job = parseJobComment(comment);
    await insertJob(db, { ...job, thread_month: monthStr });
    inserted++;
  }
  
  await kv.put(cacheKey, String(inserted), { expirationTtl: 60 * 60 * 24 * 365 });
  
  return { success: true, count: inserted, message: `Scraped ${inserted} jobs for ${monthStr}` };
}
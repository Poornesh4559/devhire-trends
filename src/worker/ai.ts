import type { CandidateProfile, JobInput, MatchAnalysis } from '../shared/types';
import type { AppEnv } from './env';
import { deterministicAnalysis } from './db';

const responseSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    category: { type: 'string', enum: ['Data Engineering', 'Analytics Engineering', 'Data Platform', 'ETL Development', 'Solutions Engineering', 'Adjacent'] },
    seniority: { type: 'string', enum: ['Entry', 'Mid-level', 'Senior', 'Lead'] },
    skills: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    summary: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['score', 'category', 'seniority', 'skills', 'summary', 'reason'],
  additionalProperties: false,
};

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function analyzeJob(env: AppEnv, job: JobInput, profile: CandidateProfile): Promise<MatchAnalysis> {
  const fallback = deterministicAnalysis(job, profile);
  if (!env.GEMINI_API_KEY) return fallback;

  const prompt = `You are a precise India data-engineering career matcher. Score this role for the candidate.
Candidate profile: ${JSON.stringify(profile)}
Job: ${JSON.stringify({
    title: job.title,
    company: job.company,
    location: job.location,
    workMode: job.workMode,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    description: (job.description || '').slice(0, 12000),
  })}
Prioritize genuine skill overlap, India eligibility, appropriate experience, and data engineering depth. Do not inflate the score.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          temperature: 0.15,
        },
      }),
    });
    if (!response.ok) {
      console.warn(JSON.stringify({ message: 'Gemini classification unavailable', status: response.status }));
      return fallback;
    }
    const payload = await response.json<GeminiResponse>();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallback;
    const result = JSON.parse(text) as MatchAnalysis;
    if (!Number.isFinite(result.score) || !Array.isArray(result.skills)) return fallback;
    return { ...result, score: Math.max(0, Math.min(100, Math.round(result.score))) };
  } catch (error) {
    console.warn(JSON.stringify({ message: 'Gemini classification failed; using deterministic score', error: String(error) }));
    return fallback;
  }
}

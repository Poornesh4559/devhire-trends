import type { ApplicationStatus, CandidateProfile, DashboardStats, Job, JobStatus, Source } from '../shared/types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload as T;
}

export const api = {
  dashboard: () => request<DashboardStats>('/api/dashboard'),
  jobs: (params = new URLSearchParams()) => request<Job[]>(`/api/jobs?${params}`),
  applications: () => request<Array<{ jobId: number; status: ApplicationStatus; notes: string | null; nextActionAt: string | null; job: Job }>>('/api/applications'),
  profile: () => request<CandidateProfile>('/api/profile'),
  sources: () => request<Source[]>('/api/sources'),
  setJobStatus: (id: number, status: JobStatus) => request<{ ok: true }>(`/api/jobs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  setApplication: (jobId: number, status: ApplicationStatus, notes?: string, nextActionAt?: string) => request<{ ok: true }>(`/api/applications/${jobId}`, {
    method: 'PUT', body: JSON.stringify({ status, notes, nextActionAt }),
  }),
  analyze: (id: number) => request(`/api/jobs/${id}/analyze`, { method: 'POST' }),
  saveProfile: (profile: CandidateProfile) => request<{ ok: true }>('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  addSource: (source: { name: string; provider: 'greenhouse' | 'lever'; token: string; baseUrl?: string }) => request<{ id: number }>('/api/sources', {
    method: 'POST', body: JSON.stringify(source),
  }),
};

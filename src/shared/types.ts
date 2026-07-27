export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type JobStatus = 'new' | 'saved' | 'applied' | 'interview' | 'offer' | 'rejected' | 'archived';
export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
export type Provider = 'greenhouse' | 'lever' | 'json' | 'csv' | 'email';

export interface JobInput {
  sourceName: string;
  externalId: string;
  title: string;
  company: string;
  location?: string;
  country?: string;
  workMode?: WorkMode;
  employmentType?: string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description?: string;
  applyUrl: string;
  canonicalUrl?: string;
  postedAt?: string;
  category?: string;
  seniority?: string;
  skills?: string[];
}

export interface Job extends JobInput {
  id: number;
  sourceId: number | null;
  matchScore: number;
  matchReason: string | null;
  aiSummary: string | null;
  status: JobStatus;
  discoveredAt: string;
  isActive: boolean;
  skills: string[];
}

export interface CandidateProfile {
  headline: string;
  yearsExperience: number;
  preferredLocations: string[];
  preferredModes: WorkMode[];
  coreSkills: string[];
  certifications: string[];
  targetRoles: string[];
}

export interface Source {
  id: number;
  name: string;
  provider: Provider;
  token: string | null;
  baseUrl: string | null;
  enabled: boolean;
  lastSyncedAt: string | null;
}

export interface DashboardStats {
  totalActive: number;
  strongMatches: number;
  saved: number;
  activeApplications: number;
  newThisWeek: number;
  averageScore: number;
  topSkills: Array<{ skill: string; count: number }>;
  sourceBreakdown: Array<{ source: string; count: number }>;
  weeklyTrend: Array<{ day: string; count: number }>;
}

export interface Application {
  id: number;
  jobId: number;
  status: ApplicationStatus;
  appliedAt: string | null;
  nextActionAt: string | null;
  notes: string | null;
  contactName: string | null;
  contactEmail: string | null;
  job?: Job;
}

export interface MatchAnalysis {
  score: number;
  category: string;
  seniority: string;
  skills: string[];
  summary: string;
  reason: string;
}

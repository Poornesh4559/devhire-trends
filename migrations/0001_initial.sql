PRAGMA foreign_keys = ON;

CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('greenhouse', 'lever', 'json', 'csv', 'email')),
  token TEXT,
  base_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, token)
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  country TEXT DEFAULT 'India',
  work_mode TEXT CHECK (work_mode IN ('remote', 'hybrid', 'onsite', 'unknown')) DEFAULT 'unknown',
  employment_type TEXT,
  experience_min REAL,
  experience_max REAL,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  description TEXT,
  apply_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  posted_at TEXT,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category TEXT DEFAULT 'Data Engineering',
  seniority TEXT,
  match_score INTEGER NOT NULL DEFAULT 0 CHECK (match_score BETWEEN 0 AND 100),
  match_reason TEXT,
  ai_summary TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'saved', 'applied', 'interview', 'offer', 'rejected', 'archived')),
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(source_name, external_id),
  UNIQUE(canonical_url)
);

CREATE TABLE job_skills (
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (job_id, skill)
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  applied_at TEXT,
  next_action_at TEXT,
  notes TEXT,
  contact_name TEXT,
  contact_email TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidate_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  headline TEXT NOT NULL,
  years_experience REAL NOT NULL,
  preferred_locations TEXT NOT NULL,
  preferred_modes TEXT NOT NULL,
  core_skills TEXT NOT NULL,
  certifications TEXT NOT NULL,
  target_roles TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ingestion_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  discovered_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE INDEX idx_jobs_status_score ON jobs(status, match_score DESC);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX idx_job_skills_skill ON job_skills(skill);
CREATE INDEX idx_applications_status ON applications(status);

INSERT INTO candidate_profile (
  id, headline, years_experience, preferred_locations, preferred_modes,
  core_skills, certifications, target_roles
) VALUES (
  1,
  'Data Engineer | Lakehouse & Cloud Platforms',
  3,
  '["Bengaluru","Hyderabad","Pune","Chennai","Gurugram","Mumbai","Remote India"]',
  '["remote","hybrid","onsite"]',
  '["PySpark","Spark","Delta Lake","Databricks","Python","SQL","ETL","AWS","GCP","Airflow","Kafka","dbt","Snowflake"]',
  '["Databricks Certified Data Engineer Professional"]',
  '["Data Engineer","Analytics Engineer","Data Platform Engineer","ETL Developer","Lakehouse Engineer"]'
);

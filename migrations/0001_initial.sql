CREATE TABLE IF NOT EXISTS job_postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hn_id TEXT NOT NULL UNIQUE,
  thread_month TEXT NOT NULL,
  company TEXT,
  role TEXT,
  location TEXT,
  is_remote INTEGER DEFAULT 0,
  is_hybrid INTEGER DEFAULT 0,
  is_onsite INTEGER DEFAULT 0,
  tech_stack TEXT,
  raw_comment TEXT NOT NULL,
  hn_url TEXT,
  posted_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_thread_month ON job_postings(thread_month);
CREATE INDEX IF NOT EXISTS idx_company ON job_postings(company);
CREATE INDEX IF NOT EXISTS idx_remote ON job_postings(is_remote);
CREATE INDEX IF NOT EXISTS idx_tech_stack ON job_postings(tech_stack);

CREATE TABLE IF NOT EXISTS trend_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL UNIQUE,
  total_jobs INTEGER DEFAULT 0,
  remote_count INTEGER DEFAULT 0,
  hybrid_count INTEGER DEFAULT 0,
  onsite_count INTEGER DEFAULT 0,
  top_tech TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
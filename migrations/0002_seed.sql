INSERT INTO sources (name, provider, token, enabled, last_synced_at) VALUES
  ('Razorpay Careers', 'greenhouse', 'razorpaysoftwareprivatelimited', 1, datetime('now', '-2 hours')),
  ('BrowserStack Careers', 'lever', 'browserstack', 1, datetime('now', '-5 hours')),
  ('n8n Job Inbox', 'email', 'n8n-email', 1, datetime('now', '-1 day'));

INSERT INTO jobs (
  source_id, source_name, external_id, title, company, location, country, work_mode,
  employment_type, experience_min, experience_max, description, apply_url, canonical_url,
  posted_at, category, seniority, match_score, match_reason, ai_summary, status
) VALUES
  (1, 'Greenhouse', 'demo-razorpay-1', 'Data Engineer II', 'Razorpay', 'Bengaluru, Karnataka', 'India', 'hybrid', 'Full-time', 2, 5,
   'Build reliable batch and streaming pipelines on Spark and AWS. Own lakehouse datasets, Airflow workflows, quality checks, and cost optimization.',
   'https://razorpay.com/jobs/', 'https://example.com/jobs/razorpay-data-engineer-ii', datetime('now', '-1 day'), 'Data Engineering', 'Mid-level', 94,
   'Excellent overlap with PySpark, AWS, Airflow and lakehouse delivery at the right experience level.',
   'Own production Spark pipelines and lakehouse reliability for a high-volume payments platform.', 'saved'),
  (2, 'Lever', 'demo-browserstack-1', 'Data Platform Engineer', 'BrowserStack', 'Mumbai / Remote India', 'India', 'remote', 'Full-time', 3, 6,
   'Develop the internal data platform using GCP, Databricks, Kafka, dbt and Python. Improve developer experience and observability.',
   'https://www.browserstack.com/careers', 'https://example.com/jobs/browserstack-platform-engineer', datetime('now', '-2 days'), 'Data Platform', 'Mid-level', 91,
   'Strong GCP, Databricks and Python match with a platform-oriented growth path.',
   'Build self-service data infrastructure and streaming foundations across the analytics organization.', 'new'),
  (3, 'LinkedIn saved search', 'demo-linkedin-1', 'Senior Analytics Engineer', 'Meesho', 'Bengaluru, Karnataka', 'India', 'hybrid', 'Full-time', 3, 6,
   'Model trusted business datasets with dbt and Snowflake. Partner with product analysts and improve metric governance.',
   'https://www.meesho.io/jobs', 'https://example.com/jobs/meesho-analytics-engineer', datetime('now', '-3 days'), 'Analytics Engineering', 'Senior', 82,
   'Good SQL and dbt adjacency, though the role is less Spark-focused than your primary background.',
   'Shape governed analytics models and semantic definitions for marketplace decision-making.', 'applied'),
  (NULL, 'Direct', 'demo-databricks-1', 'Resident Solutions Architect - Data Engineering', 'Databricks', NULL, 'India', 'remote', 'Full-time', 3, 7,
   'Guide customers on Delta Lake architecture, Unity Catalog, Spark performance, and production migration patterns.',
   'https://www.databricks.com/company/careers', 'https://example.com/jobs/databricks-rsa-de', datetime('now', '-4 days'), 'Solutions Engineering', 'Mid-level', 89,
   'Certification and Delta Lake depth are unusually relevant; customer-facing architecture is the main stretch.',
   'Apply lakehouse expertise directly with enterprise customers adopting Databricks.', 'interview'),
  (NULL, 'Naukri email', 'demo-walmart-1', 'Data Engineer III', 'Walmart Global Tech', 'Chennai, Tamil Nadu', 'India', 'onsite', 'Full-time', 3, 6,
   'Create scalable ETL frameworks in PySpark, Kafka and GCP. Implement data contracts and operational SLAs.',
   'https://careers.walmart.com/', 'https://example.com/jobs/walmart-data-engineer-iii', datetime('now', '-5 days'), 'Data Engineering', 'Mid-level', 92,
   'Direct PySpark, Kafka, GCP and ETL match at the target seniority.',
   'Engineer high-scale retail data products with clear ownership of SLAs and platform quality.', 'new'),
  (NULL, 'Indeed email', 'demo-phonepe-1', 'Data Engineer', 'PhonePe', 'Bengaluru, Karnataka', 'India', 'onsite', 'Full-time', 2, 4,
   'Maintain Spark pipelines, Delta tables, AWS infrastructure and workflow orchestration for risk analytics.',
   'https://www.phonepe.com/careers/', 'https://example.com/jobs/phonepe-data-engineer', datetime('now', '-7 days'), 'Data Engineering', 'Mid-level', 96,
   'Near-perfect fit across Spark, Delta Lake, AWS, ETL and experience requirements.',
   'Own lakehouse pipelines supporting real-time risk and payments analytics.', 'offer');

INSERT INTO job_skills (job_id, skill, required) VALUES
  (1, 'PySpark', 1), (1, 'AWS', 1), (1, 'Airflow', 1), (1, 'Delta Lake', 0),
  (2, 'GCP', 1), (2, 'Databricks', 1), (2, 'Kafka', 1), (2, 'dbt', 0),
  (3, 'SQL', 1), (3, 'dbt', 1), (3, 'Snowflake', 1),
  (4, 'Databricks', 1), (4, 'Delta Lake', 1), (4, 'Spark', 1),
  (5, 'PySpark', 1), (5, 'Kafka', 1), (5, 'GCP', 1),
  (6, 'Spark', 1), (6, 'Delta Lake', 1), (6, 'AWS', 1), (6, 'Airflow', 0);

INSERT INTO applications (job_id, status, applied_at, next_action_at, notes) VALUES
  (1, 'saved', NULL, datetime('now', '+1 day'), 'Tailor project bullets toward payments-scale Spark reliability.'),
  (3, 'applied', datetime('now', '-2 days'), datetime('now', '+3 days'), 'Applied via company careers page.'),
  (4, 'interview', datetime('now', '-8 days'), datetime('now', '+2 days'), 'Prepare Delta optimization and stakeholder scenarios.'),
  (6, 'offer', datetime('now', '-20 days'), datetime('now', '+4 days'), 'Review team scope and growth path.');

INSERT INTO ingestion_runs (source_id, provider, status, discovered_count, accepted_count, started_at, finished_at) VALUES
  (1, 'greenhouse', 'success', 42, 3, datetime('now', '-2 hours', '-8 seconds'), datetime('now', '-2 hours')),
  (2, 'lever', 'success', 31, 2, datetime('now', '-5 hours', '-5 seconds'), datetime('now', '-5 hours')),
  (3, 'email', 'success', 12, 1, datetime('now', '-1 day', '-3 seconds'), datetime('now', '-1 day'));

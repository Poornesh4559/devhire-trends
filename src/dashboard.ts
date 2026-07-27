import { html, raw } from 'hono/html';

export function renderDashboard(trends: any[], latestMonth: string | null) {
  const months = trends.map((t) => t.month);
  const totals = trends.map((t) => t.total_jobs);
  const remotes = trends.map((t) => t.remote_count);
  const hybrids = trends.map((t) => t.hybrid_count);
  const onsites = trends.map((t) => t.onsite_count);

  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevHire Trends | HN Who is Hiring</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f23;
      color: #e2e8f0;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { text-align: center; margin-bottom: 3rem; }
    h1 { font-size: 2.5rem; background: linear-gradient(135deg, #f59e0b, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }
    .subtitle { color: #94a3b8; font-size: 1.1rem; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: #1e1e2e;
      border: 1px solid #313244;
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      transition: transform 0.2s;
    }
    .stat-card:hover { transform: translateY(-2px); border-color: #f59e0b; }
    .stat-value { font-size: 2rem; font-weight: 700; color: #f59e0b; }
    .stat-label { color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem; }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #1e1e2e;
      border: 1px solid #313244;
      border-radius: 12px;
      padding: 1.5rem;
    }
    .card h2 { font-size: 1.25rem; margin-bottom: 1rem; color: #f8fafc; }
    .search-box {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #0f0f23;
      border: 1px solid #313244;
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    .search-box:focus { outline: none; border-color: #f59e0b; }
    .btn {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary {
      background: #313244;
      margin-left: 0.5rem;
    }
    .job-list { max-height: 400px; overflow-y: auto; }
    .job-item {
      padding: 1rem;
      border-bottom: 1px solid #313244;
      transition: background 0.2s;
    }
    .job-item:hover { background: #252536; }
    .job-company { font-weight: 600; color: #f59e0b; }
    .job-meta { font-size: 0.875rem; color: #94a3b8; margin-top: 0.25rem; }
    .tag {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #313244;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-right: 0.5rem;
      margin-top: 0.5rem;
    }
    .tag.remote { background: #065f46; color: #6ee7b7; }
    .tag.hybrid { background: #7c2d12; color: #fdba74; }
    .tag.onsite { background: #1e3a5f; color: #93c5fd; }
    .loading { text-align: center; padding: 2rem; color: #94a3b8; }
    footer { text-align: center; padding: 2rem; color: #64748b; font-size: 0.875rem; }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
      h1 { font-size: 1.75rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>DevHire Trends</h1>
      <p class="subtitle">Tracking Hacker News "Who is Hiring" threads - ${latestMonth || 'No data yet'}</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value" id="totalJobs">${trends.length > 0 ? trends[trends.length - 1].total_jobs : 0}</div>
        <div class="stat-label">Jobs This Month</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="remotePct">${trends.length > 0 ? trends[trends.length - 1].remote_pct : 0}%</div>
        <div class="stat-label">Remote</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="totalScraped">${trends.reduce((a, t) => a + (t.total_jobs || 0), 0)}</div>
        <div class="stat-label">Total Scraped</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${trends.length}</div>
        <div class="stat-label">Months Tracked</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>Job Postings Over Time</h2>
        <canvas id="trendChart" height="200"></canvas>
      </div>
      <div class="card">
        <h2>Work Arrangement Trends</h2>
        <canvas id="remoteChart" height="200"></canvas>
      </div>
    </div>

    <div class="card" style="margin-bottom: 2rem;">
      <h2>Search Jobs</h2>
      <input type="text" class="search-box" id="searchInput" placeholder="Search by company, role, tech stack... (e.g., 'rust remote')">
      <button class="btn" onclick="searchJobs()">Search</button>
      <button class="btn btn-secondary" onclick="loadLatest()">Load Latest Month</button>
      <div id="searchResults" class="job-list" style="margin-top: 1rem;"></div>
    </div>

    <div class="card" style="margin-bottom: 2rem;">
      <h2>Quick Actions</h2>
      <input type="password" class="search-box" id="scrapeSecret" placeholder="Admin scrape secret" autocomplete="current-password">
      <button class="btn" onclick="triggerScrape()">Scrape Current Month</button>
      <button class="btn btn-secondary" onclick="loadTechTrends()">View Tech Trends</button>
      <div id="actionResult" style="margin-top: 1rem; color: #94a3b8;"></div>
    </div>
  </div>

  <footer>
    <p>Built with Cloudflare Workers - D1 - KV - Hono</p>
  </footer>

  <script>
    const months = ${raw(JSON.stringify(months))};
    const totals = ${raw(JSON.stringify(totals))};
    const remotes = ${raw(JSON.stringify(remotes))};
    const hybrids = ${raw(JSON.stringify(hybrids))};
    const onsites = ${raw(JSON.stringify(onsites))};

    new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Total Jobs',
          data: totals,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: '#313244' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });

    new Chart(document.getElementById('remoteChart'), {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Remote', data: remotes, backgroundColor: '#6ee7b7' },
          { label: 'Hybrid', data: hybrids, backgroundColor: '#fdba74' },
          { label: 'On-site', data: onsites, backgroundColor: '#93c5fd' }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { grid: { color: '#313244' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { labels: { color: '#e2e8f0' } } }
      }
    });

    async function searchJobs() {
      const query = document.getElementById('searchInput').value;
      if (!query) return;
      const container = document.getElementById('searchResults');
      container.innerHTML = '<div class="loading">Searching...</div>';

      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(query));
        if (!res.ok) throw new Error('Search failed (' + res.status + ')');
        const jobs = await res.json();

        if (jobs.length === 0) {
          container.innerHTML = '<div class="loading">No results found</div>';
          return;
        }

        container.innerHTML = jobs.map(function(job) {
        return '<div class="job-item">'
          + '<div class="job-company">' + (job.company || 'Unknown') + '</div>'
           + '<div class="job-meta">' + (job.role || 'No role specified') + ' • ' + (job.location || 'Location unknown') + '</div>'
          + '<div>'
          + (job.is_remote ? '<span class="tag remote">Remote</span>' : '')
          + (job.is_hybrid ? '<span class="tag hybrid">Hybrid</span>' : '')
          + (job.is_onsite ? '<span class="tag onsite">On-site</span>' : '')
          + (job.tech_stack ? job.tech_stack.split(', ').map(function(t) { return '<span class="tag">' + t +
'</span>'; }).join('') : '')
          + '</div>'
          + '<div style="margin-top: 0.5rem; font-size: 0.8rem;">'
          + '<a href="' + job.hn_url + '" target="_blank" style="color: #f59e0b;">View on HN →</a>'
          + '</div>'
          + '</div>';
        }).join('');
      } catch (error) {
        container.innerHTML = '<div class="loading">' + error.message + '</div>';
      }
    }
      async function loadLatest() {
          document.getElementById('searchInput').value = '';
          const container = document.getElementById('searchResults');
          container.innerHTML = '<div class="loading">Loading latest month...</div>';

          try {
            const res = await fetch('/api/jobs/latest');
            if (!res.ok) throw new Error('Could not load jobs (' + res.status + ')');
            const jobs = await res.json();

            if (jobs.length === 0) {
              container.innerHTML = '<div class="loading">No jobs found</div>';
              return;
            }

            container.innerHTML = jobs.slice(0, 20).map(function(job) {
            return '<div class="job-item">'
              + '<div class="job-company">' + (job.company || 'Unknown') + '</div>'
              + '<div class="job-meta">' + (job.role || 'No role specified') + ' • ' + (job.location || 'Location unknown') + '</div>'
              + '<div>'
              + (job.is_remote ? '<span class="tag remote">Remote</span>' : '')
              + (job.is_hybrid ? '<span class="tag hybrid">Hybrid</span>' : '')
              + (job.is_onsite ? '<span class="tag onsite">On-site</span>' : '')
              + (job.tech_stack ? job.tech_stack.split(', ').map(function(t) { return '<span class="tag">' + t +      
'</span>'; }).join('') : '')
              + '</div>'
              + '</div>';
            }).join('');
          } catch (error) {
            container.innerHTML = '<div class="loading">' + error.message + '</div>';
          }
        }

        async function triggerScrape() {
          const result = document.getElementById('actionResult');
          const secret = document.getElementById('scrapeSecret').value;
          if (!secret) {
            result.textContent = 'Enter the admin scrape secret first.';
            return;
          }
          result.textContent = 'Scraping in progress...';

          try {
            const res = await fetch('/api/scrape', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + secret }
            });
            const responseText = await res.text();
            let data;
            try {
              data = JSON.parse(responseText);
            } catch {
              data = { error: responseText };
            }

            if (!res.ok) {
              throw new Error(data.error || data.message || 'Scrape failed (' + res.status + ')');
            }

            result.textContent = data.message || 'Done!';
          } catch (error) {
            result.textContent = error.message || 'Scrape failed';
          }
        }

        async function loadTechTrends() {
          const result = document.getElementById('actionResult');
          result.textContent = 'Loading tech trends...';

          try {
            const res = await fetch('/api/tech-trends');
            const data = await res.json();
            result.innerHTML = '<pre style="background: #0f0f23; padding: 1rem; border-radius: 8px; overflow-x: auto;">'
              + JSON.stringify(data, null, 2) + '</pre>';
          } catch (error) {
            result.textContent = error.message || 'Could not load tech trends';
          }
        }

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') searchJobs();
        });
      </script>
</body>
</html>`;
}
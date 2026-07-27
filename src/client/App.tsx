import {
  ArrowUpRight, BarChart3, Bell, Bookmark, BriefcaseBusiness, Building2, CalendarClock,
  Check, ChevronRight, CircleGauge, Database, Filter, LayoutDashboard, ListFilter, LoaderCircle,
  MapPin, Menu, Plus, RefreshCw, Search, Settings2, Sparkles, Target, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { ApplicationStatus, CandidateProfile, DashboardStats, Job, JobStatus, Source } from '../shared/types';
import { api } from './api';

type View = 'overview' | 'jobs' | 'pipeline' | 'sources' | 'profile';

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'jobs', label: 'Job radar', icon: Target },
  { id: 'pipeline', label: 'Applications', icon: BriefcaseBusiness },
  { id: 'sources', label: 'Sources', icon: Database },
  { id: 'profile', label: 'Match profile', icon: Settings2 },
];

const PIPELINE: Array<{ id: ApplicationStatus; label: string }> = [
  { id: 'saved', label: 'Saved' }, { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interview' }, { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Closed' },
];

const EMPTY_STATS: DashboardStats = {
  totalActive: 0, strongMatches: 0, saved: 0, activeApplications: 0,
  newThisWeek: 0, averageScore: 0, topSkills: [], sourceBreakdown: [], weeklyTrend: [],
};

function formatDate(value?: string | null): string {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function scoreClass(score: number): string {
  return score >= 90 ? 'excellent' : score >= 80 ? 'strong' : score >= 65 ? 'fair' : 'low';
}

function AppLogo() {
  return <div className="brand"><div className="brand-mark"><CircleGauge size={22} /></div><div><strong>DataRole</strong><span>RADAR</span></div></div>;
}

function ScoreRing({ score, small = false }: { score: number; small?: boolean }) {
  return <div className={`score-ring ${scoreClass(score)} ${small ? 'small' : ''}`} style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}>
    <span>{score}</span>{!small && <small>match</small>}
  </div>;
}

function Metric({ icon: Icon, label, value, detail, accent }: { icon: typeof Target; label: string; value: number | string; detail: string; accent: string }) {
  return <div className="metric">
    <div className="metric-head"><span className={`metric-icon ${accent}`}><Icon size={18} /></span><span>{label}</span></div>
    <strong>{value}</strong><small>{detail}</small>
  </div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><Search size={28} /><strong>{title}</strong><span>{detail}</span></div>;
}

export function App() {
  const [view, setView] = useState<View>('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Array<{ jobId: number; status: ApplicationStatus; notes: string | null; nextActionAt: string | null; job: Job }>>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('all');
  const [minimumScore, setMinimumScore] = useState('0');
  const [sourceForm, setSourceForm] = useState({ name: '', provider: 'greenhouse' as 'greenhouse' | 'lever', token: '' });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [nextStats, nextJobs, nextApplications, nextSources, nextProfile] = await Promise.all([
        api.dashboard(), api.jobs(), api.applications(), api.sources(), api.profile(),
      ]);
      setStats(nextStats); setJobs(nextJobs); setApplications(nextApplications); setSources(nextSources); setProfile(nextProfile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the radar');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadData(); }, []);

  const visibleJobs = jobs.filter((job) => {
    const term = search.toLowerCase();
    const matchesText = !term || `${job.title} ${job.company} ${job.location || ''} ${job.skills.join(' ')}`.toLowerCase().includes(term);
    return matchesText && (mode === 'all' || job.workMode === mode) && job.matchScore >= Number(minimumScore);
  });

  async function changeStatus(job: Job, status: JobStatus) {
    await api.setJobStatus(job.id, status);
    setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status } : item));
    setSelectedJob((current) => current?.id === job.id ? { ...current, status } : current);
    await loadData();
  }

  async function moveApplication(jobId: number, status: ApplicationStatus) {
    await api.setApplication(jobId, status);
    await loadData();
  }

  async function addSource(event: React.FormEvent) {
    event.preventDefault();
    await api.addSource(sourceForm);
    setSourceForm({ name: '', provider: 'greenhouse', token: '' });
    setSources(await api.sources());
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="sidebar-top"><AppLogo /><button className="icon-button mobile-only" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={20} /></button></div>
      <nav>{NAV_ITEMS.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{id === 'jobs' && <b>{jobs.length}</b>}</button>)}</nav>
      <div className="profile-mini"><div className="avatar">PN</div><div><strong>Poornesh</strong><span>Data Engineer · India</span></div><ChevronRight size={16} /></div>
    </aside>

    <main>
      <header className="topbar">
        <button className="icon-button mobile-only" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button>
        <div><span className="eyebrow">PERSONAL JOB INTELLIGENCE</span><h1>{NAV_ITEMS.find((item) => item.id === view)?.label}</h1></div>
        <div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={19} /><i /></button><button className="refresh-button" onClick={() => void loadData()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh</button></div>
      </header>

      {error && <div className="error-banner"><span>{error}</span><button onClick={() => void loadData()}>Retry</button></div>}
      {loading && !jobs.length ? <div className="page-loader"><LoaderCircle className="spin" /><span>Calibrating your radar…</span></div> : <div className="workspace">
        {view === 'overview' && <Overview stats={stats} jobs={jobs} onSelect={(job) => { setSelectedJob(job); setView('jobs'); }} />}
        {view === 'jobs' && <JobsView jobs={visibleJobs} allCount={jobs.length} search={search} setSearch={setSearch} mode={mode} setMode={setMode} minimumScore={minimumScore} setMinimumScore={setMinimumScore} selectedJob={selectedJob} setSelectedJob={setSelectedJob} changeStatus={changeStatus} />}
        {view === 'pipeline' && <PipelineView applications={applications} moveApplication={moveApplication} />}
        {view === 'sources' && <SourcesView sources={sources} form={sourceForm} setForm={setSourceForm} addSource={addSource} />}
        {view === 'profile' && profile && <ProfileView profile={profile} onSave={async (next) => { await api.saveProfile(next); setProfile(next); }} />}
      </div>}
    </main>
  </div>;
}

function Overview({ stats, jobs, onSelect }: { stats: DashboardStats; jobs: Job[]; onSelect: (job: Job) => void }) {
  const best = jobs.slice(0, 4);
  const chartData = stats.weeklyTrend.length ? stats.weeklyTrend : [{ day: 'No data', count: 0 }];
  return <>
    <section className="intro-row"><div><h2>Your market, distilled.</h2><p>India data engineering roles ranked against your lakehouse and cloud experience.</p></div><div className="live-badge"><span /> Automation ready</div></section>
    <section className="metric-grid">
      <Metric icon={Target} label="Strong matches" value={stats.strongMatches} detail={`${stats.averageScore}% average fit`} accent="green" />
      <Metric icon={BriefcaseBusiness} label="Active roles" value={stats.totalActive} detail={`+${stats.newThisWeek} discovered this week`} accent="blue" />
      <Metric icon={Bookmark} label="Saved" value={stats.saved} detail="Ready for review" accent="amber" />
      <Metric icon={CalendarClock} label="In progress" value={stats.activeApplications} detail="Applications and interviews" accent="red" />
    </section>
    <section className="overview-grid">
      <div className="panel trend-panel"><div className="panel-heading"><div><span className="eyebrow">DISCOVERY VELOCITY</span><h3>New roles, last 14 days</h3></div><BarChart3 size={20} /></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="#e5ebe7" /><XAxis dataKey="day" tickFormatter={(value) => value.slice(5)} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} width={24} /><Tooltip cursor={{ fill: '#edf4ef' }} /><Bar dataKey="count" fill="#136f63" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="panel skills-panel"><div className="panel-heading"><div><span className="eyebrow">DEMAND SIGNAL</span><h3>Skills in your market</h3></div><Sparkles size={20} /></div><div className="skill-demand">{stats.topSkills.length ? stats.topSkills.map((item, index) => <div key={item.skill}><span>{item.skill}</span><div><i style={{ width: `${Math.max(18, item.count / stats.topSkills[0].count * 100)}%` }} /></div><b>{item.count}</b></div>) : <EmptyState title="No skill signals yet" detail="Ingest jobs to see market demand." />}</div></div>
    </section>
    <section className="panel matches-panel"><div className="panel-heading"><div><span className="eyebrow">PRIORITY QUEUE</span><h3>Best matches right now</h3></div><button className="text-button">View all <ChevronRight size={15} /></button></div><div className="match-list">{best.length ? best.map((job) => <button className="match-row" key={job.id} onClick={() => onSelect(job)}><ScoreRing score={job.matchScore} small /><div className="company-tile">{job.company.slice(0, 2).toUpperCase()}</div><div className="match-main"><strong>{job.title}</strong><span>{job.company} · {job.location}</span></div><div className="match-skills">{job.skills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div><div className="match-date">{formatDate(job.postedAt)}</div><ChevronRight size={18} /></button>) : <EmptyState title="No matches yet" detail="Connect an ATS source or send jobs from n8n." />}</div></section>
  </>;
}

interface JobsViewProps {
  jobs: Job[]; allCount: number; search: string; setSearch: (value: string) => void; mode: string; setMode: (value: string) => void;
  minimumScore: string; setMinimumScore: (value: string) => void; selectedJob: Job | null; setSelectedJob: (job: Job | null) => void;
  changeStatus: (job: Job, status: JobStatus) => Promise<void>;
}

function JobsView(props: JobsViewProps) {
  return <div className="jobs-layout"><section className="jobs-browser"><div className="filterbar"><label className="search-control"><Search size={18} /><input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Search role, company, city or skill" /></label><label><MapPin size={16} /><select value={props.mode} onChange={(event) => props.setMode(event.target.value)}><option value="all">All work modes</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><label><Filter size={16} /><select value={props.minimumScore} onChange={(event) => props.setMinimumScore(event.target.value)}><option value="0">Any match</option><option value="80">80%+ match</option><option value="90">90%+ match</option></select></label></div><div className="list-summary"><strong>{props.jobs.length}</strong> of {props.allCount} roles<span>Sorted by profile match</span></div><div className="job-list">{props.jobs.map((job) => <button key={job.id} className={`job-row ${props.selectedJob?.id === job.id ? 'selected' : ''}`} onClick={() => props.setSelectedJob(job)}><div className="company-tile">{job.company.slice(0, 2).toUpperCase()}</div><div className="job-copy"><div><strong>{job.title}</strong>{job.status !== 'new' && <span className={`status ${job.status}`}>{job.status}</span>}</div><span>{job.company}</span><small><MapPin size={13} /> {job.location || 'India'} <i /> {job.workMode} <i /> {formatDate(job.postedAt)}</small><div className="job-skills">{job.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div></div><ScoreRing score={job.matchScore} small /></button>)}{!props.jobs.length && <EmptyState title="No roles match these filters" detail="Widen the score or work-mode filter." />}</div></section>{props.selectedJob ? <JobDetail job={props.selectedJob} close={() => props.setSelectedJob(null)} changeStatus={props.changeStatus} /> : <aside className="detail-placeholder"><Target size={34} /><strong>Select a role</strong><span>Inspect fit, skills and next actions.</span></aside>}</div>;
}

function JobDetail({ job, close, changeStatus }: { job: Job; close: () => void; changeStatus: (job: Job, status: JobStatus) => Promise<void> }) {
  const [analyzing, setAnalyzing] = useState(false);
  return <aside className="job-detail"><div className="detail-top"><button className="icon-button" onClick={close} aria-label="Close details"><X size={19} /></button><span className={`status ${job.status}`}>{job.status}</span></div><div className="detail-company"><div className="company-tile large">{job.company.slice(0, 2).toUpperCase()}</div><div><span>{job.company}</span><h2>{job.title}</h2></div></div><div className="detail-meta"><span><MapPin size={15} />{job.location || 'India'}</span><span><Building2 size={15} />{job.workMode}</span><span><CalendarClock size={15} />{formatDate(job.postedAt)}</span></div><div className="match-analysis"><ScoreRing score={job.matchScore} /><div><span className="eyebrow">PROFILE MATCH</span><strong>{job.matchReason || 'Relevant data engineering role.'}</strong></div></div><div className="detail-actions"><button className="primary-button" onClick={() => void changeStatus(job, 'saved')}><Bookmark size={17} /> Save role</button><a className="secondary-button" href={job.applyUrl} target="_blank" rel="noreferrer">Apply <ArrowUpRight size={17} /></a></div><section><div className="section-title"><h3>Role brief</h3><button className="text-button" disabled={analyzing} onClick={async () => { setAnalyzing(true); await api.analyze(job.id); setAnalyzing(false); }}><Sparkles size={15} />{analyzing ? 'Scoring…' : 'Score with Gemini'}</button></div><p>{job.aiSummary || job.description?.slice(0, 500) || 'No description was supplied by this source.'}</p></section><section><h3>Detected skills</h3><div className="skill-cloud">{job.skills.map((skill) => <span key={skill}><Check size={13} />{skill}</span>)}</div></section><section><h3>Source</h3><div className="source-line"><Database size={17} /><div><strong>{job.sourceName}</strong><span>Discovered {formatDate(job.discoveredAt)}</span></div></div></section></aside>;
}

function PipelineView({ applications, moveApplication }: { applications: Array<{ jobId: number; status: ApplicationStatus; notes: string | null; nextActionAt: string | null; job: Job }>; moveApplication: (jobId: number, status: ApplicationStatus) => Promise<void> }) {
  return <><section className="intro-row"><div><h2>Application pipeline</h2><p>Keep momentum visible from shortlist to decision.</p></div><span className="count-badge">{applications.length} tracked</span></section><div className="kanban">{PIPELINE.map((column) => { const items = applications.filter((item) => item.status === column.id); return <section className="kanban-column" key={column.id}><header><span className={`dot ${column.id}`} /> <strong>{column.label}</strong><b>{items.length}</b></header><div>{items.map((item) => <article className="application-card" key={item.jobId}><div className="application-company"><div className="company-tile">{item.job.company.slice(0, 2).toUpperCase()}</div><ScoreRing score={item.job.matchScore} small /></div><h3>{item.job.title}</h3><span>{item.job.company}</span><small><MapPin size={13} />{item.job.location}</small>{item.nextActionAt && <div className="next-action"><CalendarClock size={14} /> Next {formatDate(item.nextActionAt)}</div>}<select value={item.status} onChange={(event) => void moveApplication(item.jobId, event.target.value as ApplicationStatus)}>{PIPELINE.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></article>)}{!items.length && <div className="column-empty">Drop zone</div>}</div></section>; })}</div></>;
}

function SourcesView({ sources, form, setForm, addSource }: { sources: Source[]; form: { name: string; provider: 'greenhouse' | 'lever'; token: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; provider: 'greenhouse' | 'lever'; token: string }>>; addSource: (event: React.FormEvent) => Promise<void> }) {
  return <div className="settings-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">AUTOMATION INPUTS</span><h3>Connected sources</h3></div><Database size={20} /></div><div className="source-list">{sources.map((source) => <div key={source.id}><span className={`source-icon ${source.provider}`}>{source.provider === 'greenhouse' ? 'GH' : source.provider === 'lever' ? 'LV' : 'IN'}</span><div><strong>{source.name}</strong><span>{source.provider} · {source.lastSyncedAt ? `synced ${formatDate(source.lastSyncedAt)}` : 'waiting for first sync'}</span></div><i className={source.enabled ? 'enabled' : ''} /></div>)}</div></section><section className="panel connector-panel"><div><span className="eyebrow">PUBLIC ATS API</span><h3>Add company board</h3><p>Use the company slug from a public Greenhouse or Lever careers URL.</p></div><form onSubmit={(event) => void addSource(event)}><label>Company name<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Example: Razorpay" /></label><label>Provider<select value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as 'greenhouse' | 'lever' }))}><option value="greenhouse">Greenhouse</option><option value="lever">Lever</option></select></label><label>Board token<input required value={form.token} onChange={(event) => setForm((current) => ({ ...current, token: event.target.value }))} placeholder="company-slug" /></label><button className="primary-button" type="submit"><Plus size={17} /> Add source</button></form><div className="compliance-note"><ListFilter size={18} /><div><strong>Restricted boards stay outside the scraper.</strong><span>LinkedIn, Naukri and Indeed saved-search emails can flow through n8n into the secured ingestion endpoint.</span></div></div></section></div>;
}

function ProfileView({ profile, onSave }: { profile: CandidateProfile; onSave: (profile: CandidateProfile) => Promise<void> }) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  function setList(field: 'coreSkills' | 'preferredLocations' | 'targetRoles', value: string) { setDraft((current) => ({ ...current, [field]: value.split(',').map((item) => item.trim()).filter(Boolean) })); }
  return <div className="profile-layout"><section className="profile-summary"><div className="profile-monogram">PN</div><span className="eyebrow">MATCHING IDENTITY</span><h2>{draft.headline}</h2><p>{draft.yearsExperience} years · Databricks Professional · India</p><div className="profile-score"><strong>{draft.coreSkills.length}</strong><span>core signals used by the scoring engine</span></div></section><section className="panel profile-form"><div className="panel-heading"><div><span className="eyebrow">CANDIDATE MODEL</span><h3>Profile inputs</h3></div><Sparkles size={20} /></div><label>Professional headline<input value={draft.headline} onChange={(event) => setDraft((current) => ({ ...current, headline: event.target.value }))} /></label><label>Years of experience<input type="number" min="0" max="50" value={draft.yearsExperience} onChange={(event) => setDraft((current) => ({ ...current, yearsExperience: Number(event.target.value) }))} /></label><label>Core skills <small>Comma separated</small><textarea value={draft.coreSkills.join(', ')} onChange={(event) => setList('coreSkills', event.target.value)} /></label><label>Preferred locations <small>Comma separated</small><textarea value={draft.preferredLocations.join(', ')} onChange={(event) => setList('preferredLocations', event.target.value)} /></label><label>Target roles <small>Comma separated</small><textarea value={draft.targetRoles.join(', ')} onChange={(event) => setList('targetRoles', event.target.value)} /></label><button className="primary-button" onClick={async () => { await onSave(draft); setSaved(true); window.setTimeout(() => setSaved(false), 1600); }}>{saved ? <Check size={17} /> : <Sparkles size={17} />}{saved ? 'Profile saved' : 'Update matching model'}</button></section></div>;
}

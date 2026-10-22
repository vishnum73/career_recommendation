import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')).replace(/\/$/, '');
const CareerChart = lazy(() => import('./CareerChart.jsx'));

async function request(path, options) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status}).`);
  return data;
}

function App() {
  const [options, setOptions] = useState({ skills: [], interests: [] });
  const [education, setEducation] = useState('Computer Science');
  const [year, setYear] = useState('3rd Year');
  const [experience, setExperience] = useState('Beginner');
  const [skills, setSkills] = useState([]);
  const [interests, setInterests] = useState([]);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => { loadOptions(); loadHistory(); }, []);

  async function loadOptions() {
    try { setOptions(await request('/api/options')); }
    catch (err) { setMessage(`Could not connect to the recommendation service: ${err.message}`); setError(true); }
  }

  async function loadHistory() {
    try { const data = await request('/api/history'); setHistory(data.history || []); }
    catch { /* The service may still be starting. */ }
  }

  function toggle(value, list, setter) {
    setter(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage(''); setError(false); setResults([]);
    try {
      const data = await request('/api/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ education, year, experience, skills, interests }),
      });
      setResults(data.recommendations || []); setMessage(data.note || 'Recommendations ready.');
      loadHistory();
    } catch (err) { setMessage(err.message); setError(true); }
    finally { setBusy(false); }
  }

  async function uploadResume(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setMessage('Reading resume…'); setError(false);
    try {
      const form = new FormData(); form.append('file', file);
      const data = await request('/api/resume/skills', { method: 'POST', body: form });
      setSkills(current => [...new Set([...current, ...data.skills])]);
      setMessage(`${data.message} Found ${data.skills.length} skills.`);
    } catch (err) { setMessage(err.message); setError(true); }
    finally { setUploading(false); event.target.value = ''; }
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand-mark">✦</div><div><div className="brand">Career Compass <span>AI</span></div><div className="tagline">Your skills. Your direction. Your next step.</div></div><a className="top-link" href="#history">History ↗</a></header>
    <main>
      <section className="hero"><div className="eyebrow"><span className="pulse"/> PERSONALIZED CAREER DISCOVERY</div><h1>Find the career that<br/><em>fits your potential.</em></h1><p>Share what you know and what you enjoy. Get ranked career ideas, missing skills, and a practical learning roadmap.</p><div className="hero-stats"><div><b>{options.careers_count || '—'}</b><span>Career paths</span></div><div><b>AI/ML</b><span>Matching engine</span></div><div><b>1 → 5</b><span>Ranked suggestions</span></div></div></section>
      <div className="workspace">
        <form className="panel form-panel" onSubmit={submit}>
          <div className="panel-heading"><div><div className="section-kicker">STEP 01</div><h2>Your profile</h2></div><span className="heading-icon">◉</span></div>
          <label>Education / department<input value={education} onChange={event => setEducation(event.target.value)} placeholder="e.g. B.E. AI & ML" maxLength={120}/></label>
          <div className="two-col"><label>Study year<select value={year} onChange={event => setYear(event.target.value)}>{['1st Year','2nd Year','3rd Year','4th Year','Graduate','Working professional'].map(value => <option key={value}>{value}</option>)}</select></label><label>Experience<select value={experience} onChange={event => setExperience(event.target.value)}>{['Beginner','Intermediate','Experienced'].map(value => <option key={value}>{value}</option>)}</select></label></div>
          <div className="field-title">Technical skills <small>{skills.length} selected</small></div><div className="chip-list">{options.skills.map(value => <button type="button" key={value} aria-pressed={skills.includes(value)} className={`chip ${skills.includes(value) ? 'selected' : ''}`} onClick={() => toggle(value, skills, setSkills)}>{skills.includes(value) ? '✓ ' : ''}{value}</button>)}</div>
          <div className="field-title interest-title">Interests <small>{interests.length} selected</small></div><div className="chip-list">{options.interests.map(value => <button type="button" key={value} aria-pressed={interests.includes(value)} className={`chip ${interests.includes(value) ? 'selected' : ''}`} onClick={() => toggle(value, interests, setInterests)}>{interests.includes(value) ? '✓ ' : ''}{value}</button>)}</div>
          <label className="upload-box"><span className="upload-icon">↑</span><span><b>{uploading ? 'Reading resume…' : 'Import skills from resume'}</b><small>PDF only · max 5 MB · review extracted skills</small></span><input type="file" accept="application/pdf,.pdf" onChange={uploadResume} disabled={uploading}/></label>
          <button className="primary-btn" type="submit" disabled={busy || !options.skills.length}>{busy ? 'Analyzing profile…' : 'Find my career matches'} <span>↗</span></button>
          {message && <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>{message}</div>}
          <p className="privacy-note">Your resume is processed for skill extraction and is not saved by this demo.</p>
        </form>
        <section className="results-column"><div className="results-head"><div><div className="section-kicker">STEP 02</div><h2>Career matches</h2></div><span className="result-count">{results.length ? `${results.length} RESULTS` : 'AWAITING PROFILE'}</span></div>
          {!results.length ? <div className="empty-state"><div className="orbit"><span>✦</span></div><h3>Your next chapter starts here.</h3><p>Select a few skills and interests, then generate your personalized career shortlist.</p><div className="mini-steps"><span>01&nbsp; Profile</span><i>→</i><span>02&nbsp; Match</span><i>→</i><span>03&nbsp; Grow</span></div></div> : <>
            <Suspense fallback={<div className="chart-panel chart-loading" role="status">Loading match chart…</div>}><CareerChart results={results}/></Suspense>
            {results.map((result, index) => <article className="career-card" key={result.career}><div className="career-top"><div className="rank">{String(index + 1).padStart(2, '0')}</div><div className="career-name"><h3>{result.career}</h3><p>{result.description}</p></div><div className="score"><b>{result.score}%</b><small>match</small></div></div><div className="progress-track"><div style={{width:`${result.score}%`}}/></div><div className="detail-grid"><div><h4>✓ Matching skills</h4><div className="small-chips">{result.matched_skills.length ? result.matched_skills.map(skill => <span className="good" key={skill}>{skill}</span>) : <span className="muted">Select more skills to see overlap.</span>}</div></div><div><h4>＋ Skills to build</h4><div className="small-chips">{result.missing_skills.slice(0,5).map(skill => <span key={skill}>{skill}</span>)}</div></div></div><div className="roadmap"><h4>Suggested next steps</h4><ol>{result.learning.slice(0,4).map((step, stepIndex) => <li key={step}><span>{stepIndex + 1}</span>{step}</li>)}</ol><h4 className="project-label">Portfolio project idea</h4><div className="project-text">{result.projects.join(' · ')}</div></div></article>)}
          </>}
        </section>
      </div>
      <section className="history-section" id="history"><div><div className="section-kicker">YOUR JOURNEY</div><h2>Recent recommendations</h2><p>Recent career choices are saved without profile details.</p></div>{history.length ? <div className="history-list">{history.map(item => <div className="history-row" key={item.id}><span className="history-dot"/><div><b>{item.top_career}</b><small>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</small></div></div>)}</div> : <div className="history-empty">Your recommendation history will appear here.</div>}</section>
      <footer>CAREER COMPASS AI <span>·</span> Explore possibilities, not guarantees.</footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);

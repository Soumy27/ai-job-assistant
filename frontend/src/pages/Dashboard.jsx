import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, API_BASE } from '../utils/auth';
import Icon from '../components/Icon';

/**
 * Overview — the screen's question: "Where do my applications stand, and
 * which one needs me today?"
 *
 * The pipeline answers it, so the pipeline is the biggest block: one divided
 * ledger strip rather than four KPI tiles, counts set as ledger columns, and
 * the single chart hue on the stage actually holding the most applications.
 */

// The product's own stages, in the order an application moves through them.
const STAGES = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected'];

function timeAgo(iso) {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// Pale tint, dark ink of the same hue. Only the stages that mean something
// carry a hue; everything settled or neutral stays grey.
const STAGE_PILL = {
  Saved: 'bg-pill-neutral-bg text-pill-neutral-ink',
  Applied: 'bg-pill-neutral-bg text-pill-neutral-ink',
  Interviewing: 'bg-pill-warning-bg text-pill-warning-ink',
  Offer: 'bg-pill-positive-bg text-pill-positive-ink',
  Rejected: 'bg-pill-negative-bg text-pill-negative-ink',
};

const MAIL_PILL = {
  'Interview Invite': 'bg-pill-warning-bg text-pill-warning-ink',
  Offer: 'bg-pill-positive-bg text-pill-positive-ink',
  Rejection: 'bg-pill-negative-bg text-pill-negative-ink',
  'Application Received': 'bg-pill-neutral-bg text-pill-neutral-ink',
  'Job Alert': 'bg-pill-neutral-bg text-pill-neutral-ink',
  'Job-related': 'bg-pill-neutral-bg text-pill-neutral-ink',
};

export default function Dashboard() {
  const [apps, setApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [appsError, setAppsError] = useState('');

  const [profileComplete, setProfileComplete] = useState(100);

  const [showAdd, setShowAdd] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);

  const [gmailConfigured, setGmailConfigured] = useState(null); // null = unknown
  const [gmailMsgs, setGmailMsgs] = useState([]);
  const [gmailScanning, setGmailScanning] = useState(false);
  const [gmailNote, setGmailNote] = useState('');

  useEffect(() => {
    authFetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        const fields = [
          data.personalInfo?.firstName, data.personalInfo?.lastName,
          data.personalInfo?.email, data.personalInfo?.phone,
          data.personalInfo?.location, data.academicInfo?.college,
          data.academicInfo?.degree, data.professionalInfo?.skills,
          data.professionalInfo?.currentRole, data.bio,
        ];
        const filled = fields.filter((f) => f && String(f).trim()).length;
        setProfileComplete(Math.round((filled / fields.length) * 100));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    authFetch('/api/applications')
      .then((r) => r.json())
      .then((data) => setApps(data.applications || []))
      .catch(() => setAppsError('Could not load your applications.'))
      .finally(() => setLoadingApps(false));
  }, []);

  // Ask the server which integrations it actually has, so we never offer a
  // control that is guaranteed to fail.
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then((d) => setGmailConfigured(Boolean(d?.integrations?.gmail)))
      .catch(() => setGmailConfigured(false));
  }, []);

  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get('gmail');
    if (g === 'connected') {
      setGmailNote('Gmail connected. Scan your inbox to find application updates.');
      window.history.replaceState({}, '', '/');
    } else if (g === 'error') {
      setGmailNote('Gmail connection failed. Try connecting again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const countBy = (s) => apps.filter((a) => a.status === s).length;
  const counts = STAGES.map((s) => ({ stage: s, n: countBy(s) }));

  // The one hue marks the stage holding the most applications — the live part
  // of the pipeline. With nothing in it yet, nothing is marked.
  const peak = counts.reduce((best, c) => (c.n > best.n ? c : best), { stage: null, n: 0 });
  const liveStage = peak.n > 0 ? peak.stage : null;

  const open = counts
    .filter((c) => c.stage !== 'Rejected')
    .reduce((sum, c) => sum + c.n, 0);

  // The finding: the one fact that most needs attention today.
  const interviewing = countBy('Interviewing');
  const offers = countBy('Offer');
  let finding;
  if (apps.length === 0) finding = 'Nothing tracked yet. Add the first application to start the pipeline.';
  else if (offers > 0) finding = `${offers} offer${offers > 1 ? 's' : ''} waiting on your decision.`;
  else if (interviewing > 0) finding = `${interviewing} application${interviewing > 1 ? 's' : ''} at interview stage.`;
  else finding = `${open} application${open === 1 ? '' : 's'} still open, none at interview yet.`;

  const handleAdd = async () => {
    if (!newCompany.trim() || !newRole.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ company: newCompany.trim(), role: newRole.trim(), status: 'Applied' }),
      });
      const data = await res.json();
      if (res.ok && data.application) {
        setApps((prev) => [data.application, ...prev]);
        setNewCompany('');
        setNewRole('');
        setShowAdd(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const res = await authFetch('/api/gmail/auth-url');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setGmailNote(data.error || 'Could not start the Gmail connection.');
    } catch {
      setGmailNote('Could not reach the server.');
    }
  };

  const handleScanGmail = async () => {
    setGmailScanning(true);
    setGmailNote('');
    try {
      const res = await authFetch('/api/gmail/scan', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (res.status === 400 && data.connected === false) {
        setGmailNote('Gmail is not connected yet.');
      } else if (res.ok) {
        setGmailMsgs(data.opportunities || []);
        setGmailNote(
          data.count === 0
            ? 'No job-related mail in the last 30 days.'
            : `${data.count} job-related email${data.count === 1 ? '' : 's'} in the last 30 days.`
        );
      } else {
        setGmailNote(data.error || 'The scan failed.');
      }
    } catch {
      setGmailNote('Could not reach the server.');
    } finally {
      setGmailScanning(false);
    }
  };

  const recent = apps.slice(0, 6);

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Title row: a noun title, the finding under it, the main job at the right. */}
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title tracking-tight">Overview</h1>
          <p className="mt-1 text-body text-muted">{finding}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Icon name="plus" />
          Add application
        </button>
      </header>

      {profileComplete < 80 && (
        <Link
          to="/profile"
          className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card border border-border bg-surface px-4 py-3 transition-colors hover:bg-[#fafafa]"
        >
          <span className="flex items-start gap-[10px] text-body">
            <Icon name="info" className="mt-[3px] shrink-0 text-muted" />
            <span>
              Your profile is <span className="fig">{profileComplete}%</span> complete. Autofill
              works better when it is full.
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-body text-muted">
            Complete <Icon name="arrowRight" />
          </span>
        </Link>
      )}

      {/* The pipeline: one container divided by hairlines, not five cards. */}
      <section aria-labelledby="pipeline-h" className="panel mb-3">
        <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
          <h2 id="pipeline-h" className="text-section">Pipeline</h2>
          <span className="text-small text-muted">
            <span className="fig">{open}</span> open · <span className="fig">{apps.length}</span> tracked
          </span>
        </div>
        {/* One column on a phone, five across from sm: five stages never
            divide into two or three columns without leaving an orphan cell. */}
        <div className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          {counts.map(({ stage, n }) => (
            <div
              key={stage}
              className="flex items-baseline justify-between px-5 py-3 sm:block sm:py-4"
            >
              <div className="text-small text-muted">{stage}</div>
              <div
                className={[
                  'fig text-kpi sm:mt-1',
                  n === 0 ? 'text-muted' : stage === liveStage ? 'text-chart-3' : 'text-text',
                ].join(' ')}
              >
                {n}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* items-start: each panel is as tall as its own content. Stretching the
          shorter one to match its neighbour leaves a blank band inside it. */}
      <div className="grid items-start gap-3 lg:grid-cols-[1.6fr_1fr]">
        {/* Applications */}
        <section aria-labelledby="apps-h" className="panel">
          <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
            <h2 id="apps-h" className="text-section">Applications</h2>
            {apps.length > recent.length && (
              <span className="text-small text-muted">
                showing <span className="fig">{recent.length}</span> of <span className="fig">{apps.length}</span>
              </span>
            )}
          </div>

          {loadingApps ? (
            <p className="px-5 py-8 text-body text-muted">Loading…</p>
          ) : appsError ? (
            <p className="px-5 py-8 text-body text-negative">{appsError}</p>
          ) : recent.length === 0 ? (
            <div className="px-5 py-8">
              <p className="text-body text-muted">
                No applications yet. Each one you add moves through Saved, Applied, Interviewing and
                then Offer or Rejected.
              </p>
              <button type="button" className="btn btn-secondary mt-4" onClick={() => setShowAdd(true)}>
                Add the first one
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-small text-muted">
                  <th scope="col" className="px-5 pb-2 pt-3 font-normal">Company</th>
                  <th scope="col" className="px-5 pb-2 pt-3 font-normal">Role</th>
                  <th scope="col" className="px-5 pb-2 pt-3 font-normal">Stage</th>
                  <th scope="col" className="hidden px-5 pb-2 pt-3 text-right font-normal sm:table-cell">Added</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id} className="border-t border-rule">
                    <td className="px-5 py-3 text-body">{a.company}</td>
                    <td className="px-5 py-3 text-body text-muted">{a.role}</td>
                    <td className="px-5 py-3">
                      <span className={`pill ${STAGE_PILL[a.status] || STAGE_PILL.Saved}`}>{a.status}</span>
                    </td>
                    {/* The API maps the column to camelCase (db.js mapAppRow);
                        reading created_at here left this empty for every row. */}
                    <td className="fig hidden px-5 py-3 text-right text-small text-muted sm:table-cell">{timeAgo(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Gmail */}
        <section aria-labelledby="mail-h" className="panel">
          <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
            <h2 id="mail-h" className="text-section">Inbox scan</h2>
            {gmailConfigured && (
              <button
                type="button"
                className="btn btn-quiet h-7 px-2 text-small"
                onClick={handleScanGmail}
                disabled={gmailScanning}
              >
                <Icon name="refresh" size={14} />
                {gmailScanning ? 'Scanning…' : 'Scan'}
              </button>
            )}
          </div>

          <div className="px-5 py-4">
            {gmailConfigured === null ? (
              <p className="text-body text-muted">Checking…</p>
            ) : gmailConfigured === false ? (
              // Honest unavailable state instead of a button that always fails.
              <p className="text-body text-muted">
                Mail scanning is turned off on this server, so there is nothing to connect to yet.
                Track applications by hand in the meantime.
              </p>
            ) : (
              <>
                <p className="text-body text-muted">
                  Reads the last 30 days of mail, read-only, and sorts job replies by what they are.
                </p>
                <button type="button" className="btn btn-secondary mt-4" onClick={handleConnectGmail}>
                  <Icon name="mail" />
                  Connect Gmail
                </button>
              </>
            )}

            {gmailNote && <p className="mt-3 text-small text-muted">{gmailNote}</p>}
          </div>

          {gmailMsgs.length > 0 && (
            <ul className="border-t border-rule">
              {gmailMsgs.slice(0, 6).map((m) => (
                <li key={m.id} className="border-b border-rule px-5 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-body">{m.subject || '(no subject)'}</span>
                    <span className={`pill shrink-0 ${MAIL_PILL[m.classification] || MAIL_PILL['Job-related']}`}>
                      {m.classification}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-small text-muted">{m.from}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-h"
          onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}
        >
          <div className="w-full max-w-sm rounded-card bg-surface p-5 shadow-lg">
            <h2 id="add-h" className="text-section">Add application</h2>
            <label className="mt-4 block text-body font-medium" htmlFor="company">Company</label>
            <input
              id="company"
              className="field mt-2"
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              autoFocus
            />
            <label className="mt-4 block text-body font-medium" htmlFor="role">Role</label>
            <input
              id="role"
              className="field mt-2"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn btn-quiet" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={saving || !newCompany.trim() || !newRole.trim()}
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

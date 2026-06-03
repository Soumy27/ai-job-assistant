import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth';
import { Link } from 'react-router-dom';

const Icon = ({ name, className = '', fill = false }) => (
  <span className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`} aria-hidden="true">{name}</span>
);

// Turn an ISO timestamp into a short "2d ago" style label.
function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const STATUS_STYLES = {
  Saved: 'bg-tertiary-fixed text-on-tertiary-fixed',
  Applied: 'bg-surface-container text-primary border border-primary/20',
  Interviewing: 'bg-secondary-container/50 text-on-secondary-container',
  Offer: 'bg-secondary-container text-on-secondary-container',
  Rejected: 'bg-surface-container-high text-on-surface-variant',
};

// Colour the Gmail email-classification badges by type.
const CLASSIFICATION_STYLES = {
  'Interview Invite': 'bg-secondary-container/50 text-on-secondary-container',
  'Offer': 'bg-secondary text-on-secondary',
  'Rejection': 'bg-surface-container-high text-on-surface-variant',
  'Application Received': 'bg-primary/10 text-primary',
  'Job Alert': 'bg-tertiary-fixed text-on-tertiary-fixed',
  'Job-related': 'bg-surface-container text-on-surface-variant',
};

const Dashboard = () => {
  const [showModal, setShowModal] = useState(false);
  const [userName, setUserName] = useState('User');
  const [profileComplete, setProfileComplete] = useState(100);
  const [apps, setApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);

  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);

  const [gmailMsgs, setGmailMsgs] = useState([]);
  const [gmailScanning, setGmailScanning] = useState(false);
  const [gmailNote, setGmailNote] = useState('');

  useEffect(() => {
    authFetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data.personalInfo?.firstName) setUserName(data.personalInfo.firstName);
        const fields = [
          data.personalInfo?.firstName, data.personalInfo?.lastName,
          data.personalInfo?.email, data.personalInfo?.phone, data.personalInfo?.location,
          data.academicInfo?.college, data.academicInfo?.degree,
          data.professionalInfo?.skills, data.professionalInfo?.currentRole,
          data.bio,
        ];
        const filled = fields.filter(f => f && f.trim()).length;
        setProfileComplete(Math.round((filled / fields.length) * 100));
      })
      .catch(err => console.error('Failed to load profile', err));
  }, []);

  useEffect(() => {
    authFetch('/api/applications')
      .then(res => res.json())
      .then(data => setApps(data.applications || []))
      .catch(err => console.error('Failed to load applications', err))
      .finally(() => setLoadingApps(false));
  }, []);

  const countBy = (status) => apps.filter(a => a.status === status).length;
  const stats = [
    { t: 'Applied', v: countBy('Applied'), icon: 'send', tint: 'bg-surface-container-high text-primary' },
    { t: 'Interviewing', v: countBy('Interviewing'), icon: 'event_upcoming', tint: 'bg-secondary-container/30 text-secondary' },
    { t: 'Offers', v: countBy('Offer'), icon: 'check_circle', tint: 'bg-tertiary-fixed text-on-tertiary-fixed' },
    { t: 'Total', v: apps.length, icon: 'work_history', tint: 'bg-primary/10 text-primary' },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('gmail');
    if (g === 'connected') {
      setGmailNote('✅ Gmail connected! Click “Scan Inbox” to find job emails.');
      window.history.replaceState({}, '', '/');
    } else if (g === 'error') {
      setGmailNote('❌ Gmail connection failed. Please try again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleConnectGmail = async () => {
    try {
      const res = await authFetch('/api/gmail/auth-url');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setGmailNote(data.error || 'Could not start Gmail connection.');
    } catch {
      setGmailNote('Backend unreachable.');
    }
  };

  const handleScanGmail = async () => {
    setGmailScanning(true);
    setGmailNote('');
    try {
      const res = await authFetch('/api/gmail/scan', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (res.status === 400 && data.connected === false) {
        setGmailNote('Gmail isn’t connected yet — connect it first.');
      } else if (res.ok) {
        setGmailMsgs(data.opportunities || []);
        setGmailNote(`Found ${data.count} job-related email(s).`);
      } else {
        setGmailNote(data.error || 'Scan failed.');
      }
    } catch {
      setGmailNote('Backend unreachable.');
    } finally {
      setGmailScanning(false);
    }
  };

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
        setApps(prev => [data.application, ...prev]);
        setNewCompany('');
        setNewRole('');
        setShowModal(false);
      }
    } catch (err) {
      console.error('Failed to add application', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-md mb-xl">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-background tracking-tight">Welcome back, {userName} 👋</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Your AI-powered application pipeline is active.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-sm px-lg py-sm ai-button text-on-primary rounded-lg font-label-md text-label-md shadow-sm">
          <Icon name="add" className="text-[18px]" /> Add Application
        </button>
      </header>

      {/* Profile completeness prompt */}
      {profileComplete < 80 && (
        <div className="mb-lg p-md rounded-xl bg-tertiary-fixed/40 border border-tertiary-fixed-dim/50 flex items-center justify-between gap-md">
          <div className="flex items-center gap-md">
            <div className="w-11 h-11 rounded-lg bg-tertiary-fixed flex items-center justify-center shrink-0">
              <Icon name="info" fill className="text-on-tertiary-fixed" />
            </div>
            <div>
              <h3 className="font-label-md text-label-md text-on-tertiary-fixed">Complete your profile ({profileComplete}%)</h3>
              <p className="font-body-sm text-body-sm text-on-tertiary-fixed-variant">Fill all fields for the best autofill accuracy.</p>
            </div>
          </div>
          <Link to="/profile" className="flex items-center gap-xs px-md py-sm rounded-lg bg-tertiary text-on-tertiary font-label-md text-label-md hover:opacity-90 transition-opacity shrink-0">
            Complete <Icon name="arrow_forward" className="text-[16px]" />
          </Link>
        </div>
      )}

      {/* Stat bento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter mb-lg">
        {stats.map(stat => (
          <div key={stat.t} className="bg-surface rounded-xl border border-outline-variant/30 p-lg hover:shadow-[0_4px_12px_rgba(53,37,205,0.05)] transition-shadow">
            <div className="flex justify-between items-start mb-lg">
              <span className="font-label-md text-label-md text-on-surface-variant">{stat.t}</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stat.tint}`}>
                <Icon name={stat.icon} className="text-[18px]" />
              </div>
            </div>
            <span className="font-headline-xl text-headline-xl text-on-background leading-none">{stat.v}</span>
          </div>
        ))}
      </div>

      {/* Recent Applications */}
      <div className="bg-surface rounded-xl border border-outline-variant/30 overflow-hidden mb-lg">
        <div className="p-lg border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest">
          <h2 className="font-headline-md text-headline-md text-on-background">Recent Applications</h2>
          <span className="font-label-sm text-label-sm text-primary bg-surface-container px-sm py-xs rounded-full">Auto-tracking ON</span>
        </div>
        {loadingApps ? (
          <div className="p-2xl text-center font-body-sm text-body-sm text-on-surface-variant">Loading applications…</div>
        ) : apps.length === 0 ? (
          <div className="p-2xl text-center font-body-sm text-body-sm text-on-surface-variant">No applications yet. Click “Add Application” to start tracking.</div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {apps.map(app => (
              <div key={app.id} className="p-lg hover:bg-surface-container-low transition-colors flex items-center justify-between gap-md">
                <div>
                  <h3 className="font-label-md text-label-md text-on-surface">{app.role}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{app.company}</p>
                </div>
                <div className="flex items-center gap-md shrink-0">
                  <span className={`px-sm py-xs rounded-full font-label-sm text-label-sm ${STATUS_STYLES[app.status] || STATUS_STYLES.Applied}`}>{app.status}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{timeAgo(app.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gmail Job Tracker */}
      <div className="bg-surface rounded-xl border border-outline-variant/30 overflow-hidden">
        <div className="p-lg border-b border-outline-variant/30 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-md bg-surface-container-lowest">
          <div className="flex items-center gap-sm">
            <div className="w-11 h-11 rounded-lg bg-error-container/40 flex items-center justify-center shrink-0">
              <Icon name="mail" className="text-error" />
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-background">Gmail Job Tracker</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Find application updates in your inbox (read-only).</p>
            </div>
          </div>
          <div className="flex gap-sm">
            <button onClick={handleConnectGmail}
              className="px-md py-sm rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors">
              Connect Gmail
            </button>
            <button onClick={handleScanGmail} disabled={gmailScanning}
              className="flex items-center gap-xs px-md py-sm rounded-lg ai-button text-on-primary font-label-md text-label-md disabled:opacity-50">
              <Icon name="refresh" className={`text-[18px] ${gmailScanning ? 'animate-spin' : ''}`} /> {gmailScanning ? 'Scanning…' : 'Scan Inbox'}
            </button>
          </div>
        </div>
        {gmailNote && <div className="px-lg py-sm font-body-sm text-body-sm text-on-surface-variant bg-surface-container-low">{gmailNote}</div>}
        {gmailMsgs.length > 0 && (
          <div className="divide-y divide-outline-variant/20">
            {gmailMsgs.map(m => (
              <div key={m.id} className="p-lg hover:bg-surface-container-low transition-colors">
                <div className="flex items-center justify-between gap-md mb-xs">
                  <h3 className="font-label-md text-label-md text-on-surface truncate">{m.subject || '(no subject)'}</h3>
                  <span className={`shrink-0 px-sm py-xs rounded-full font-label-sm text-label-sm ${CLASSIFICATION_STYLES[m.classification] || CLASSIFICATION_STYLES['Job-related']}`}>{m.classification}</span>
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-xs truncate">{m.from}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{m.snippet}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-sm flex items-center justify-center z-50 p-md">
          <div className="bg-surface rounded-xl p-lg w-full max-w-[28rem] shadow-2xl border border-outline-variant/30">
            <h3 className="font-headline-md text-headline-md text-on-background mb-xs">Add Application</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">Manually track a job you applied for elsewhere.</p>
            <input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company Name"
              className="w-full mb-md px-md py-sm rounded-lg bg-surface-container-low border border-outline-variant/50 text-on-surface font-body-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" />
            <input type="text" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Role Title"
              className="w-full mb-lg px-md py-sm rounded-lg bg-surface-container-low border border-outline-variant/50 text-on-surface font-body-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" />
            <div className="flex gap-sm">
              <button onClick={handleAdd} disabled={saving || !newCompany.trim() || !newRole.trim()}
                className="flex-1 ai-button text-on-primary font-label-md text-label-md py-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : 'Save to Track'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="flex-1 bg-surface-container text-on-surface font-label-md text-label-md py-sm rounded-lg hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

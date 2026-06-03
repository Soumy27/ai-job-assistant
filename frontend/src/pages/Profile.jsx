import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth';

const Icon = ({ name, className = '', fill = false }) => (
  <span className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`} aria-hidden="true">{name}</span>
);

const inputClass = 'w-full bg-surface-container-low border border-outline-variant/50 focus:bg-surface focus:ring-1 focus:ring-primary focus:border-primary rounded-lg px-md py-sm font-body-md text-on-surface outline-none transition-colors';
const labelClass = 'font-label-md text-label-md text-on-surface-variant';

function SectionCard({ icon, title, children }) {
  return (
    <div className="bg-surface rounded-xl border border-outline-variant/30 p-lg">
      <h2 className="font-headline-md text-headline-md text-on-background mb-md flex items-center gap-sm">
        <Icon name={icon} className="text-primary" /> {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, icon, ...inputProps }) {
  return (
    <div className="space-y-xs relative">
      <label className={labelClass}>{label}</label>
      {icon && <Icon name={icon} className="absolute bottom-2.5 left-sm text-outline text-[20px] pointer-events-none" />}
      <input className={`${inputClass} ${icon ? 'pl-2xl' : ''}`} {...inputProps} />
    </div>
  );
}

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '', location: '',
  college: '', board: '', degree: '', graduationYear: '', cgpa: '',
  skills: '', yearsOfExperience: '', currentCompany: '', currentRole: '', linkedIn: '', portfolio: '',
  bio: '',
};

function calcCompleteness(data) {
  const fields = Object.values(data);
  const filled = fields.filter(v => v && v.trim()).length;
  return Math.round((filled / fields.length) * 100);
}

const Profile = () => {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/profile');
        const data = await res.json();
        const p = data.personalInfo || {};
        const a = data.academicInfo || {};
        const pr = data.professionalInfo || {};
        setForm({
          firstName: p.firstName || '', lastName: p.lastName || '',
          email: p.email || '', phone: p.phone || '', location: p.location || '',
          college: a.college || '', board: a.board || '', degree: a.degree || '',
          graduationYear: a.graduationYear || '', cgpa: a.cgpa || '',
          skills: pr.skills || '', yearsOfExperience: pr.yearsOfExperience || '',
          currentCompany: pr.currentCompany || '', currentRole: pr.currentRole || '',
          linkedIn: pr.linkedIn || '', portfolio: pr.portfolio || '',
          bio: data.bio || '',
        });
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    setIsSaving(true);
    setApiError('');
    try {
      const response = await authFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          personalInfo: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, location: form.location },
          academicInfo: { college: form.college, board: form.board, degree: form.degree, graduationYear: form.graduationYear, cgpa: form.cgpa },
          professionalInfo: { skills: form.skills, yearsOfExperience: form.yearsOfExperience, currentCompany: form.currentCompany, currentRole: form.currentRole, linkedIn: form.linkedIn, portfolio: form.portfolio },
          bio: form.bio,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save profile');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setApiError(err.message === 'Failed to fetch' ? 'Backend server is offline.' : err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-2xl text-center font-body-md text-on-surface-variant animate-pulse">Loading Profile…</div>;
  }

  const completeness = calcCompleteness(form);

  return (
    <div className="max-w-5xl">
      <header className="mb-xl">
        <h1 className="font-headline-xl text-headline-xl text-on-background tracking-tight">AI Identity Hub</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Your secure source of truth for the autofill engine.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Forms */}
        <div className="lg:col-span-2 space-y-lg">
          <SectionCard icon="person" title="Personal Info">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="First Name" name="firstName" value={form.firstName} onChange={handleChange} placeholder="John" />
              <Field label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Doe" />
              <Field label="Email Address" icon="mail" name="email" type="email" value={form.email} onChange={handleChange} placeholder="hello@example.com" />
              <Field label="Phone Number" icon="call" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" />
              <div className="md:col-span-2">
                <Field label="Location" icon="location_on" name="location" value={form.location} onChange={handleChange} placeholder="San Francisco, CA" />
              </div>
            </div>
          </SectionCard>

          <SectionCard icon="school" title="Academic Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="md:col-span-2">
                <Field label="College / University" name="college" value={form.college} onChange={handleChange} placeholder="MIT, Stanford, IIT Delhi…" />
              </div>
              <Field label="Board / University Name" name="board" value={form.board} onChange={handleChange} placeholder="CBSE, University of…" />
              <Field label="Degree / Program" name="degree" value={form.degree} onChange={handleChange} placeholder="B.Tech Computer Science" />
              <Field label="Graduation Year" name="graduationYear" value={form.graduationYear} onChange={handleChange} placeholder="2025" />
              <Field label="CGPA / Percentage" name="cgpa" value={form.cgpa} onChange={handleChange} placeholder="9.2 / 92%" />
            </div>
          </SectionCard>

          <SectionCard icon="work" title="Professional Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="md:col-span-2 space-y-xs">
                <label className={labelClass}>Skills</label>
                <input name="skills" value={form.skills} onChange={handleChange} className={inputClass} placeholder="React, Node.js, Python, Machine Learning…" />
                <p className="font-label-sm text-label-sm text-outline">Separate with commas</p>
              </div>
              <Field label="Years of Experience" name="yearsOfExperience" value={form.yearsOfExperience} onChange={handleChange} placeholder="2" />
              <Field label="Current Company" name="currentCompany" value={form.currentCompany} onChange={handleChange} placeholder="Google, Startup, Freelance…" />
              <Field label="Current Role" name="currentRole" value={form.currentRole} onChange={handleChange} placeholder="Software Engineer" />
              <Field label="LinkedIn URL" icon="link" name="linkedIn" value={form.linkedIn} onChange={handleChange} placeholder="https://linkedin.com/in/…" />
              <div className="md:col-span-2">
                <Field label="Portfolio / Website" icon="language" name="portfolio" value={form.portfolio} onChange={handleChange} placeholder="https://yoursite.com" />
              </div>
            </div>
          </SectionCard>

          <SectionCard icon="auto_awesome" title="Professional Narrative">
            <div className="space-y-xs">
              <label className={labelClass}>Tell us about yourself (used by AI for answer generation)</label>
              <textarea name="bio" value={form.bio} onChange={handleChange} rows="5" className={`${inputClass} resize-none`} placeholder="Passionate software engineer with experience in…" />
            </div>
          </SectionCard>
        </div>

        {/* Sidebar status */}
        <div className="lg:col-span-1">
          <div className="bg-inverse-surface rounded-xl p-lg text-inverse-on-surface shadow-xl sticky top-lg space-y-lg">
            <div>
              <h3 className="font-headline-md text-headline-md mb-xs">Profile Status</h3>
              <p className="font-body-sm text-body-sm text-inverse-on-surface/70 leading-relaxed">
                The browser extension uses this data to autofill forms and generate AI answers.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-xs">
                <span className="font-label-md text-label-md text-inverse-on-surface/80">Completeness</span>
                <span className="font-headline-md text-headline-md">{completeness}%</span>
              </div>
              <div className="w-full bg-inverse-on-surface/20 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary-fixed-dim to-secondary-container transition-all duration-700" style={{ width: `${completeness}%` }} />
              </div>
              {completeness < 100 && (
                <p className="font-label-sm text-label-sm text-inverse-on-surface/60 mt-xs">Fill all fields for the best autofill accuracy.</p>
              )}
            </div>

            {apiError && (
              <div className="p-sm bg-error/20 border border-error/40 rounded-lg font-body-sm text-body-sm text-error-container">
                ⚠️ {apiError}
              </div>
            )}

            <button onClick={handleSave} disabled={isSaving}
              className={`w-full py-sm rounded-lg font-label-md text-label-md flex items-center justify-center gap-sm transition-all ${
                saved ? 'bg-secondary text-on-secondary' : 'ai-button text-on-primary'
              } disabled:opacity-60 disabled:cursor-not-allowed`}>
              {isSaving ? <span className="animate-pulse">Syncing…</span>
                : saved ? <>Synced <Icon name="check" className="text-[18px]" /></>
                : <><Icon name="save" className="text-[18px]" /> Save Profile</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

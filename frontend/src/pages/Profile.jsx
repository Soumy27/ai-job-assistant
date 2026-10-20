import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth';
import Icon from '../components/Icon';

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '', location: '',
  college: '', board: '', degree: '', graduationYear: '', cgpa: '',
  skills: '', yearsOfExperience: '', currentCompany: '', currentRole: '',
  linkedIn: '', portfolio: '', bio: '',
};

/**
 * Settings in two columns: a label column carrying the section's name and the
 * reason it matters, beside the panel of fields. Sections are split by a full
 * width rule, never by a card edge.
 */
const SECTIONS = [
  {
    title: 'You',
    help: 'Used to fill the name, contact and location fields on application forms.',
    fields: [
      ['firstName', 'First name'], ['lastName', 'Last name'],
      ['email', 'Email'], ['phone', 'Phone'], ['location', 'Location'],
    ],
  },
  {
    title: 'Education',
    help: 'Most graduate applications ask for all four of these.',
    fields: [
      ['college', 'College'], ['degree', 'Degree'],
      ['graduationYear', 'Graduation year'], ['cgpa', 'CGPA'], ['board', 'Board'],
    ],
  },
  {
    title: 'Work',
    help: 'Your skills line is what the AI draws on when it drafts an answer.',
    fields: [
      ['currentRole', 'Current role'], ['currentCompany', 'Current company'],
      ['yearsOfExperience', 'Years of experience'], ['skills', 'Skills'],
      ['linkedIn', 'LinkedIn'], ['portfolio', 'Portfolio'],
    ],
  },
];

export default function Profile() {
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
      } catch {
        setApiError('Could not load your profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setApiError(err.message === 'Failed to fetch' ? 'Could not reach the server.' : err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const total = Object.keys(EMPTY_FORM).length;
  const filled = Object.values(form).filter((v) => v && String(v).trim()).length;
  const completeness = Math.round((filled / total) * 100);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <h1 className="text-title tracking-tight">Profile</h1>
        <p className="mt-1 text-body text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title tracking-tight">Profile</h1>
          <p className="mt-1 text-body text-muted">
            <span className="fig">{filled}</span> of <span className="fig">{total}</span> fields filled
            {completeness < 80 && '. Autofill skips anything blank.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span role="status" className="flex items-center gap-1 text-body text-positive">
              <Icon name="check" /> Saved
            </span>
          )}
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </header>

      {apiError && (
        <p role="alert" className="mb-3 flex items-start gap-2 rounded-card border border-border bg-surface px-4 py-3 text-body text-negative">
          <Icon name="alert" className="mt-[2px] shrink-0" />
          {apiError}
        </p>
      )}

      {SECTIONS.map((section, i) => (
        <section
          key={section.title}
          aria-labelledby={`sec-${i}`}
          className={`grid gap-6 py-8 lg:grid-cols-[320px_1fr] ${i > 0 ? 'border-t border-border' : 'pt-0'}`}
        >
          <div>
            <h2 id={`sec-${i}`} className="text-section">{section.title}</h2>
            <p className="mt-1 text-body text-muted">{section.help}</p>
          </div>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {section.fields.map(([name, label]) => (
              <div key={name}>
                <label className="block text-body font-medium" htmlFor={name}>{label}</label>
                <input
                  id={name}
                  name={name}
                  className="field mt-2"
                  value={form[name]}
                  placeholder="—"
                  onChange={handleChange}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="sec-bio" className="grid gap-6 border-t border-border py-8 lg:grid-cols-[320px_1fr]">
        <div>
          <h2 id="sec-bio" className="text-section">Summary</h2>
          <p className="mt-1 text-body text-muted">
            A short description of you, written from your resume. Applications that ask
            “tell us about yourself” start from this.
          </p>
        </div>
        <div>
          <label className="sr-only" htmlFor="bio">Summary</label>
          <textarea
            id="bio"
            name="bio"
            className="field"
            rows={5}
            value={form.bio}
            placeholder="—"
            onChange={handleChange}
          />
        </div>
      </section>
    </div>
  );
}

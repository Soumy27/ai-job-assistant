import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../utils/auth';
import Icon from '../components/Icon';

const FIELDS = [
  ['personalInfo', 'firstName', 'First name'],
  ['personalInfo', 'lastName', 'Last name'],
  ['personalInfo', 'email', 'Email'],
  ['personalInfo', 'phone', 'Phone'],
  ['personalInfo', 'location', 'Location'],
  ['academicInfo', 'college', 'College'],
  ['academicInfo', 'degree', 'Degree'],
  ['academicInfo', 'graduationYear', 'Graduation year'],
  ['professionalInfo', 'currentRole', 'Current role'],
  ['professionalInfo', 'currentCompany', 'Current company'],
  ['professionalInfo', 'yearsOfExperience', 'Years of experience'],
  ['professionalInfo', 'skills', 'Skills'],
  ['professionalInfo', 'linkedIn', 'LinkedIn'],
  ['professionalInfo', 'portfolio', 'Portfolio'],
];

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [phase, setPhase] = useState('upload'); // upload | review | saved
  const [errorMessage, setErrorMessage] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [source, setSource] = useState('');
  const fileInputRef = useRef(null);

  const pickFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      setErrorMessage('That is not a PDF. Export your resume as a PDF and try again.');
      return;
    }
    setFile(f);
    setErrorMessage('');
    setPhase('upload');
    setExtracted(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMessage('');
    const formData = new FormData();
    formData.append('resume', file);
    try {
      const response = await authFetch('/api/resume/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      setExtracted(data.extracted);
      setSource(data.source);
      setPhase('review');
    } catch (error) {
      setErrorMessage(
        error.message === 'Failed to fetch' ? 'Could not reach the server.' : error.message
      );
    } finally {
      setIsUploading(false);
    }
  };

  const setField = (section, field, value) =>
    setExtracted((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      const res = await authFetch('/api/resume/apply-to-profile', {
        method: 'POST',
        body: JSON.stringify({
          personalInfo: extracted.personalInfo,
          academicInfo: extracted.academicInfo,
          professionalInfo: extracted.professionalInfo,
          bio: extracted.bio,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setPhase('saved');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filledCount = extracted
    ? FIELDS.filter(([s, f]) => extracted[s]?.[f]?.trim?.()).length
    : 0;

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-7">
        <h1 className="text-title tracking-tight">Resume</h1>
        <p className="mt-1 text-body text-muted">
          {phase === 'review'
            ? `Read ${filledCount} of ${FIELDS.length} fields. Correct anything wrong before saving.`
            : 'Upload a PDF resume and it fills your profile, which the extension then uses to autofill applications.'}
        </p>
      </header>

      {errorMessage && (
        <p role="alert" className="mb-3 flex items-start gap-2 rounded-card border border-border bg-surface px-4 py-3 text-body text-negative">
          <Icon name="alert" className="mt-[2px] shrink-0" />
          {errorMessage}
        </p>
      )}

      {phase === 'upload' && (
        <section className="panel px-5 py-6">
          <h2 className="text-section">Upload</h2>
          <p className="mt-1 text-body text-muted">PDF only, up to 5MB. Text-based, not a scan.</p>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className="mt-4 rounded-card border border-dashed border-control px-5 py-8 text-center"
          >
            <p className="text-body">
              {file ? file.name : 'Drop your resume here, or choose a file.'}
            </p>
            {file && (
              <p className="fig mt-1 text-small text-muted">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" className="btn btn-quiet" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </button>
              <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={!file || isUploading}>
                <Icon name="upload" />
                {isUploading ? 'Reading…' : 'Read resume'}
              </button>
            </div>
          </div>
        </section>
      )}

      {phase === 'review' && extracted && (
        <>
          <section className="panel mb-3">
            <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
              <h2 className="text-section">What we read</h2>
              <span className="text-small text-muted">
                {source === 'ai+regex' ? 'AI-assisted' : 'pattern match only'}
              </span>
            </div>
            <div className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
              {FIELDS.map(([section, field, label]) => (
                <div key={`${section}.${field}`}>
                  <label className="block text-body font-medium" htmlFor={`${section}-${field}`}>
                    {label}
                  </label>
                  <input
                    id={`${section}-${field}`}
                    className="field mt-2"
                    value={extracted[section]?.[field] || ''}
                    placeholder="—"
                    onChange={(e) => setField(section, field, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="panel mb-3">
            <div className="border-b border-rule px-5 py-3">
              <h2 className="text-section">Summary</h2>
            </div>
            <div className="px-5 py-5">
              <p className="mb-2 text-body text-muted">
                Written from your whole resume, for when an application asks you to describe yourself.
              </p>
              <textarea
                className="field"
                rows={4}
                value={extracted.bio || ''}
                placeholder="—"
                onChange={(e) => setExtracted((p) => ({ ...p, bio: e.target.value }))}
              />
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-quiet" onClick={() => { setPhase('upload'); setFile(null); setExtracted(null); }}>
              Start over
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save to profile'}
            </button>
          </div>
        </>
      )}

      {phase === 'saved' && (
        <section className="panel px-5 py-6">
          <h2 className="flex items-center gap-2 text-section">
            <Icon name="check" className="text-positive" />
            Saved to your profile
          </h2>
          <p className="mt-1 text-body text-muted">
            The extension will use these details to autofill application forms.
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/profile" className="btn btn-primary">Review profile</Link>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => { setPhase('upload'); setFile(null); setExtracted(null); }}
            >
              Upload another
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

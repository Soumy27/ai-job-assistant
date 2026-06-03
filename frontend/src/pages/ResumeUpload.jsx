import React, { useState, useRef } from 'react';
import { authFetch } from '../utils/auth';

const Icon = ({ name, className = '', fill = false }) => (
  <span className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`} aria-hidden="true">{name}</span>
);

const inputClass = 'w-full bg-surface-container-low border border-outline-variant/50 focus:bg-surface focus:ring-1 focus:ring-primary focus:border-primary rounded-lg px-md py-sm font-body-sm text-on-surface outline-none transition-colors';
const labelClass = 'font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide';

const ResumeUpload = () => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [phase, setPhase] = useState('upload'); // 'upload' | 'review' | 'saved'
  const [errorMessage, setErrorMessage] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [rawPreview, setRawPreview] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      if (f.type !== 'application/pdf') {
        setErrorMessage('Please upload a valid PDF file.');
        return;
      }
      setFile(f);
      setErrorMessage('');
      setPhase('upload');
      setExtracted(null);
    }
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
      setRawPreview(data.rawPreview);
      setPhase('review');
    } catch (error) {
      setErrorMessage(error.message === 'Failed to fetch' ? 'Backend server is offline' : error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFieldChange = (section, field, value) => {
    setExtracted(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const handleSaveToProfile = async () => {
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
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      setPhase('saved');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-lg">
      <header>
        <h1 className="font-headline-xl text-headline-xl text-on-background tracking-tight">AI Resume Parser</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Upload your PDF resume. We'll extract key data and let you review before saving.</p>
      </header>

      {/* Upload */}
      {phase === 'upload' && (
        <div className={`bg-surface rounded-xl border p-2xl flex flex-col items-center text-center transition-all ${file ? 'border-primary/50 shadow-[0_4px_24px_rgba(53,37,205,0.08)]' : 'border-outline-variant/30'}`}>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-md transition-all ${file ? 'ai-gradient-bg shadow-lg shadow-primary/30 scale-110' : 'bg-surface-container-high'}`}>
            <Icon name={file ? 'description' : 'cloud_upload'} className={`text-[36px] ${file ? 'text-on-primary' : 'text-primary'}`} />
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface">{file ? file.name : 'Upload your resume'}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs mb-lg">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB PDF` : 'Select a PDF to extract your details.'}
          </p>
          <div className="flex gap-md w-full max-w-md">
            <button onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md py-md rounded-lg transition-colors">
              {file ? 'Change File' : 'Select PDF'}
            </button>
            {file && (
              <button onClick={handleUpload} disabled={isUploading}
                className="flex-1 ai-button text-on-primary font-label-md text-label-md py-md rounded-lg disabled:opacity-50">
                {isUploading ? <span className="animate-pulse">Extracting…</span> : 'Extract Data'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Review */}
      {phase === 'review' && extracted && (
        <div className="space-y-lg">
          <div className="bg-secondary/5 border border-secondary/30 rounded-lg p-md flex items-center gap-sm">
            <Icon name="edit" className="text-secondary text-[20px] shrink-0" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">Review the extracted data below. Edit any incorrect fields before saving to your profile.</p>
          </div>

          <div className="bg-surface rounded-xl border border-outline-variant/30 p-lg">
            <h3 className="font-headline-md text-headline-md text-on-background mb-md flex items-center gap-sm"><Icon name="person" className="text-primary" /> Personal Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {[['First Name','personalInfo','firstName'],['Last Name','personalInfo','lastName'],['Email','personalInfo','email'],['Phone','personalInfo','phone']].map(([label, section, field]) => (
                <div key={field}>
                  <label className={labelClass}>{label}</label>
                  <input className={`${inputClass} mt-xs`} value={extracted[section]?.[field] || ''} onChange={e => handleFieldChange(section, field, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-outline-variant/30 p-lg">
            <h3 className="font-headline-md text-headline-md text-on-background mb-md flex items-center gap-sm"><Icon name="school" className="text-primary" /> Academic Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {[['College / University','academicInfo','college'],['Degree / Program','academicInfo','degree']].map(([label, section, field]) => (
                <div key={field}>
                  <label className={labelClass}>{label}</label>
                  <input className={`${inputClass} mt-xs`} value={extracted[section]?.[field] || ''} onChange={e => handleFieldChange(section, field, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-outline-variant/30 p-lg">
            <h3 className="font-headline-md text-headline-md text-on-background mb-md flex items-center gap-sm"><Icon name="work" className="text-primary" /> Professional Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {[['Current Role','professionalInfo','currentRole'],['Current Company','professionalInfo','currentCompany'],['LinkedIn','professionalInfo','linkedIn'],['Portfolio','professionalInfo','portfolio']].map(([label, section, field]) => (
                <div key={field}>
                  <label className={labelClass}>{label}</label>
                  <input className={`${inputClass} mt-xs`} value={extracted[section]?.[field] || ''} onChange={e => handleFieldChange(section, field, e.target.value)} />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className={labelClass}>Skills</label>
                <input className={`${inputClass} mt-xs`} value={extracted.professionalInfo?.skills || ''} onChange={e => handleFieldChange('professionalInfo', 'skills', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-outline-variant/30 p-lg">
            <h3 className="font-headline-md text-headline-md text-on-background mb-md flex items-center gap-sm"><Icon name="notes" className="text-primary" /> Summary</h3>
            <textarea className={`${inputClass} resize-none`} rows="3" value={extracted.bio || ''} onChange={e => setExtracted(prev => ({ ...prev, bio: e.target.value }))} />
          </div>

          <div className="flex gap-md">
            <button onClick={handleSaveToProfile} disabled={isSaving}
              className="flex-1 ai-button text-on-primary font-label-md text-label-md py-md rounded-lg flex items-center justify-center gap-sm disabled:opacity-50">
              {isSaving ? <span className="animate-pulse">Saving…</span> : <><Icon name="save" className="text-[18px]" /> Save to Profile</>}
            </button>
            <button onClick={() => { setPhase('upload'); setFile(null); setExtracted(null); }}
              className="bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md py-md px-xl rounded-lg transition-colors">
              Cancel
            </button>
          </div>

          {rawPreview && (
            <details className="bg-inverse-surface rounded-xl">
              <summary className="p-md font-label-sm text-label-sm text-inverse-on-surface/70 cursor-pointer hover:text-inverse-on-surface transition-colors">View Raw Extracted Text</summary>
              <div className="px-lg pb-lg">
                <pre className="font-mono text-xs text-inverse-on-surface/60 whitespace-pre-wrap leading-relaxed">{rawPreview}</pre>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Saved */}
      {phase === 'saved' && (
        <div className="bg-surface rounded-xl border border-secondary/40 p-2xl flex flex-col items-center text-center">
          <div className="w-20 h-20 ai-gradient-bg rounded-full flex items-center justify-center mb-md shadow-lg shadow-primary/30">
            <Icon name="check_circle" fill className="text-on-primary text-[40px]" />
          </div>
          <h3 className="font-headline-lg text-headline-lg text-on-background">Profile Updated!</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Resume data has been merged into your profile.</p>
          <div className="flex gap-md mt-lg">
            <a href="/profile" className="font-label-md text-label-md text-primary bg-surface-container px-lg py-sm rounded-full hover:bg-surface-container-high transition-colors">View Profile →</a>
            <button onClick={() => { setFile(null); setPhase('upload'); setExtracted(null); }}
              className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low px-lg py-sm rounded-full hover:bg-surface-container transition-colors">Upload Another</button>
          </div>
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div className="flex items-center gap-sm font-body-sm text-body-sm text-on-error-container bg-error-container/40 px-md py-sm border border-error/20 rounded-lg">
          <Icon name="error" fill className="text-error text-[20px]" /> {errorMessage}
        </div>
      )}
    </div>
  );
};

export default ResumeUpload;

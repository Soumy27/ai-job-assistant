import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/auth';

function Shell({ title, lead, children }) {
  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-[380px]">
        <div className="mb-8">
          <Link to="/login" className="text-section font-semibold tracking-tight">CareerAI</Link>
          <h1 className="mt-6 text-title tracking-tight">{title}</h1>
          <p className="mt-1 text-body text-muted">{lead}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Step 1 — ask for a reset link. */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setNote(data.devNote || '');
      setState('sent');
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not reach the server.' : err.message);
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <Shell
        title="Check your email"
        lead="If an account exists for that address, a reset link is on its way. It expires in 60 minutes."
      >
        {note && <p className="mb-4 text-body text-warning">{note}</p>}
        <p className="text-body text-muted">
          Nothing arrived? Check spam, or{' '}
          <button
            type="button"
            className="cursor-pointer text-text underline underline-offset-2"
            onClick={() => setState('idle')}
          >
            try a different address
          </button>
          .
        </p>
        <Link to="/login" className="btn btn-quiet mt-6">Back to sign in</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Reset your password" lead="We'll email you a link to choose a new one.">
      <form onSubmit={submit} noValidate>
        <label className="block text-body font-medium" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="field mt-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          autoFocus
        />
        {error && <p role="alert" className="mt-4 text-body text-negative">{error}</p>}
        <button type="submit" className="btn btn-primary mt-6 w-full" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-body text-muted">
        Remembered it?{' '}
        <Link to="/login" className="text-text underline underline-offset-2">Sign in</Link>
      </p>
    </Shell>
  );
}

/** Step 2 — choose the new password, using the token from the emailed link. */
export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <Shell title="Link not valid" lead="This reset link is missing its token.">
        <Link to="/forgot-password" className="btn btn-primary">Request a new link</Link>
      </Shell>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset the password');
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not reach the server.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Shell title="Password updated" lead="Taking you to the sign-in page…">
        <Link to="/login" className="btn btn-primary">Sign in</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Choose a new password" lead="This link works once.">
      <form onSubmit={submit} noValidate>
        <label className="block text-body font-medium" htmlFor="password">New password</label>
        <input
          id="password"
          type="password"
          className="field mt-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          autoFocus
        />

        <label className="mt-4 block text-body font-medium" htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          type="password"
          className="field mt-2"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error && <p role="alert" className="mt-4 text-body text-negative">{error}</p>}

        <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </Shell>
  );
}

import React, { useState } from 'react';
import { login, API_BASE } from '../utils/auth';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setIsLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: isLogin ? undefined : name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong');
      if (!isLogin) {
        setIsLogin(true);
        setPassword('');
        setMessage({ text: 'Account created. Sign in to continue.', type: 'success' });
        return;
      }
      login(data.token, data.userid);
      window.location.href = '/';
    } catch (err) {
      setMessage({
        text: err.message === 'Failed to fetch' ? 'Could not reach the server.' : err.message,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-[380px]">
        <div className="mb-8">
          <div className="text-section font-semibold tracking-tight">CareerAI</div>
          <h1 className="mt-6 text-title tracking-tight">
            {isLogin ? 'Sign in' : 'Create your account'}
          </h1>
          <p className="mt-1 text-body text-muted">
            Track every application from saved to offer.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <div className="mb-4">
              <label className="block text-body font-medium" htmlFor="name">Name</label>
              <input
                id="name"
                className="field mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-body font-medium" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="field mt-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-body font-medium" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="field mt-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {message.text && (
            <p
              role={message.type === 'error' ? 'alert' : 'status'}
              className={`mb-4 text-body ${message.type === 'error' ? 'text-negative' : 'text-positive'}`}
            >
              {message.text}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Working…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-body text-muted">
          {isLogin ? 'No account yet?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage({ text: '', type: '' });
            }}
            className="cursor-pointer text-text underline underline-offset-2"
          >
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

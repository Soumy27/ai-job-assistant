import React, { useState } from 'react';
import { login, API_BASE } from '../utils/auth';

const Icon = ({ name, className = '', fill = false }) => (
  <span className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`} aria-hidden="true">{name}</span>
);

const Login = () => {
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
        setMessage({ text: 'Account created! Please sign in with your credentials.', type: 'success' });
        return;
      }
      login(data.token, data.userid);
      window.location.href = '/';
    } catch (err) {
      setMessage({
        text: err.message === 'Failed to fetch' ? 'Backend server is unreachable.' : err.message,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setMessage({ text: '', type: '' });
  };

  const inputClass =
    'mt-xs w-full px-md py-sm rounded-lg border border-outline-variant/50 bg-surface-container-low text-on-surface font-body-md placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface transition-colors';
  const labelClass = 'block font-label-md text-label-md text-on-surface-variant';

  return (
    <div className="min-h-screen flex items-center justify-center p-md relative overflow-hidden">
      {/* Atmospheric accents */}
      <div className="fixed -top-40 -left-40 w-[500px] h-[500px] bg-primary-fixed-dim/30 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed -bottom-40 -right-40 w-[500px] h-[500px] bg-secondary-container/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="w-full max-w-[28rem]">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-lg">
          <div className="w-16 h-16 rounded-xl ai-gradient-bg flex items-center justify-center shadow-lg shadow-primary/30 mb-md">
            <Icon name="robot_2" fill className="text-on-primary text-[32px]" />
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-background tracking-tight">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            Your AI-powered job application copilot.
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-xl p-lg sm:p-xl">
          {message.text && (
            <div
              className={`mb-md p-sm rounded-lg flex items-center gap-sm font-body-sm text-body-sm border ${
                message.type === 'success'
                  ? 'bg-secondary-container/20 text-on-secondary-container border-secondary/30'
                  : 'bg-error-container/40 text-on-error-container border-error/20'
              }`}
            >
              <Icon name={message.type === 'success' ? 'check_circle' : 'error'} fill className="text-[20px] shrink-0" />
              {message.text}
            </div>
          )}

          <form className="space-y-md" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className={labelClass}>Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required={!isLogin}
                  className={inputClass} placeholder="John Doe" />
              </div>
            )}
            <div>
              <label className={labelClass}>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className={inputClass} placeholder="hello@example.com" />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className={inputClass} placeholder="••••••••" />
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full flex justify-center items-center gap-sm py-md rounded-lg ai-button text-on-primary font-label-md text-label-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading
                ? <span className="animate-pulse">Processing…</span>
                : <>{isLogin ? 'Sign in' : 'Create account'} <Icon name="arrow_forward" className="text-[18px]" /></>}
            </button>
          </form>

          <p className="mt-lg text-center font-body-sm text-body-sm text-on-surface-variant">
            {isLogin ? "Don't have an account? " : 'Already registered? '}
            <button onClick={switchMode} className="font-label-md text-label-md text-primary hover:text-secondary transition-colors cursor-pointer">
              {isLogin ? 'Sign up for free' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

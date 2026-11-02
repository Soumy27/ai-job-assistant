import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ResumeUpload from './pages/ResumeUpload';
import { Privacy, Terms } from './pages/Legal';
import { ForgotPassword, ResetPassword } from './pages/ResetPassword';
import { isLoggedIn, login, logout } from './utils/auth';

function App() {
  const [authenticated, setAuthenticated] = useState(isLoggedIn());

  useEffect(() => {
    // Listen for extension sync messages
    const handler = (event) => {
      if (event.data?.type === 'EXTENSION_SYNC') {
        if (event.data.token && !isLoggedIn()) {
          // Extension is logged in but website is not — sync it
          login(event.data.token, event.data.userid);
          setAuthenticated(true);
        } else if (!event.data.token && isLoggedIn()) {
          // Extension logged out — sync that too
          logout();
          setAuthenticated(false);
        }
      }
    };
    window.addEventListener('message', handler);

    // Ask the extension content script for its current auth state
    window.postMessage({ type: 'REQUEST_SYNC' }, '*');

    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public: Google must be able to fetch these without a session before
            it will let the OAuth consent screen be published. */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        <Route path="/login" element={authenticated ? <Navigate to="/" /> : <Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={authenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="resume" element={<ResumeUpload />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

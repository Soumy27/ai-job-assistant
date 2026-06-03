/**
 * Auth utility — single source of truth for token/session management.
 * Used by all frontend components that make API calls.
 */

// Configurable for deployment: set VITE_API_BASE in the host's env (e.g. Vercel)
// to your deployed backend URL. Falls back to localhost for local dev.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5005';

export function getToken() {
  return localStorage.getItem('token');
}

export function getUserId() {
  return localStorage.getItem('userid');
}

export function isLoggedIn() {
  return !!getToken();
}

export function login(token, userid) {
  localStorage.setItem('token', token);
  localStorage.setItem('userid', userid);
  localStorage.setItem('isAuthenticated', 'true');
  // Tell extension content script
  window.postMessage({ type: 'LOGIN', token, userid }, '*');
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userid');
  localStorage.removeItem('isAuthenticated');
  window.postMessage({ type: 'LOGOUT' }, '*');
}

/**
 * Authenticated fetch wrapper.
 * Automatically attaches Bearer token to all requests.
 */
export async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies (not for FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // If token expired/invalid, force logout
  if (response.status === 401) {
    logout();
    window.location.href = '/login';
    throw new Error('Session expired. Please sign in again.');
  }

  return response;
}

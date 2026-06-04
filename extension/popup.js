document.addEventListener('DOMContentLoaded', () => {
  const scanFormsBtn = document.getElementById('scan-forms-btn');
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');

  // Point the "Open Web Dashboard" link at the configured frontend URL.
  const dashboardLink = document.getElementById('dashboard-link');
  if (dashboardLink) dashboardLink.href = WEB_BASE;

  // ── Persistent "autofill bar on job sites" toggle ──
  const barToggle = document.getElementById('bar-toggle');
  if (barToggle) {
    chrome.storage.local.get(['autofillBarDisabled'], ({ autofillBarDisabled }) => {
      barToggle.checked = !autofillBarDisabled;   // checked = enabled
    });
    barToggle.addEventListener('change', () => {
      // content.js listens for this change and shows/hides the bar live
      chrome.storage.local.set({ autofillBarDisabled: !barToggle.checked });
    });
  }

  // ── Helper: load user name from backend ──
  function loadUserName(token, userid) {
    fetch(`${API_BASE}/api/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.personalInfo?.firstName) {
          const fullName = `${data.personalInfo.firstName} ${data.personalInfo.lastName || ''}`.trim();
          document.getElementById('user-name').innerText = fullName;
          const initials = (data.personalInfo.firstName[0] + (data.personalInfo.lastName?.[0] || '')).toUpperCase();
          document.getElementById('user-avatar').innerText = initials;
        }
      })
      .catch(err => console.error('Failed to load popup profile', err));
  }

  // ── Check if already logged in ──
  chrome.storage.local.get(['token', 'userid'], (result) => {
    if (result.token) {
      authSection.style.display = 'none';
      dashboardSection.style.display = 'block';
      loadUserName(result.token, result.userid);
    }
  });

  // ── Auth form elements ──
  const authForm = document.getElementById('auth-form');
  const authToggleBtn = document.getElementById('auth-toggle-btn');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authToggleText = document.getElementById('auth-toggle-text');
  const authSubmit = document.getElementById('auth-submit');
  const extLogoutBtn = document.getElementById('ext-logout-btn');
  const authNameField = document.getElementById('auth-name');

  let isSignup = false;

  // ── Toggle Sign In / Sign Up ──
  authToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isSignup = !isSignup;

    authNameField.style.display = isSignup ? 'block' : 'none';
    authNameField.required = isSignup;

    authTitle.innerText = isSignup ? 'Sign Up' : 'Sign In';
    authSubtitle.innerText = isSignup ? 'Create an account to get started.' : 'Login to connect your identity hub.';
    authSubtitle.style.color = '#9ca3af';
    authSubmit.innerText = isSignup ? 'Create Account' : 'Sign In';
    authToggleText.innerText = isSignup ? 'Already have an account?' : "Don't have an account?";
    authToggleBtn.innerText = isSignup ? 'Sign In' : 'Sign Up';
  });

  // ── Form Submit ──
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login';
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = authNameField.value || undefined;

    authSubmit.innerText = 'Processing...';
    authSubtitle.style.color = '#9ca3af';

    fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          authSubtitle.innerText = data.error;
          authSubtitle.style.color = '#ef4444';
          authSubmit.innerText = isSignup ? 'Create Account' : 'Sign In';
          return;
        }

        // Registration success → switch to sign-in
        if (isSignup) {
          isSignup = false;
          authNameField.style.display = 'none';
          authNameField.required = false;
          document.getElementById('auth-password').value = '';

          authTitle.innerText = 'Sign In';
          authSubtitle.innerText = 'Account created! Please sign in.';
          authSubtitle.style.color = '#10b981';
          authSubmit.innerText = 'Sign In';
          authToggleText.innerText = "Don't have an account?";
          authToggleBtn.innerText = 'Sign Up';
          return;
        }

        // Login success → store token and show dashboard
        chrome.storage.local.set({ token: data.token, userid: data.userid }, () => {
          authSection.style.display = 'none';
          dashboardSection.style.display = 'block';
          loadUserName(data.token, data.userid);
        });
      })
      .catch(() => {
        authSubtitle.innerText = 'Backend server is unreachable.';
        authSubtitle.style.color = '#ef4444';
        authSubmit.innerText = isSignup ? 'Create Account' : 'Sign In';
      });
  });

  // ── Logout ──
  extLogoutBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['token', 'userid'], () => {
      dashboardSection.style.display = 'none';
      authSection.style.display = 'block';
      document.getElementById('user-name').innerText = 'Loading...';
      document.getElementById('user-avatar').innerText = '?';
    });
  });

  // ── Autofill / Scan Forms ──
  scanFormsBtn.addEventListener('click', () => {
    scanFormsBtn.innerText = 'Scanning...';
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0]) return;

      if (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('edge://')) {
        scanFormsBtn.innerText = 'Cannot run on browser pages';
        setTimeout(() => (scanFormsBtn.innerText = '✨ Autofill Page'), 3000);
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: 'SCAN_FORMS' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          scanFormsBtn.innerText = 'Refresh the page first!';
          setTimeout(() => (scanFormsBtn.innerText = '✨ Autofill Page'), 3000);
          return;
        }

        const fields = response.fields.map((f) => f.name || f.id).filter((f) => f);

        chrome.storage.local.get(['token'], (result) => {
          fetch(`${API_BASE}/api/ai/match-fields`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${result.token}`,
            },
            body: JSON.stringify({ fields }),
          })
            .then((res) => res.json())
            .then((data) => {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'AUTOFILL', data: data.matchedData }, () => {
                scanFormsBtn.innerText = 'Autofill Complete!';
                setTimeout(() => (scanFormsBtn.innerText = '✨ Autofill Page'), 2000);
              });
            })
            .catch(() => {
              scanFormsBtn.innerText = 'API Error';
              setTimeout(() => (scanFormsBtn.innerText = '✨ Autofill Page'), 3000);
            });
        });
      });
    });
  });
});

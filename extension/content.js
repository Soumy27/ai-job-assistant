console.log('AI Job Assistant Content Script Loaded');

// Host of the React dashboard (e.g. "localhost:5173"), derived from shared config.
const WEB_HOST = (typeof WEB_BASE !== 'undefined' ? WEB_BASE : 'http://localhost:5173').replace(/^https?:\/\//, '');

// ══════════════════════════════════════════════════
// ── SECTION 1: Sync Bridge (dashboard page only) ──
// ══════════════════════════════════════════════════
if (window.location.href.includes(WEB_HOST)) {

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'LOGIN' && event.data.token) {
      chrome.storage.local.set({ token: event.data.token, userid: event.data.userid });
    } else if (event.data?.type === 'LOGOUT') {
      chrome.storage.local.remove(['token', 'userid']);
    } else if (event.data?.type === 'REQUEST_SYNC') {
      pushSyncToPage();
    }
  });

  function pushSyncToPage() {
    chrome.storage.local.get(['token', 'userid'], (result) => {
      window.postMessage({ type: 'EXTENSION_SYNC', token: result.token || null, userid: result.userid || null }, '*');
    });
  }

  pushSyncToPage();
  setTimeout(pushSyncToPage, 500);
  setTimeout(pushSyncToPage, 1500);
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.token || changes.userid) pushSyncToPage();
  });
}

// ══════════════════════════════════════════════════════
// ── SECTION 2: Form Detection, Autofill & AI Engine ──
// ══════════════════════════════════════════════════════

if (!window.location.href.includes(WEB_HOST)) {

  const STYLE_ID = 'jobai-styles';
  let formDetected = false;
  let dismissed = false;   // per-page: set when user clicks ✕
  let barDisabled = false; // global: persistent off-switch from the popup toggle
  let floatingBar = null;
  let lastMatchData = null;

  // Load the persistent on/off setting, and react live when it's toggled in the popup.
  chrome.storage.local.get(['autofillBarDisabled'], (r) => {
    barDisabled = !!r.autofillBarDisabled;
    if (barDisabled) { removeFloatingBar(); formDetected = false; }
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autofillBarDisabled) {
      barDisabled = !!changes.autofillBarDisabled.newValue;
      if (barDisabled) { removeFloatingBar(); formDetected = false; }
      else { dismissed = false; detectForms(); }   // re-enable: allow it to show again
    }
  });

  // ── Inject global styles ──
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes jobai-slide-in { from { transform: translateY(80px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes jobai-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(53,37,205,0.4); } 50% { box-shadow: 0 0 0 6px rgba(53,37,205,0); } }
      /* CareerAI: filled = secondary teal, unfilled = tertiary amber */
      .jobai-filled { outline: 2px solid #00687a !important; outline-offset: -1px; background-color: #d7f7ff !important; }
      .jobai-unfilled { outline: 2px dashed #885500 !important; outline-offset: -1px; background-color: #fff4e2 !important; }
      .jobai-field-btn { position:absolute; right:4px; top:50%; transform:translateY(-50%); background:linear-gradient(135deg,#3525cd,#00687a); color:white; border:none; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; font-family:Inter,sans-serif; z-index:999999; opacity:0.9; }
      .jobai-field-btn:hover { opacity:1; transform:translateY(-50%) scale(1.05); }
      .jobai-ai-btn { display:inline-flex; align-items:center; gap:4px; margin-top:6px; padding:7px 14px; background:linear-gradient(135deg,#3525cd,#00687a); color:white; border:none; border-radius:10px; cursor:pointer; font-size:12px; font-weight:700; font-family:Inter,sans-serif; transition:all 0.2s; }
      .jobai-ai-btn:hover { transform:scale(1.03); box-shadow:0 4px 12px rgba(87,223,254,0.5); }
      .jobai-save-prompt { position:fixed; bottom:80px; right:20px; z-index:2147483647; background:#f8f9ff; border-radius:16px; padding:16px; box-shadow:0 8px 32px rgba(53,37,205,0.15); border:1px solid #c7c4d8; font-family:Inter,sans-serif; max-width:320px; animation:jobai-slide-in 0.3s ease; }
    `;
    document.head.appendChild(style);
  }

  // ── Form Scanning ──
  function scanForms() {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea');
    return Array.from(inputs)
      .filter(el => el.offsetParent !== null)
      .map(input => ({
        name: input.name,
        id: input.id,
        type: input.type,
        placeholder: input.placeholder,
        label: findLabel(input),
        tagName: input.tagName.toLowerCase(),
      }));
  }

  function findLabel(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent.trim();
    }
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent.replace(input.value, '').trim();
    if (input.getAttribute('aria-label')) return input.getAttribute('aria-label');
    return '';
  }

  // ── Autofill with visual feedback ──
  function autofillForms(data) {
    let filled = 0;
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    inputs.forEach(input => {
      const key = input.name || input.id;
      if (!key) return;

      if (data[key]) {
        input.value = data[key];
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.classList.remove('jobai-unfilled');
        input.classList.add('jobai-filled');
        setTimeout(() => input.classList.remove('jobai-filled'), 5000);
        filled++;
      } else {
        // Mark unfilled fields
        if (!input.value) {
          input.classList.add('jobai-unfilled');
          setTimeout(() => input.classList.remove('jobai-unfilled'), 5000);
        }
      }
    });
    return filled;
  }

  // ── Job site detection ──
  function isJobApplicationPage() {
    const url = window.location.href.toLowerCase();
    const jobSites = ['greenhouse.io', 'lever.co', 'workday.com', 'icims.com', 'ashbyhq.com',
      'smartrecruiters.com', 'myworkdayjobs.com', 'jobs.lever.co', 'boards.greenhouse.io',
      'linkedin.com/jobs', 'indeed.com', 'angel.co', 'wellfound.com', 'career', 'apply', 'application'];
    if (jobSites.some(site => url.includes(site))) return true;
    const text = document.title.toLowerCase() + ' ' + (document.querySelector('h1')?.textContent?.toLowerCase() || '');
    return ['apply', 'application', 'job', 'career', 'position', 'resume', 'cover letter'].some(kw => text.includes(kw));
  }

  // ── Floating Action Bar ──
  function detectForms() {
    const fields = scanForms();
    const hasForm = fields.length >= 3;
    const isJobPage = isJobApplicationPage();

    if (hasForm && !formDetected && !dismissed && !barDisabled) {
      formDetected = true;
      injectStyles();
      showFloatingBar(fields.length, isJobPage);
      chrome.runtime.sendMessage({ action: 'FORM_DETECTED', fieldCount: fields.length, isJobPage });
    } else if (!hasForm && formDetected) {
      formDetected = false;
      removeFloatingBar();
      chrome.runtime.sendMessage({ action: 'FORM_CLEARED' });
    }
  }

  function showFloatingBar(fieldCount, isJobPage) {
    if (floatingBar) return;
    floatingBar = document.createElement('div');
    floatingBar.id = 'jobai-floating-bar';
    floatingBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:linear-gradient(135deg,#3525cd,#00687a);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>
        <div>
          <div style="font-weight:700;font-size:13px;color:#0b1c30;font-family:Geist,Inter,sans-serif;">${isJobPage ? '🎯 Job Application Detected' : '📝 Form Detected'}</div>
          <div style="font-size:11px;color:#464555;" id="jobai-status-text">${fieldCount} fields found</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button id="jobai-autofill-btn" style="background:linear-gradient(135deg,#3525cd,#00687a);color:white;border:none;padding:8px 16px;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer;font-family:Geist,Inter,sans-serif;transition:all 0.2s;">✨ Autofill</button>
        <button id="jobai-dismiss-btn" style="background:#e5eeff;color:#464555;border:none;padding:8px 12px;border-radius:10px;font-weight:600;font-size:12px;cursor:pointer;font-family:Inter,sans-serif;">✕</button>
      </div>
    `;
    floatingBar.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;background:rgba(248,249,255,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:16px;padding:14px 18px;box-shadow:0 8px 32px rgba(53,37,205,0.15),0 2px 8px rgba(0,0,0,0.06);border:1px solid #c7c4d8;display:flex;align-items:center;justify-content:space-between;gap:16px;font-family:Inter,-apple-system,sans-serif;min-width:360px;animation:jobai-slide-in 0.4s cubic-bezier(0.16,1,0.3,1);';

    document.body.appendChild(floatingBar);

    document.getElementById('jobai-autofill-btn').addEventListener('click', triggerAutofill);
    document.getElementById('jobai-dismiss-btn').addEventListener('click', () => {
      removeFloatingBar();
      formDetected = false;
      dismissed = true;   // don't let the MutationObserver bring it back on this page
      chrome.runtime.sendMessage({ action: 'FORM_CLEARED' });
    });
  }

  function removeFloatingBar() {
    if (floatingBar) { floatingBar.remove(); floatingBar = null; }
  }

  function triggerAutofill() {
    const btn = document.getElementById('jobai-autofill-btn');
    const status = document.getElementById('jobai-status-text');
    if (btn) btn.textContent = '⏳ Filling...';

    const fieldDetails = scanForms();
    const fields = fieldDetails.map(f => f.name || f.id).filter(f => f);

    chrome.storage.local.get(['token', 'customFields'], (result) => {
      fetch(`${API_BASE}/api/ai/match-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${result.token}` },
        body: JSON.stringify({ fields, fieldDetails }),
      })
        .then(res => res.json())
        .then(data => {
          lastMatchData = data;

          // ── Adaptive learning payoff: fill gaps with values the user saved
          // on previous applications. Backend matches win; customFields only
          // fill fields the backend left empty (null/blank). ──
          const merged = { ...data.matchedData };
          const customFields = result.customFields || {};
          for (const [key, value] of Object.entries(customFields)) {
            if (!merged[key]) merged[key] = value;
          }

          const filled = autofillForms(merged);
          if (btn) {
            btn.textContent = `✅ ${filled}/${data.stats?.total || 0}`;
            setTimeout(() => { btn.textContent = '✨ Autofill'; }, 4000);
          }
          if (status) status.textContent = `${filled} filled, ${(data.stats?.total || 0) - filled} need attention`;
          // Start adaptive learning after fill
          setTimeout(startAdaptiveLearning, 2000);
        })
        .catch(() => {
          if (btn) { btn.textContent = '❌ Error'; setTimeout(() => { btn.textContent = '✨ Autofill'; }, 3000); }
        });
    });
  }

  // ══════════════════════════════════════
  // ── Point 7: Adaptive Learning ──
  // ══════════════════════════════════════

  function startAdaptiveLearning() {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');

    inputs.forEach(input => {
      if (input.dataset.jobaiTracked) return;
      input.dataset.jobaiTracked = 'true';

      // Track when user manually types in a field we couldn't fill
      input.addEventListener('blur', () => {
        const key = input.name || input.id;
        if (!key || !input.value.trim()) return;

        // Only prompt for fields the backend couldn't match AND that we haven't
        // already learned (avoid re-asking about a value already saved).
        if (lastMatchData?.matchedData && !lastMatchData.matchedData[key]) {
          chrome.storage.local.get(['customFields'], ({ customFields }) => {
            if (customFields && customFields[key]) return; // already learned
            showSavePrompt(key, input.value.trim(), findLabel(input));
          });
        }
      });
    });
  }

  function showSavePrompt(fieldKey, value, label) {
    // Don't show if already dismissed or a prompt is visible
    if (document.querySelector('.jobai-save-prompt')) return;

    const prompt = document.createElement('div');
    prompt.className = 'jobai-save-prompt';
    prompt.innerHTML = `
      <div style="font-weight:700;font-size:13px;color:#0b1c30;margin-bottom:8px;font-family:Geist,Inter,sans-serif;">💡 New Data Detected</div>
      <div style="font-size:12px;color:#464555;margin-bottom:12px;">
        You filled <b>"${label || fieldKey}"</b> with:<br>
        <span style="background:#dad7ff;padding:2px 8px;border-radius:6px;font-weight:600;color:#3525cd;display:inline-block;margin-top:4px;">${value.substring(0, 50)}${value.length > 50 ? '...' : ''}</span>
      </div>
      <div style="font-size:11px;color:#777587;margin-bottom:10px;">Save this to your profile for future autofills?</div>
      <div style="display:flex;gap:6px;">
        <button id="jobai-save-yes" style="flex:1;background:linear-gradient(135deg,#3525cd,#00687a);color:white;border:none;padding:8px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;">Save ✓</button>
        <button id="jobai-save-no" style="flex:1;background:#e5eeff;color:#464555;border:none;padding:8px;border-radius:8px;font-weight:600;font-size:12px;cursor:pointer;">Skip</button>
      </div>
    `;
    document.body.appendChild(prompt);

    document.getElementById('jobai-save-yes').addEventListener('click', () => {
      // Save to chrome.storage for future use
      chrome.storage.local.get(['customFields'], (result) => {
        const customFields = result.customFields || {};
        customFields[fieldKey] = value;
        chrome.storage.local.set({ customFields }, () => {
          prompt.innerHTML = '<div style="text-align:center;padding:8px;font-weight:700;color:#00687a;font-size:13px;">✅ Saved for future use!</div>';
          setTimeout(() => prompt.remove(), 1500);
        });
      });
    });

    document.getElementById('jobai-save-no').addEventListener('click', () => prompt.remove());
    setTimeout(() => { if (prompt.parentNode) prompt.remove(); }, 15000);
  }

  // ══════════════════════════════════════════
  // ── Point 8: AI Answer Generation ──
  // ══════════════════════════════════════════

  function injectAIAssistants() {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      if (textarea.dataset.jobaiAssisted) return;
      textarea.dataset.jobaiAssisted = 'true';

      // Find the question label
      const questionText = findLabel(textarea) || textarea.placeholder || textarea.previousElementSibling?.textContent?.trim() || '';
      if (!questionText) return;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';

      const btn = document.createElement('button');
      btn.className = 'jobai-ai-btn';
      btn.innerHTML = '✨ AI Suggest';

      const editBtn = document.createElement('button');
      editBtn.className = 'jobai-ai-btn';
      editBtn.style.background = '#f3f4f6';
      editBtn.style.color = '#374151';
      editBtn.innerHTML = '✏️ Edit';
      editBtn.style.display = 'none';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.innerHTML = '⏳ Generating...';
        btn.style.opacity = '0.7';

        chrome.runtime.sendMessage(
          { action: 'GENERATE_ANSWER', question: questionText },
          (response) => {
            btn.style.opacity = '1';
            if (response?.answer) {
              textarea.value = response.answer;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.classList.add('jobai-filled');
              setTimeout(() => textarea.classList.remove('jobai-filled'), 5000);
              btn.innerHTML = '✅ Generated';
              editBtn.style.display = 'inline-flex';
              setTimeout(() => { btn.innerHTML = '🔄 Regenerate'; }, 2000);
            } else {
              btn.innerHTML = '❌ Failed — Retry';
              setTimeout(() => { btn.innerHTML = '✨ AI Suggest'; }, 3000);
            }
          }
        );
      });

      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(editBtn);
      textarea.parentNode.insertBefore(wrapper, textarea.nextSibling);
    });
  }

  // ── Message listener for popup ──
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCAN_FORMS') {
      sendResponse({ fields: scanForms() });
    } else if (request.action === 'AUTOFILL') {
      const filled = autofillForms(request.data);
      sendResponse({ status: 'success', filled });
    }
    return true;
  });

  // ── Init ──
  window.addEventListener('load', () => {
    setTimeout(() => {
      detectForms();
      injectAIAssistants();
    }, 1500);
  });

  // Watch for dynamic content — debounced so we run AT MOST once per 300ms of
  // quiet, instead of on every single DOM mutation (which lags busy SPAs).
  let mutationTimer = null;
  const observer = new MutationObserver(() => {
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      detectForms();
      injectAIAssistants();
    }, 300);
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

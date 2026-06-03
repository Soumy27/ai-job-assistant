// Load shared config (API_BASE, WEB_BASE) into the service worker global scope.
importScripts('config.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Job Assistant Extension Installed');
  chrome.alarms.create('checkDeadlines', { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkDeadlines') {
    chrome.storage.local.get(['userid'], (result) => {
      if (result.userid) {
        chrome.notifications.create('deadline-notif-' + Date.now(), {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Upcoming Deadline!',
          message: 'Check your dashboard for application deadlines.',
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'OK' });

  } else if (request.action === 'FORM_DETECTED') {
    // Show badge when a form is detected on the page
    chrome.action.setBadgeText({ text: String(request.fieldCount), tabId: sender.tab?.id });
    chrome.action.setBadgeBackgroundColor({ color: request.isJobPage ? '#4285F4' : '#6366f1', tabId: sender.tab?.id });

  } else if (request.action === 'FORM_CLEARED') {
    // Clear badge when no form is present
    if (sender.tab?.id) chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });

  } else if (request.action === 'GENERATE_ANSWER') {
    chrome.storage.local.get(['token'], (result) => {
      fetch(`${API_BASE}/api/ai/generate-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.token}`,
        },
        body: JSON.stringify({
          question: request.question,
          jobTitle: request.jobTitle || 'Software Engineer',
          company: request.company || 'Company',
        }),
      })
        .then(res => res.json())
        .then(data => sendResponse({ answer: data.answer }))
        .catch(err => {
          console.error(err);
          sendResponse({ answer: 'Error generating answer. Try again.' });
        });
    });
    return true; // async response
  }
});

// Clear badge when tab is updated/navigated
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

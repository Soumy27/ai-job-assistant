// ──────────────────────────────────────────────────────────────
// Single source of truth for backend / frontend URLs.
//
// Loaded into all three extension contexts:
//   - content script  → via manifest content_scripts (before content.js)
//   - service worker  → via importScripts('config.js') in background.js
//   - popup           → via <script src="config.js"> in popup.html
//
// `var` (not const) is intentional: it attaches to the global object so the
// value is visible to the other script files loaded into the same world.
//
// These point at the deployed app, so the extension works for anyone who
// installs it. To develop against local servers, swap in the two commented
// lines below — and swap them back before you package a release.
// ──────────────────────────────────────────────────────────────

var API_BASE = 'https://ai-job-assistant-1-t9wj.onrender.com'; // Node/Express backend
var WEB_BASE = 'https://ai-job-assistant-omega.vercel.app';    // React dashboard

// Local development:
// var API_BASE = 'http://localhost:5005';
// var WEB_BASE = 'http://localhost:5173';

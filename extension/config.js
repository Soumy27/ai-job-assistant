// ──────────────────────────────────────────────────────────────
// Single source of truth for backend / frontend URLs.
// Change these TWO lines when you deploy — nothing else.
//
// Loaded into all three extension contexts:
//   - content script  → via manifest content_scripts (before content.js)
//   - service worker   → via importScripts('config.js') in background.js
//   - popup            → via <script src="config.js"> in popup.html
//
// `var` (not const) is intentional: it attaches to the global object so the
// value is visible to the other script files loaded into the same world.
// ──────────────────────────────────────────────────────────────
var API_BASE = 'http://localhost:5005';   // Node/Express backend
var WEB_BASE = 'http://localhost:5173';    // React dashboard

# 🤖 AI Job Application Assistant

A full-stack system that automates repetitive job-application work: a **Chrome extension** autofills application forms on any site, an **AI assistant** drafts answers to subjective questions, and a **Gmail integration** scans your inbox for interview invites and rejections — all backed by a **React dashboard** where you manage your profile and track applications.

> Built to learn (and demonstrate) end-to-end full-stack engineering: browser extensions, OAuth 2.0, LLM integration, JWT auth, and a SQL-backed API.

---

## 📸 Screenshots

| Dashboard | Gmail Job Tracker |
|-----------|-------------------|
| ![Dashboard](screenshots/dashboard.png) | ![Gmail scan](screenshots/gmail.png) |

| Login | Profile |
|-------|---------|
| ![Login](screenshots/login.png) | ![Profile](screenshots/profile.png) |

> Add the images to [`screenshots/`](screenshots/) (see that folder's README for the expected filenames).

---

## ✨ Features

- **Smart form autofill** — the extension detects application forms on any site and fills them from your saved profile, using a hybrid matcher: instant keyword rules first, then a Gemini LLM pass for fields the rules can't understand ("What should we call you?" → first name).
- **AI answer generation** — an inline "✨ AI Suggest" button near long-answer textareas drafts a professional, profile-aware response with Gemini.
- **Resume parsing** — upload a PDF; a hybrid regex + Gemini pass extracts your details into a structured profile you can review and edit.
- **Application tracking** — add and track applications (Saved → Applied → Interviewing → Offer/Rejected) with live stats, persisted in PostgreSQL.
- **Gmail job tracker** — connect Gmail (read-only OAuth) and scan recent mail, auto-classified into Interview Invite / Rejection / Offer / Application Received.
- **Cross-surface auth sync** — log in once; the extension and the web dashboard stay in sync via a content-script bridge.
- **Graceful degradation** — every AI feature falls back to a non-AI path (templates / regex / keyword rules), so the app works even with no API key.

---

## 🏗️ Architecture

```
┌──────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Chrome Extension │     │   Express Backend   │     │  React Dashboard │
│  (Manifest V3)    │◀───▶│   (Node.js, :5005)  │◀───▶│  (Vite, :5173)   │
│                   │HTTP │                     │HTTP │                  │
│ • content script  │     │ • JWT auth          │     │ • profile editor │
│   form autofill   │     │ • bcrypt passwords  │     │ • app tracker    │
│ • service worker  │     │ • field matching    │     │ • resume upload  │
│ • popup login     │     │ • Gmail OAuth flow   │     │ • Gmail scan UI  │
└──────────────────┘     └─────────┬──────────┘     └──────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       │  Neon PostgreSQL          │
                       │  Google Gemini (LLM)      │
                       │  Gmail API (read-only)    │
                       └──────────────────────────┘
```

| Layer | Tech |
|-------|------|
| Extension | Manifest V3, vanilla JS, content script + service worker |
| Frontend | React 19, React Router, Vite, Tailwind CSS |
| Backend | Node.js, Express, JWT, bcryptjs |
| Database | Neon (serverless PostgreSQL) |
| AI | Google Gemini (`gemini-2.0-flash`) |
| Integrations | Gmail API via OAuth 2.0 (`google-auth-library` + REST) |

---

## 🔧 Engineering decisions worth highlighting

- **Hybrid AI, not AI-everywhere.** Cheap keyword rules handle the obvious 80% of fields instantly and for free; the LLM is only called for the leftovers. The same pattern is used for resume parsing (regex baseline → LLM refine). This controls cost and latency without sacrificing quality.
- **Stateless JWT auth.** Passwords are hashed with bcrypt; sessions are carried entirely in signed tokens, so the API stays stateless. The server refuses to start without a `JWT_SECRET` (no insecure fallback).
- **Read-only, minimal-scope Gmail.** OAuth requests only `gmail.readonly`; the user id is carried through the OAuth `state` parameter (also a CSRF guard) so the browser-initiated callback can be attributed to the right user.
- **Lightweight Google integration.** Uses `google-auth-library` + the Gmail REST API via `fetch` instead of the giant `googleapis` meta-package (which can hang on load).
- **Defense against SQL injection** via parameterized queries throughout.
- **Cross-surface state sync** between the extension and the website through a content-script message bridge, with retries to avoid a load-order race condition.

---

## 🚀 Getting started

### Prerequisites
- Node.js 18+
- A free [Neon](https://neon.tech) PostgreSQL database
- (Optional) A free [Gemini API key](https://aistudio.google.com/apikey)
- (Optional) Google OAuth credentials for the Gmail feature

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env   # then fill in your values
node server.js
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Extension
1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder

---

## 📁 Project structure
```
backend/     Express API — auth, profile, resume, AI, applications, gmail
frontend/    React dashboard (Vite + Tailwind)
extension/   Manifest V3 Chrome extension (autofill + AI assist)
```

---

## 🗺️ Roadmap
- [ ] Input validation (zod) and rate limiting on AI/Gmail routes
- [ ] Deadline notifications tied to real application deadlines
- [ ] Automated tests for auth and application flows
- [ ] Production deployment (backend → Render, frontend → Vercel)
- [ ] Google app verification for public Gmail access

---

*Built as a full-stack learning project covering browser extensions, OAuth 2.0, LLM integration, and SQL-backed APIs.*

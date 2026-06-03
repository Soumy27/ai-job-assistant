# Development Notes & Lessons Learned

> Engineering decisions and bugs hit (and fixed) while building this project — kept
> as a reference so the same mistakes aren't repeated.

---

## 1. Missing `require` statements
**File:** `backend/routes/resume.js`
**Symptom:** `mongoose is not defined`
**Cause:** Referenced a module that was never imported at the top of the file.
**Lesson:** Every module used in a file must be `require()`'d at the top. Verify every referenced symbol is imported before saving.

---

## 2. Assuming an npm package's export shape
**File:** `backend/routes/resume.js`
**Symptom:** `pdfParse is not a function`
**Cause:** `pdf-parse` exports named members (e.g. `PDFParse`), not a default callable.
**Lesson:** Confirm how a package exports its API first: `node -e "console.log(typeof require('pkg'))"`.

---

## 3. Hardcoded user IDs across files
**Files:** `Profile.jsx`, `ResumeUpload.jsx`
**Symptom:** Profile data saved/loaded for the wrong user after login.
**Cause:** A hardcoded mock user id was used instead of the real one from `localStorage`.
**Lesson:** When wiring real auth, grep the whole codebase for hardcoded identity strings and replace them all.

---

## 4. Dead DOM references
**File:** `extension/popup.js`
**Symptom:** Null reference on load.
**Cause:** JS still referenced an element id that had been renamed in the HTML.
**Lesson:** When changing element ids, update every JS reference in the same change.

---

## 5. Port collisions on macOS
**Symptom:** Backend wouldn't start on port 5000.
**Cause:** macOS uses port 5000 for the AirPlay Receiver.
**Lesson:** Default to 5005+ on macOS. Check `lsof -i :<port>` when a server won't bind.

---

## 6. Using icon names that don't exist in the package
**File:** `Profile.jsx`
**Symptom:** White screen — build failed on a non-existent icon export.
**Cause:** Assumed an icon name existed in the icon library.
**Lesson:** Verify an icon exists before importing it, and run `vite build` after adding imports to catch missing exports early.

---

## 7. Sync-bridge race condition (extension ↔ web app)
**Files:** `content.js`, `App.jsx`
**Symptom:** Extension login didn't sync to the website.
**Cause:** The content script posted the sync message once before React had mounted its listener.
**Lesson:** For cross-surface state sync: retry the message a few times, support a `REQUEST_SYNC` pull, and listen to `chrome.storage.onChanged` for live updates.

---

## 8. Importing the giant `googleapis` meta-package
**File:** `backend/routes/gmail.js`
**Symptom:** Server never started — stuck before `app.listen`, no logs, port never bound.
**Cause:** `require('googleapis')` loads hundreds of APIs; its top-level require hung the boot.
**Lesson:** Don't pull the `googleapis` meta-package for one service. Use `google-auth-library` for OAuth2 + the service's REST API via `fetch`.

---

## 9. Heavy modules blocking server startup
**Files:** `db.js`, `routes/ai.js`, `routes/resume.js`
**Symptom:** On a low-memory machine, the server hung after loading `.env`, before binding the port.
**Cause:** Heavy libraries (`@neondatabase/serverless`, `@google/generative-ai`, `pdf-parse`) all loaded during the require chain.
**Lesson:** Lazy-load heavy/optional dependencies on first use so the server binds the port instantly and stays resilient on slow machines.

---

## General rules (derived from the above)
1. **Test after every change** — run the server and check for crashes before moving on.
2. **No dead references** — when renaming an element, update every file that references it.
3. **Grep for hardcoded values** before calling a task done.
4. **Verify imports** — every file imports what it uses.
5. **One task at a time** — finish and verify before starting the next.
6. **Centralize auth logic** in a single utility/middleware module.
7. **Test error paths** (wrong password, missing/expired token), not just the happy path.
8. **Lazy-load heavy deps** so startup stays fast.

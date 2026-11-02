#!/usr/bin/env python3
"""Generates the CareerAI complete tech-stack & project learning guide PDF."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, Flowable, KeepTogether)
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon, Group

# ── Palette (CareerAI design system) ──
PRIMARY   = HexColor("#3525cd")
SECONDARY = HexColor("#00687a")
INK       = HexColor("#0b1c30")
MUTED     = HexColor("#464555")
SURF_LOW  = HexColor("#eff4ff")
SURF_HI   = HexColor("#dce9ff")
TERT      = HexColor("#885500")
TERT_BG   = HexColor("#ffddb8")
LINE      = HexColor("#c7c4d8")
GREEN     = HexColor("#00687a")

styles = getSampleStyleSheet()
def S(name, **kw):
    styles.add(ParagraphStyle(name, parent=styles['Normal'], **kw))

S('H1', fontName='Helvetica-Bold', fontSize=20, textColor=PRIMARY, spaceBefore=18, spaceAfter=8, leading=24)
S('H2', fontName='Helvetica-Bold', fontSize=14, textColor=INK, spaceBefore=14, spaceAfter=5, leading=18)
S('H3', fontName='Helvetica-Bold', fontSize=11.5, textColor=SECONDARY, spaceBefore=9, spaceAfter=3, leading=15)
S('Body', fontName='Helvetica', fontSize=10, textColor=INK, leading=15, spaceAfter=6)
S('Small', fontName='Helvetica', fontSize=8.5, textColor=MUTED, leading=12)
S('Mono', fontName='Courier', fontSize=9, textColor=HexColor("#1a1a2e"), leading=13,
  backColor=SURF_LOW, borderPadding=4, spaceAfter=6)
S('CellH', fontName='Helvetica-Bold', fontSize=9, textColor=white, leading=11)
S('Cell', fontName='Helvetica', fontSize=8.7, textColor=INK, leading=11.5)
S('CellB', fontName='Helvetica-Bold', fontSize=8.7, textColor=PRIMARY, leading=11.5)
S('TitleBig', fontName='Helvetica-Bold', fontSize=30, textColor=PRIMARY, leading=36, alignment=TA_CENTER)
S('Sub', fontName='Helvetica', fontSize=12, textColor=MUTED, leading=18, alignment=TA_CENTER)

def P(t, s='Body'): return Paragraph(t, styles[s])

# ─────────────────────────────────────────────────────────────
# Diagram helpers (reportlab.graphics)
# ─────────────────────────────────────────────────────────────
def boxg(x, y, w, h, lines, fill, txt=white, fs=9, r=6):
    g = Group()
    g.add(Rect(x, y, w, h, rx=r, ry=r, fillColor=fill, strokeColor=None))
    n = len(lines)
    total = n * (fs + 3)
    cy = y + h/2 + total/2 - fs
    for i, (line, bold) in enumerate(lines):
        g.add(String(x + w/2, cy - i*(fs+3),
                     line, fontName='Helvetica-Bold' if bold else 'Helvetica',
                     fontSize=fs if bold else fs-0.5, fillColor=txt, textAnchor='middle'))
    return g

def arrow(x1, y1, x2, y2, col=MUTED, label=None, lw=1.4):
    g = Group()
    g.add(Line(x1, y1, x2, y2, strokeColor=col, strokeWidth=lw))
    import math
    ang = math.atan2(y2-y1, x2-x1); s = 5
    g.add(Polygon([x2, y2,
                   x2 - s*math.cos(ang-0.5), y2 - s*math.sin(ang-0.5),
                   x2 - s*math.cos(ang+0.5), y2 - s*math.sin(ang+0.5)],
                  fillColor=col, strokeColor=col))
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        g.add(String(mx, my+4, label, fontName='Helvetica', fontSize=7,
                     fillColor=col, textAnchor='middle'))
    return g

def architecture_diagram():
    d = Drawing(470, 250)
    # three top tiers
    d.add(boxg(10, 170, 130, 64, [("Chrome Extension", True), ("(Manifest V3)", False),
                                  ("autofills job forms", False)], PRIMARY))
    d.add(boxg(330, 170, 130, 64, [("React Dashboard", True), ("(Vite + Tailwind)", False),
                                   ("manage profile", False)], PRIMARY))
    d.add(boxg(170, 170, 130, 64, [("Backend API", True), ("(Node + Express)", False),
                                   ("the brain", False)], SECONDARY))
    # arrows extension<->backend, frontend<->backend
    d.add(arrow(140, 202, 168, 202, MUTED, "HTTP"))
    d.add(arrow(168, 192, 140, 192, MUTED))
    d.add(arrow(330, 202, 302, 202, MUTED, "HTTP"))
    d.add(arrow(302, 192, 330, 192, MUTED))
    # backend down to data layer
    d.add(arrow(235, 168, 235, 120, MUTED))
    d.add(boxg(120, 56, 230, 60, [("Neon PostgreSQL  •  Google Gemini  •  Gmail API", True),
                                  ("database, AI, and email integrations", False)], INK, fs=8.5))
    d.add(String(235, 14, "All secrets live ONLY in the backend — never in the browser code.",
                 fontName='Helvetica-Oblique', fontSize=8, fillColor=MUTED, textAnchor='middle'))
    return d

def flow_vertical(title_steps, w=470):
    """Vertical flowchart: list of (text, color) drawn as stacked boxes with down-arrows."""
    n = len(title_steps)
    bh, gap = 34, 20
    h = n*bh + (n-1)*gap + 10
    d = Drawing(w, h)
    bw = 360; x = (w-bw)/2
    for i,(text,col) in enumerate(title_steps):
        y = h - 5 - (i+1)*bh - i*gap
        d.add(boxg(x, y, bw, bh, [(text, False)], col, fs=8.6, r=5))
        if i < n-1:
            d.add(arrow(w/2, y-2, w/2, y-gap+3, MUTED))
    return d

def oauth_diagram():
    d = Drawing(470, 150)
    b = [("User", PRIMARY), ("CareerAI", SECONDARY), ("Google", INK), ("Backend", SECONDARY)]
    xs = [10, 130, 250, 370]; w=92
    for (lbl,col),x in zip(b,xs):
        d.add(boxg(x, 105, w, 34, [(lbl, True)], col, fs=9))
    d.add(arrow(102, 122, 130, 122, MUTED, "1 connect"))
    d.add(arrow(222, 122, 250, 122, MUTED, "2 consent"))
    d.add(arrow(342, 122, 370, 122, MUTED, "3 code"))
    d.add(String(235, 80, "4. Backend swaps the code (+ secret) for a refresh token and stores it.",
                 fontName='Helvetica', fontSize=8.5, fillColor=INK, textAnchor='middle'))
    d.add(String(235, 62, "5. Later, the refresh token fetches new access tokens to read Gmail (read-only).",
                 fontName='Helvetica', fontSize=8.5, fillColor=INK, textAnchor='middle'))
    d.add(String(235, 40, "OAuth 2.0 = a 'valet key': limited, revocable access without sharing your password.",
                 fontName='Helvetica-Oblique', fontSize=8.5, fillColor=MUTED, textAnchor='middle'))
    return d

def entity(x, top, w, title, cols, accent=PRIMARY):
    g = Group(); rowh = 13; h = 24 + len(cols)*rowh; bottom = top - h
    g.add(Rect(x, bottom, w, h, fillColor=white, strokeColor=LINE, strokeWidth=1))
    g.add(Rect(x, top-24, w, 24, fillColor=accent, strokeColor=None))
    g.add(String(x+8, top-16, title, fontName='Helvetica-Bold', fontSize=10, fillColor=white))
    for i,(c,note) in enumerate(cols):
        cy = top - 24 - (i+1)*rowh + 4
        g.add(String(x+8, cy, c, fontName='Helvetica', fontSize=8, fillColor=INK))
        if note:
            g.add(String(x+w-8, cy, note, fontName='Helvetica-Oblique', fontSize=7,
                         fillColor=MUTED, textAnchor='end'))
    return g, h

def db_schema_diagram():
    d = Drawing(470, 330)
    d.add(entity(20, 322, 185, "users", [
        ("id  (PK)", "serial"), ("user_id", "unique"), ("name", ""),
        ("email", "unique"), ("password", "bcrypt hash"),
        ("google_refresh_token", "Gmail"), ("created_at", ""),
    ], PRIMARY)[0])
    d.add(entity(270, 322, 185, "profiles", [
        ("id  (PK)", "serial"), ("user_id  (FK)", "to users"),
        ("first_name / last_name", ""), ("email / phone / location", ""),
        ("college / degree / cgpa", ""), ("skills / experience", ""),
        ("bio / parsed_resume_text", ""),
    ], SECONDARY)[0])
    d.add(entity(270, 150, 185, "applications", [
        ("id  (PK)", "serial"), ("user_id  (FK)", "to users"),
        ("company / role", ""), ("status", "Saved..Rejected"),
        ("source / job_url / deadline", ""), ("created_at", ""),
    ], TERT)[0])
    d.add(arrow(270, 300, 205, 300, MUTED, "user_id"))
    d.add(arrow(270, 120, 207, 250, MUTED, "user_id"))
    d.add(String(235, 6, "users 1-to-1 profiles, and users 1-to-many applications, linked by user_id.",
                 fontName='Helvetica-Oblique', fontSize=8, fillColor=MUTED, textAnchor='middle'))
    return d

# ─────────────────────────────────────────────────────────────
# Table helper
# ─────────────────────────────────────────────────────────────
def table(header, rows, colw, header_color=PRIMARY):
    data = [[P(h, 'CellH') for h in header]]
    for r in rows:
        data.append([P(c, 'Cell') for c in r])
    t = Table(data, colWidths=colw, repeatRows=1)
    st = [
        ('BACKGROUND', (0,0), (-1,0), header_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LINEBELOW', (0,0), (-1,-1), 0.4, LINE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, SURF_LOW]),
        ('BOX', (0,0), (-1,-1), 0.6, LINE),
    ]
    t.setStyle(TableStyle(st))
    return t

# ─────────────────────────────────────────────────────────────
# Build document
# ─────────────────────────────────────────────────────────────
story = []
def H1(t): story.append(P(t,'H1'))
def H2(t): story.append(P(t,'H2'))
def H3(t): story.append(P(t,'H3'))
def sp(h=6): story.append(Spacer(1,h))

# ---- COVER ----
story.append(Spacer(1, 150))
story.append(P("CareerAI", 'TitleBig'))
story.append(P("Complete Tech-Stack &amp; Project Guide", 'Sub'))
sp(10)
story.append(P("An AI-powered job-application assistant — browser extension, web dashboard, and API explained from the ground up.", 'Sub'))
sp(40)
story.append(P("Built by Soumy Dhiran", 'Sub'))
story.append(PageBreak())

# ---- 1. WHAT IS THIS ----
H1("1. What is this project?")
story.append(P("CareerAI helps you apply to jobs faster. It does three things: (1) a <b>Chrome extension</b> autofills application forms on any website, (2) an <b>AI assistant</b> drafts answers to subjective questions, and (3) a <b>Gmail integration</b> scans your inbox for interview invites and rejections. A <b>React dashboard</b> lets you manage your profile and track applications."))
sp(4)
story.append(P("It is built as <b>three programs that talk to each other</b> over HTTP. Think of it like a restaurant: the <b>clients</b> (extension + website) are customers placing orders; the <b>server</b> (backend) is the kitchen that cooks them; the <b>database/AI/Gmail</b> are the pantry and specialist chefs.", ))
sp(8)
story.append(architecture_diagram())
story.append(PageBreak())

# ---- 2. TECH STACK AT A GLANCE ----
H1("2. The Tech Stack at a Glance")
story.append(P("Every technology in the project and the single job it does. Each is explained in detail in Section 4."))
sp(4)
rows = [
 ["JavaScript", "Language", "The one language used everywhere — browser, server, extension.", "Whole project"],
 ["Node.js", "Runtime", "Runs JavaScript on the server (outside the browser).", "backend/"],
 ["Express.js", "Web framework", "Handles HTTP requests/responses and routing on the server.", "backend/app.js, routes/"],
 ["React 19", "UI library", "Builds the dashboard UI from reusable components.", "frontend/src/"],
 ["Vite", "Build tool / dev server", "Bundles the React app and serves it fast in development.", "frontend/"],
 ["Tailwind CSS v4", "Styling", "Utility classes + design tokens for the whole look.", "frontend/src/index.css"],
 ["React Router", "Routing", "Switches pages (Login/Dashboard/Profile) without reloads.", "frontend/src/App.jsx"],
 ["Chrome Ext (MV3)", "Browser extension", "Injects autofill UI into job sites; popup login.", "extension/"],
 ["Neon PostgreSQL", "Database (SQL)", "Stores users, profiles, applications on disk in the cloud.", "backend/db.js"],
 ["JWT", "Auth tokens", "Stateless 'wristband' that proves who is logged in.", "routes/auth.js, middleware/"],
 ["bcryptjs", "Password hashing", "One-way scrambles passwords so they're never stored raw.", "routes/auth.js"],
 ["zod", "Validation", "Rejects malformed requests before they hit the logic.", "middleware/validate.js"],
 ["express-rate-limit", "Security", "Caps requests to stop brute-force & runaway AI cost.", "middleware/rateLimit.js"],
 ["Google Gemini", "LLM (AI)", "Writes answers, maps fields, parses resumes.", "routes/ai.js, resume.js"],
 ["Gmail API + OAuth2", "Integration", "Read-only inbox scan for job emails, with consent.", "routes/gmail.js"],
 ["google-auth-library", "OAuth client", "Lightweight library for the Google OAuth flow.", "routes/gmail.js"],
 ["multer", "File uploads", "Receives the uploaded PDF resume in memory.", "routes/resume.js"],
 ["pdf-parse", "PDF text", "Extracts raw text from an uploaded PDF.", "routes/resume.js"],
 ["Render", "Hosting (backend)", "Runs the Node server in the cloud.", "render.yaml"],
 ["Vercel", "Hosting (frontend)", "Serves the built React site globally.", "frontend/vercel.json"],
 ["Git + GitHub", "Version control", "Tracks code history; source for deployment.", "whole repo"],
 ["node:test + supertest", "Testing", "Automated API tests with no network.", "backend/test/"],
]
story.append(table(["Technology","Type","What it does (its function)","Where used"], rows,
                   [70, 70, 235, 95]))
story.append(PageBreak())

# ---- 3. HOW IT WORKS (FLOWS) ----
H1("3. How it works — the key flows")
H2("3.1  Logging in (stateless JWT auth)")
story.append(flow_vertical([
 ("You type email + password on the Login page and click Sign in", PRIMARY),
 ("Frontend sends POST /api/auth/login to the backend", SECONDARY),
 ("Backend looks up the user, bcrypt-compares the password hash", SECONDARY),
 ("If correct, backend signs a JWT (a tamper-proof token) and returns it", SECONDARY),
 ("Frontend stores the JWT in localStorage", PRIMARY),
 ("Every later request sends the JWT in the Authorization header", PRIMARY),
 ("Middleware verifies the token — no password needed again", SECONDARY),
]))
story.append(PageBreak())

H2("3.2  Autofilling a job form (the extension)")
story.append(flow_vertical([
 ("You open a job application page; content.js scans the form fields", PRIMARY),
 ("You click the floating 'Autofill' button", PRIMARY),
 ("Extension sends the field names + your token to POST /api/ai/match-fields", SECONDARY),
 ("Backend matches fields to your profile: fast keyword rules first…", SECONDARY),
 ("…then Gemini AI for any tricky fields the rules missed (hybrid)", GREEN),
 ("Backend returns { fieldName: value } pairs", SECONDARY),
 ("content.js writes the values into the inputs (green = filled)", PRIMARY),
]))
sp(8)
H2("3.3  Connecting Gmail (OAuth 2.0)")
story.append(oauth_diagram())
story.append(PageBreak())

# ---- 4. DETAILED TECH ----
H1("4. Each technology, in detail")

def tech(name, what, why, how, files=None):
    H2(name)
    story.append(P("<b>What it is:</b> " + what))
    story.append(P("<b>Why we use it:</b> " + why))
    story.append(P("<b>How it's used here:</b> " + how))
    if files:
        story.append(P("<b>Key files:</b> " + files, 'Small'))
    sp(2)

tech("JavaScript",
 "The programming language of the web. The same language runs in the browser and (via Node.js) on the server.",
 "Using one language across all three parts means less context-switching and shared logic.",
 "All code — extension, frontend, backend — is JavaScript (with JSX for React).")
tech("Node.js",
 "A runtime that lets JavaScript run outside the browser, directly on a computer/server.",
 "It lets us build the backend server in JavaScript and use npm's huge package ecosystem.",
 "Runs the Express API. Started with <font face='Courier'>node server.js</font>. Uses async/await for non-blocking I/O (DB, network, AI calls).")
tech("Express.js",
 "A minimal web framework for Node that turns incoming HTTP requests into easy-to-handle 'routes'.",
 "It removes boilerplate: parsing JSON bodies, routing URLs, attaching middleware.",
 "app.js mounts routers like /api/auth, /api/profile, /api/applications, /api/gmail. Middleware (auth, validation, rate-limit, CORS, JSON parsing) runs in a pipeline before each route.",
 "backend/app.js, backend/routes/*.js, backend/middleware/*.js")
tech("React 19",
 "A library for building user interfaces out of reusable, self-contained 'components'.",
 "Components + state make complex, interactive UIs manageable and predictable.",
 "Pages (Login, Dashboard, Profile, ResumeUpload) are components. useState holds memory (e.g., the applications list); useEffect fetches data after render; props pass data down.",
 "frontend/src/pages/*.jsx, components/Layout.jsx")
tech("Vite",
 "A fast build tool and dev server for modern front-ends.",
 "Instant hot-reload in dev; produces a tiny optimized bundle for production.",
 "<font face='Courier'>npm run dev</font> serves the app locally; <font face='Courier'>npm run build</font> outputs static files to dist/ that Vercel hosts.",
 "frontend/vite.config.js")
tech("Tailwind CSS v4",
 "A utility-first CSS framework — you style with small classes like p-md, flex, text-primary.",
 "Fast, consistent styling without writing custom CSS files; a design system via tokens.",
 "We defined the CareerAI design tokens (colors, spacing, fonts, type scale) in @theme inside index.css, plus custom .glass-panel / .ai-gradient utilities. (Lesson learned: a custom --spacing-md token collided with max-w-md — fixed with max-w-[28rem].)",
 "frontend/src/index.css")
tech("Chrome Extension (Manifest V3)",
 "A small program that runs inside Chrome with three isolated 'worlds': a content script (inside web pages), a service worker (background), and a popup.",
 "It's the only way to read and fill forms on third-party job sites.",
 "content.js scans/fills forms and shows the floating bar; background.js (service worker) relays AI calls and shows notifications; popup.html/js is the login window; config.js centralizes the API URL. A 'sync bridge' copies the login token between the website's localStorage and the extension's chrome.storage.",
 "extension/manifest.json, content.js, background.js, popup.*, config.js")
tech("Neon PostgreSQL",
 "PostgreSQL is a relational SQL database (data in tables with strict columns). Neon hosts it serverlessly in the cloud.",
 "We need data to persist across restarts and be queryable; SQL is reliable and well-understood.",
 "db.js connects via a connection string (DATABASE_URL), creates users/profiles/applications tables, and uses parameterized queries (safe from SQL injection). The driver is lazy-loaded so the server boots fast.",
 "backend/db.js")
tech("JWT (JSON Web Token)",
 "A signed, tamper-proof token that encodes who you are. Like a concert wristband you flash instead of showing ID each time.",
 "It makes auth 'stateless' — the server stores no session; the token itself is the proof, so it scales.",
 "On login the backend signs a JWT with your id; the client sends it on every request; middleware verifies the signature. The server refuses to start without a JWT_SECRET.",
 "backend/routes/auth.js, backend/middleware/auth.js")
tech("bcryptjs",
 "A one-way password hashing function. You can scramble a password but never un-scramble it.",
 "If the database is ever stolen, attackers see gibberish, not real passwords.",
 "On register we store bcrypt.hash(password). On login we bcrypt.compare(typed, stored). The cost factor (10) controls how slow/secure the hash is.",
 "backend/routes/auth.js")
tech("zod + express-rate-limit",
 "zod validates the shape of incoming data; express-rate-limit caps how many requests an IP can make.",
 "Validation rejects bad input with a clean 400 before it crashes deeper code. Rate-limiting stops password brute-forcing and runaway AI/Gmail cost.",
 "validate(schema) middleware guards auth + applications routes; authLimiter (20/15min) and aiLimiter (15/min) guard /api/auth and /api/ai + /api/gmail.",
 "backend/middleware/validate.js, rateLimit.js")
tech("Google Gemini (LLM)",
 "A Large Language Model — software trained on huge text that writes human-like answers from a prompt you give it.",
 "It powers the 'intelligence': drafting answers, understanding unusual form fields, parsing resumes.",
 "We use a hybrid approach: cheap keyword rules first, then call Gemini only for the leftovers (controls cost + latency). Every AI feature gracefully falls back to a template/regex if no API key — the app never breaks. The free tier is enough for a demo.",
 "backend/routes/ai.js, backend/routes/resume.js")
tech("Gmail API + OAuth 2.0",
 "OAuth 2.0 is a 'valet key' system: the user grants your app limited, revocable access (here, read-only Gmail) without sharing their password. The Gmail API then reads messages.",
 "We need to read job emails on the user's behalf, securely and with explicit consent.",
 "We request the gmail.readonly scope, carry the user id through the OAuth 'state' parameter, exchange the returned code for a refresh token (stored per user), and use it to list + classify recent job emails. Uses the lightweight google-auth-library + Gmail REST (not the heavy googleapis meta-package, which hung the server).",
 "backend/routes/gmail.js")
tech("Render + Vercel (deployment)",
 "Render hosts the Node backend; Vercel hosts the built React frontend. Both deploy automatically from GitHub.",
 "They give a public URL with HTTPS for free, and redeploy on every git push.",
 "render.yaml configures the backend service + env vars; the frontend reads VITE_API_BASE to find the deployed backend; vercel.json adds SPA rewrites so client routes don't 404.",
 "render.yaml, frontend/vercel.json, DEPLOYMENT.md")
tech("Git + GitHub",
 "Git tracks every change to your code as 'commits' you can review or revert. GitHub stores the repo online.",
 "It's the history of the project and the source Render/Vercel deploy from. Essential for any real project.",
 "We init'd the repo, ignored secrets via .gitignore, committed, and pushed to GitHub. The .env file is never committed.",
 "whole repo")
story.append(PageBreak())

# ---- 5. COMMANDS ----
H1("5. Commands you used — and what they mean")
H2("5.1  npm &amp; Node (run the project)")
story.append(table(["Command","What it does","Why / when"], [
 ["npm install", "Downloads all dependencies from package.json into node_modules/.", "Run once after cloning, in backend/ and frontend/."],
 ["npm start", "Runs the 'start' script (node server.js) — boots the API.", "Start the backend (production-style)."],
 ["npm run dev", "Runs Vite's dev server with hot-reload.", "Start the frontend during development."],
 ["npm run build", "Bundles the React app into static files in dist/.", "Before deploying; Vercel runs it automatically."],
 ["npm test", "Runs 'node --test' — the automated API tests.", "Verify nothing broke."],
 ["node server.js", "Runs the server file directly with Node.", "What 'npm start' calls under the hood."],
 ["node --check file.js", "Checks a file for syntax errors without running it.", "Quick sanity check after editing."],
 ["node -e \"...\"", "Runs a one-line JS snippet.", "e.g. verify a package's export shape."],
], [120, 215, 135], header_color=SECONDARY))
sp(8)
H2("5.2  Git (version control)")
story.append(table(["Command","What it does","Why / when"], [
 ["git init -b main", "Creates a new repo with 'main' as the default branch.", "Once, to start tracking the project."],
 ["git status", "Shows changed/staged/untracked files.", "Constantly — to see what will be committed."],
 ["git add -A", "Stages ALL changes for the next commit.", "Before committing."],
 ["git commit -m \"msg\"", "Saves a snapshot of staged changes with a message.", "After each meaningful chunk of work."],
 ["git commit --amend", "Edits the most recent commit (message or contents).", "To fix the last commit before pushing."],
 ["git log --oneline", "Lists commits compactly.", "To review history."],
 ["git push origin main", "Uploads commits to GitHub's 'main' branch.", "To publish / trigger a deploy."],
 ["git push --force", "Overwrites remote history with your local history.", "After rewriting history (use carefully)."],
 ["git rm --cached -r dir", "Stops tracking files but keeps them locally.", "To remove accidentally-committed files."],
 [".gitignore", "Lists files Git should never track (e.g. .env, node_modules).", "Protects secrets and keeps the repo clean."],
], [130, 205, 135], header_color=PRIMARY))
sp(8)
H2("5.3  GitHub CLI (gh)")
story.append(table(["Command","What it does","Why / when"], [
 ["gh auth status", "Shows which GitHub account is logged in.", "Check you can push."],
 ["gh repo create &lt;name&gt; --public --source=. --push",
  "Creates a GitHub repo from the current folder and pushes it.", "Publish the project in one step."],
], [165, 175, 130], header_color=SECONDARY))
story.append(PageBreak())

# ---- 6. RUN LOCALLY ----
H1("6. Running the whole project locally")
H3("Step 1 — Backend")
story.append(P("cd backend &nbsp;→&nbsp; npm install &nbsp;→&nbsp; create a .env (JWT_SECRET, DATABASE_URL, GEMINI_API_KEY, GOOGLE_* ) &nbsp;→&nbsp; npm start", 'Mono'))
story.append(P("Wait for: <font face='Courier'>Server started on port 5005</font> and <font face='Courier'>Neon PostgreSQL connected</font>.", 'Small'))
H3("Step 2 — Frontend")
story.append(P("cd frontend &nbsp;→&nbsp; npm install &nbsp;→&nbsp; npm run dev &nbsp;→&nbsp; open http://localhost:5173", 'Mono'))
H3("Step 3 — Extension")
story.append(P("Chrome → chrome://extensions → enable Developer mode → Load unpacked → select the extension/ folder.", 'Mono'))
sp(8)
H2("The .env file (backend) — never commit this")
story.append(P("JWT_SECRET, DATABASE_URL, GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL — these are secrets/config the backend reads at startup. They live only on your machine (and the host's env vars in production).", 'Body'))
sp(8)

# ---- 7. DATABASE SCHEMA ----
H1("7. The database schema")
story.append(P("Data lives in three PostgreSQL tables. Every profile and application is linked to a user through the <b>user_id</b> column — this link is called a <b>foreign key</b> ('this row belongs to that user'). When the dashboard loads, the backend asks: 'give me all applications where user_id = me'."))
sp(6)
story.append(db_schema_diagram())
sp(4)
story.append(P("Why SQL tables (not just files): they persist on disk, enforce structure, and are fast to query/filter. We always use <b>parameterized queries</b> (values sent separately from the SQL command) so a malicious input can never be executed — that defends against <b>SQL injection</b>.", 'Small'))
story.append(PageBreak())

# ---- 8. CODE WALKTHROUGH ----
H1("8. Code walkthrough: how login works")
story.append(P("The clearest way to understand the stack is to trace one feature through the code. Here is <b>login</b>, from <font face='Courier'>backend/routes/auth.js</font> + <font face='Courier'>middleware/auth.js</font>."))

H3("a) The server refuses to run without a secret")
story.append(P("const JWT_SECRET = process.env.JWT_SECRET;<br/>if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET is not set');", 'Mono'))
story.append(P("Tokens are signed with this secret. If it were missing and we used a default, anyone could forge logins — so we crash loudly instead.", 'Small'))

H3("b) The login route")
story.append(P("router.post('/login', validate(loginSchema), async (req, res) =&gt; {<br/>&nbsp; const { email, password } = req.body;<br/>&nbsp; const user = await findUserByEmail(email);<br/>&nbsp; if (!user) return res.status(404).json({ error: 'Account not found' });<br/>&nbsp; const ok = await bcrypt.compare(password, user.password);<br/>&nbsp; if (!ok) return res.status(401).json({ error: 'Incorrect password' });<br/>&nbsp; const token = jwt.sign({ id: user.userId, email, name: user.name },<br/>&nbsp;&nbsp;&nbsp; JWT_SECRET, { expiresIn: '7d' });<br/>&nbsp; res.json({ token, userid: user.userId, name: user.name });<br/>});", 'Mono'))
story.append(P("Step by step: <b>validate(loginSchema)</b> runs first (middleware) and rejects bad input with 400. <b>findUserByEmail</b> reads from PostgreSQL. <b>bcrypt.compare</b> hashes the typed password and compares to the stored hash (the raw password is never stored). On success we <b>sign a JWT</b> that expires in 7 days and return it."))

H3("c) Protecting other routes")
story.append(P("const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);<br/>req.user = { id: decoded.id, name: decoded.name };<br/>return next();", 'Mono'))
story.append(P("Every protected route runs this <b>authMiddleware</b> first. It verifies the token's signature and attaches <b>req.user</b>, so the route knows who is calling — without ever seeing the password again. The user id always comes from the verified token, never from the request body — that's why one user can't read another's data.", 'Small'))
story.append(PageBreak())

# ---- 9. INTERVIEW Q&A ----
H1("9. Interview prep — likely questions")
qa = [
 ("Walk me through your project's architecture.",
  "Three parts over HTTP: a Manifest V3 Chrome extension (autofill + AI assist), a React/Vite/Tailwind dashboard, and a Node/Express API backed by PostgreSQL. Secrets live only in the backend; clients talk to it with a JWT."),
 ("How does authentication work?",
  "Stateless JWT. Passwords are hashed with bcrypt; on login the backend signs a token the client stores and sends on every request. Middleware verifies it — no server-side session, so it scales."),
 ("How do you keep the AI cost and latency under control?",
  "A hybrid approach: cheap keyword rules handle ~80% of field matching instantly and free; Gemini is called only for the leftovers. Every AI feature also falls back to a template/regex if the API is unavailable, so the app never breaks."),
 ("How did you integrate Gmail securely?",
  "OAuth 2.0 with the read-only gmail.readonly scope. The user grants consent on Google; the backend exchanges the code for a refresh token (stored per user) and uses it to read job emails. The user id is carried in the OAuth 'state' parameter, which also guards against CSRF."),
 ("What was a hard bug you solved?",
  "The server hung on startup with no error. I bisected the require() chain by timing each dependency and found the giant 'googleapis' meta-package was hanging on load. I switched to the lightweight google-auth-library + Gmail REST, and lazy-loaded other heavy modules so the server binds the port instantly."),
 ("How do you prevent common web vulnerabilities?",
  "Parameterized SQL queries (no injection), bcrypt-hashed passwords, JWT with a required secret, zod input validation, and express-rate-limit on auth and AI routes to stop brute-force and runaway cost. Secrets stay in .env (git-ignored)."),
 ("How is the extension synced with the website login?",
  "A content-script 'bridge': the website and extension have separate storage, so the content script (which runs in both worlds) copies the token between them, with retries and a REQUEST_SYNC handshake to avoid a load-order race condition."),
 ("How is it deployed?",
  "Backend on Render, frontend on Vercel, both auto-deploying from GitHub. The frontend reads VITE_API_BASE to find the backend; a vercel.json rewrite makes client-side routing work."),
]
for q,a in qa:
    story.append(P("Q: " + q, 'H3'))
    story.append(P("A: " + a, 'Body'))
story.append(PageBreak())

# ---- 10. GLOSSARY ----
H1("10. Glossary of key terms")
story.append(table(["Term","Meaning"], [
 ["Client / Server", "Client asks (extension, website); server answers (backend)."],
 ["HTTP request/response", "The order slip and the plate: method (GET/POST), URL, headers, body, status code."],
 ["API / endpoint", "One action the server can do, at a URL (e.g. POST /api/auth/login)."],
 ["Middleware", "Code that runs on every request before the route — like security guards in a pipeline."],
 ["Async / await", "Lets code wait for slow things (DB, network) without freezing everything else."],
 ["State (React)", "A component's memory; changing it re-draws the screen."],
 ["DOM", "The tree of elements that makes up a web page; the extension reads/edits it."],
 ["Environment variable", "A config value (often secret) read from the environment, not hard-coded."],
 ["Hashing", "One-way scrambling (bcrypt) — can't be reversed."],
 ["Token (JWT)", "A signed proof of identity sent with each request."],
 ["OAuth scope", "The exact permission granted (here: read-only Gmail)."],
 ["SQL injection", "An attack via malicious input; prevented by parameterized queries."],
 ["Lazy loading", "Loading a heavy module only when first needed, so startup stays fast."],
 ["SPA rewrite", "Server rule that serves index.html for all routes so client routing works."],
], [120, 350], header_color=INK)
)
sp(10)
story.append(P("This guide documents the CareerAI project end-to-end. Keep it as a reference while you learn — every concept here maps to a real file you can open and read.", 'Small'))

# Footer with page numbers
def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20*mm, 12*mm, "CareerAI — Tech-Stack & Project Guide")
    canvas.drawRightString(190*mm, 12*mm, "Page %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.line(20*mm, 15*mm, 190*mm, 15*mm)
    canvas.restoreState()

doc = SimpleDocTemplate("/Users/soumydhiran/Desktop/extension/docs/CareerAI-Tech-Guide.pdf",
                        pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                        topMargin=18*mm, bottomMargin=20*mm,
                        title="CareerAI - Tech-Stack & Project Guide", author="Soumy Dhiran")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("PDF written")

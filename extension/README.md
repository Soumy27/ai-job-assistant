# CareerAI browser extension

Autofills job application forms from your CareerAI profile, and drafts answers
to the written questions ("Why do you want to work here?").

It talks to the deployed app, so it works as soon as you install it — there is
nothing to run locally.

## Install

Chrome, Edge, Brave or any Chromium browser:

1. Download `careerai-extension.zip` and unzip it, **or** clone this repo and
   use the `extension/` folder directly.
2. Open `chrome://extensions` (Brave: `brave://extensions`).
3. Turn on **Developer mode**, top right.
4. Click **Load unpacked** and choose the unzipped folder — the one holding
   `manifest.json`.
5. Pin the CareerAI icon to your toolbar.

> Loading unpacked is the normal route until the extension is published to the
> Chrome Web Store, which costs a one-time $5 developer fee.

## Use it

1. Create an account at
   [ai-job-assistant-omega.vercel.app](https://ai-job-assistant-omega.vercel.app)
   and fill in your profile — or upload a PDF resume and let it fill the profile
   for you.
2. Click the extension icon and sign in with the same account. The dashboard and
   the extension stay signed in together.
3. Open any job application form. The extension detects the fields and offers to
   fill them from your profile.
4. Next to a long-answer box, use **AI Suggest** to draft a response from your
   profile. Read it before you submit it.

## What it can see

- `host_permissions: *://*/*` — the autofill has to run on whatever careers site
  you are on, and those live on every domain. The content script only reads form
  fields on the page you have open.
- Your profile is fetched from the CareerAI backend with your own token. The
  extension stores that token in `chrome.storage.local`.
- No page content is sent anywhere except the question text you explicitly ask
  it to answer.

## Developing against local servers

Point `config.js` at localhost (the lines are commented at the bottom of the
file), then reload the extension at `chrome://extensions`:

```js
var API_BASE = 'http://localhost:5005';
var WEB_BASE = 'http://localhost:5173';
```

Swap them back before packaging a release, or the installed extension will try
to reach a server on the user's own machine.

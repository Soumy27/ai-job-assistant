import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Privacy policy and terms, served publicly at /privacy and /terms.
 *
 * Google requires both to be reachable without signing in before an OAuth
 * consent screen using a restricted scope (gmail.readonly) can be published.
 * The Limited Use paragraph in the privacy policy is specifically required by
 * the Google API Services User Data Policy.
 *
 * Everything here describes what the code actually does. If the data the app
 * stores or sends changes, this has to change with it.
 */

const UPDATED = '3 November 2026';
const CONTACT = 'saumydhiran347@gmail.com';

function Page({ title, children }) {
  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-4 py-4">
          <Link to="/" className="text-section font-semibold tracking-tight">CareerAI</Link>
          <nav className="flex gap-4 text-body text-muted">
            <Link to="/privacy" className="hover:text-text">Privacy</Link>
            <Link to="/terms" className="hover:text-text">Terms</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-4 py-10">
        <h1 className="text-title tracking-tight">{title}</h1>
        <p className="mt-1 text-body text-muted">Last updated {UPDATED}</p>
        <div className="mt-8 flex flex-col gap-7">{children}</div>
      </main>
    </div>
  );
}

function Section({ heading, children }) {
  return (
    <section>
      <h2 className="text-section">{heading}</h2>
      <div className="mt-2 flex flex-col gap-3 text-body text-muted">{children}</div>
    </section>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy policy">
      <Section heading="What this is">
        <p>
          CareerAI is a personal job-application tracker. It stores the profile you enter, the
          applications you track, and — if you choose to connect it — reads your Gmail to spot
          replies from employers. This policy describes exactly what it keeps and what it sends
          elsewhere.
        </p>
      </Section>

      <Section heading="What is stored">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Your name, email address, and a hashed password. Passwords are hashed with bcrypt and are never stored or readable in plain text.</li>
          <li>Profile details you enter or import from a resume: contact details, education, skills, work history, and a written summary.</li>
          <li>The text extracted from any resume PDF you upload. The PDF itself is not kept — only the text.</li>
          <li>The applications you track: company, role, stage, and when you added them.</li>
          <li>If you connect Gmail, a Google refresh token, so scanning works without signing in each time.</li>
        </ul>
        <p>Data is held in a PostgreSQL database hosted by Neon.</p>
      </Section>

      <Section heading="Gmail data">
        <p>
          Connecting Gmail is optional and the app works fully without it. The app requests one
          permission, <code className="font-mono text-small">gmail.readonly</code>, which is
          read-only: it can never send, delete, or alter your mail.
        </p>
        <p>
          A scan reads the <strong className="font-medium text-text">subject, sender, date and
          preview snippet</strong> of messages from the last 30 days that match job-related terms.
          It does not open message bodies or attachments. Results are classified (interview invite,
          rejection, offer, and so on) and shown to you.
        </p>
        <p>
          <strong className="font-medium text-text">Your emails are not stored.</strong> Scan results
          are returned to your browser and are gone when you reload. The only Gmail-related item kept
          is the refresh token itself.
        </p>
        <p>
          Gmail content is never used for advertising, never sold, never shared with third parties,
          and never used to train any machine-learning model. Email text is not sent to the AI
          features described below.
        </p>
      </Section>

      <Section heading="Limited use disclosure">
        <p>
          CareerAI's use and transfer of information received from Google APIs to any other app
          adheres to the{' '}
          <a
            className="text-text underline underline-offset-2"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </Section>

      <Section heading="Where data is sent">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li><strong className="font-medium text-text">Google Gemini</strong> — when you upload a resume, its text is sent to Google's Gemini API to extract structured fields and write a summary. When you use AI Suggest on an application form, the question and relevant profile details are sent. Nothing else is sent, and Gmail content never is.</li>
          <li><strong className="font-medium text-text">Neon</strong> — database hosting.</li>
          <li><strong className="font-medium text-text">Render</strong> and <strong className="font-medium text-text">Vercel</strong> — application hosting.</li>
        </ul>
        <p>Your data is not sold, rented, or shared with anyone else.</p>
      </Section>

      <Section heading="The browser extension">
        <p>
          The optional extension reads form fields on pages you visit so it can fill them from your
          profile. It does not read or transmit page content beyond the fields it fills and any
          question you explicitly ask it to answer. It holds your sign-in token in the browser's own
          extension storage.
        </p>
      </Section>

      <Section heading="Disconnecting and deleting">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Revoke Gmail access at any time at <a className="text-text underline underline-offset-2" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>. The stored refresh token stops working immediately.</li>
          <li>Edit or clear any profile field from the Profile page.</li>
          <li>To delete your account and everything attached to it, email {CONTACT} and it will be removed.</li>
        </ul>
      </Section>

      <Section heading="Honest limitations">
        <p>
          This is a personal project, not a company. There is no dedicated security team and no
          formal certification. Passwords are hashed and traffic is encrypted in transit, but you
          should not store anything here you would be unwilling to lose. The service may change or
          stop at any time.
        </p>
      </Section>

      <Section heading="Contact">
        <p>Questions, or to have your data deleted: {CONTACT}</p>
      </Section>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of service">
      <Section heading="Using CareerAI">
        <p>
          CareerAI is offered free, as a personal project. By creating an account you agree to these
          terms. If you do not, please do not use it.
        </p>
      </Section>

      <Section heading="Your account">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Give accurate details and keep your password to yourself.</li>
          <li>You are responsible for what happens under your account.</li>
          <li>One person per account. Do not share logins.</li>
        </ul>
      </Section>

      <Section heading="Acceptable use">
        <p>Do not use CareerAI to:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Submit applications containing information you know to be false.</li>
          <li>Access an account or mailbox that is not yours.</li>
          <li>Send automated bulk applications, or anything a site's own terms forbid.</li>
          <li>Attack, overload, or probe the service or its infrastructure.</li>
        </ul>
      </Section>

      <Section heading="AI-written content">
        <p>
          Draft answers and resume summaries are generated by a language model. They can be wrong,
          generic, or subtly misleading. <strong className="font-medium text-text">Read anything it
          writes before you send it to an employer.</strong> What you submit is your responsibility,
          not the tool's.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          The service runs on free hosting tiers. It may be slow after a period of inactivity, may go
          down without notice, and may be discontinued. There is no uptime guarantee and no support
          commitment. Keep your own copy of anything that matters — particularly your resume.
        </p>
      </Section>

      <Section heading="No warranty, limited liability">
        <p>
          CareerAI is provided "as is", without warranty of any kind. To the extent the law allows,
          the author is not liable for lost data, missed opportunities, or any damages arising from
          using it or being unable to use it.
        </p>
      </Section>

      <Section heading="Ending it">
        <p>
          Stop using it whenever you like, and email {CONTACT} to have your account deleted. Accounts
          that break these terms may be removed.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          These terms may change. The date at the top shows the last revision. Continuing to use the
          service after a change means you accept it.
        </p>
      </Section>

      <Section heading="Contact">
        <p>{CONTACT}</p>
      </Section>
    </Page>
  );
}

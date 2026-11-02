/**
 * Minimal transactional mail, over Resend's HTTP API.
 *
 * Deliberately no nodemailer: one fetch call does the job and the server has
 * no SMTP dependency to install, keep patched, or slow startup with.
 *
 * Configure with:
 *   RESEND_API_KEY  — from resend.com
 *   MAIL_FROM       — e.g. "CareerAI <noreply@yourdomain.com>"
 *
 * Until a domain is verified at Resend you can only send to your own address.
 * With no key set, mail is not sent: send() reports that honestly and the
 * reset link is written to the server log so a solo operator is never locked
 * out of their own app.
 */

function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/**
 * @returns {Promise<{sent: boolean, reason?: string}>} never throws — a failed
 * email must not turn into a 500 that tells an attacker the address exists.
 */
async function send({ to, subject, text, html }) {
  if (!mailConfigured()) {
    console.warn(
      `[mailer] RESEND_API_KEY/MAIL_FROM not set — no email sent to ${to}. Message follows:\n${text}`
    );
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html }),
    });

    if (!res.ok) {
      // Log the body — Resend explains refusals (unverified domain, bad key).
      console.error(`[mailer] Resend rejected the send (${res.status}): ${await res.text()}`);
      return { sent: false, reason: 'provider_error' };
    }
    return { sent: true };
  } catch (err) {
    console.error('[mailer] Could not reach Resend:', err.message);
    return { sent: false, reason: 'network_error' };
  }
}

function passwordResetEmail(name, link) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const text = `${greeting}

Someone asked to reset the password on your CareerAI account. Open this link to choose a new one:

${link}

The link works once and expires in 60 minutes.

If this wasn't you, ignore this email — your password has not changed.`;

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:20px;color:#0a0a0a">
  <p>${greeting}</p>
  <p>Someone asked to reset the password on your CareerAI account. Choose a new one here:</p>
  <p><a href="${link}" style="display:inline-block;background:#141414;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Reset your password</a></p>
  <p style="color:#6b6b6b">The link works once and expires in 60 minutes.</p>
  <p style="color:#6b6b6b">If this wasn't you, ignore this email — your password has not changed.</p>
</div>`;

  return { subject: 'Reset your CareerAI password', text, html };
}

module.exports = { send, mailConfigured, passwordResetEmail };

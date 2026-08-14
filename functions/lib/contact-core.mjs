/**
 * Contact-form handling, independent of any host.
 *
 * The Netlify function in functions/contact.mjs is a thin adapter over this;
 * DEPLOY.md shows the equivalent Cloudflare Workers adapter. Keeping the logic
 * here means switching host does not mean rewriting validation.
 *
 * Validation runs here regardless of what the browser did — client-side checks
 * are a convenience, not a control.
 */

export const LOCALES = ['fr', 'en', 'de', 'it'];
const DEFAULT_LOCALE = 'fr';

const LIMITS = {
  firstName: 80,
  lastName: 80,
  email: 254,
  phone: 40,
  profile: 120,
  subject: 160,
  message: 5000,
};

/** Minimum seconds a genuine visitor needs to fill the form. */
const MIN_FILL_SECONDS = 3;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s./-]{6,40}$/;

/** Strip CR/LF so a field can never inject extra mail headers. */
const singleLine = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

export function normaliseLocale(value) {
  const locale = String(value ?? '').toLowerCase();
  return LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

/**
 * @returns {{ok: true, data: object} | {ok: false, fields?: string[], reason?: string}}
 */
export function validate(form) {
  const get = (name) => singleLine(form.get(name));

  // Honeypot: a real browser leaves this empty because it is off-screen and
  // not focusable.
  if (get('website_url')) return { ok: false, reason: 'spam' };

  // Timing. The field is stamped by JavaScript on page load, so it is absent
  // for visitors without JavaScript — those fall back to the honeypot alone
  // rather than being locked out. A stale stamp (cached page left open) is
  // fine; only implausibly fast submissions are rejected.
  const renderedAt = Number(form.get('rendered_at'));
  if (Number.isFinite(renderedAt) && renderedAt > 0) {
    const elapsed = (Date.now() - renderedAt) / 1000;
    if (elapsed >= 0 && elapsed < MIN_FILL_SECONDS) return { ok: false, reason: 'tooFast' };
  }

  const data = {
    locale: normaliseLocale(form.get('locale')),
    firstName: get('firstName'),
    lastName: get('lastName'),
    email: get('email'),
    phone: get('phone'),
    profile: get('profile'),
    subject: get('subject'),
    // The message keeps its line breaks; only trimmed.
    message: String(form.get('message') ?? '').trim(),
    consent: Boolean(form.get('consent')),
  };

  const fields = [];
  for (const name of ['firstName', 'lastName', 'profile', 'subject', 'message']) {
    if (!data[name]) fields.push(name);
    else if (data[name].length > LIMITS[name]) fields.push(name);
  }
  if (!EMAIL_RE.test(data.email) || data.email.length > LIMITS.email) fields.push('email');
  if (data.phone && !PHONE_RE.test(data.phone)) fields.push('phone');
  if (!data.consent) fields.push('consent');

  if (fields.length) return { ok: false, fields };
  return { ok: true, data };
}

/** Plain-text body. No HTML mail — nothing here needs it. */
export function renderEmail(data) {
  return [
    `Name:         ${data.firstName} ${data.lastName}`,
    `Email:        ${data.email}`,
    `Phone:        ${data.phone || '—'}`,
    `Profile:      ${data.profile}`,
    `Subject:      ${data.subject}`,
    `Site language: ${data.locale}`,
    '',
    '---',
    '',
    data.message,
    '',
    '---',
    'Sent from the MHSV® website contact form.',
  ].join('\n');
}

/**
 * Send via the configured transport.
 *
 * "log" writes the payload to the function log instead of sending, so the whole
 * pipeline can be exercised before the mailbox exists (BLOCKERS.md #2).
 */
export async function send(data, env) {
  const recipient = env.CONTACT_RECIPIENT;
  const sender = env.CONTACT_SENDER;
  const transport = (env.CONTACT_TRANSPORT || 'log').toLowerCase();

  if (!recipient) throw new Error('CONTACT_RECIPIENT is not configured');

  const subject = `[MHSV® ${data.locale.toUpperCase()}] ${data.subject}`;
  const text = renderEmail(data);

  if (transport === 'log') {
    console.log('[contact] transport=log — not sent\n', { to: recipient, subject, text });
    return;
  }

  if (transport === 'resend') {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        reply_to: data.email,
        subject,
        text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
    }
    return;
  }

  if (transport === 'smtp') {
    // Imported lazily so hosts using Resend never pull nodemailer into the
    // function bundle.
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(env.SMTP_PORT || 587);
    const mailer = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    await mailer.sendMail({ from: sender, to: recipient, replyTo: data.email, subject, text });
    return;
  }

  throw new Error(`Unknown CONTACT_TRANSPORT "${transport}"`);
}

/**
 * Handle a POST.
 *
 * Returns JSON when the client asked for it (the enhanced path), otherwise a
 * 303 to a static result page so the form still works without JavaScript.
 */
export async function handleContact(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  let form;
  try {
    form = await request.formData();
  } catch {
    return respond(wantsJson, DEFAULT_LOCALE, { ok: false, reason: 'server' }, 400);
  }

  const result = validate(form);
  const locale = normaliseLocale(form.get('locale'));

  if (!result.ok) {
    // A caught spam attempt gets the same 200 + success shape a human sees, so
    // a bot learns nothing from probing. Nothing is sent.
    if (result.reason === 'spam') {
      console.warn('[contact] honeypot triggered — discarded');
      return respond(wantsJson, locale, { ok: true }, 200);
    }
    return respond(wantsJson, locale, result, 422);
  }

  try {
    await send(result.data, env);
  } catch (error) {
    console.error('[contact] send failed:', error);
    return respond(wantsJson, locale, { ok: false, reason: 'server' }, 502);
  }

  return respond(wantsJson, locale, { ok: true }, 200);
}

function respond(wantsJson, locale, payload, status) {
  if (wantsJson) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  const page = payload.ok ? 'message-sent' : 'message-error';
  return new Response(null, {
    status: 303,
    headers: { Location: `/${locale}/${page}/` },
  });
}

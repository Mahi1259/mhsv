/**
 * Form handling for all three MHSV® forms, independent of any host.
 *
 *   contact      general enquiries        -> email to CONTACT_RECIPIENT
 *   book-order   Founding Book request    -> email to CONTACT_RECIPIENT
 *   newsletter   subscription             -> mailing provider, double opt-in
 *
 * The Vercel function in api/contact.mjs and the Netlify one in
 * functions/contact.mjs are thin adapters over this. Keeping the logic here
 * means switching host does not mean rewriting validation.
 *
 * Validation always runs here regardless of what the browser did - client-side
 * checks are a convenience, not a control.
 *
 * The recipient is never hard-coded: it comes from CONTACT_RECIPIENT.
 */

export const LOCALES = ['fr', 'en', 'de', 'it'];
const DEFAULT_LOCALE = 'fr';

export const FORM_KINDS = ['contact', 'book-order', 'newsletter'];

const LIMITS = {
  firstName: 80,
  lastName: 80,
  email: 254,
  phone: 40,
  profile: 120,
  subject: 160,
  message: 5000,
  organisation: 160,
  country: 80,
};

/** Minimum seconds a genuine visitor needs to fill a form. */
const MIN_FILL_SECONDS = 3;
const MAX_QUANTITY = 500;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s./-]{6,40}$/;

/** Strip CR/LF so a field can never inject extra mail headers. */
const singleLine = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

export function normaliseLocale(value) {
  const locale = String(value ?? '').toLowerCase();
  return LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

function normaliseKind(value) {
  const kind = String(value ?? 'contact').toLowerCase();
  return FORM_KINDS.includes(kind) ? kind : 'contact';
}

/**
 * Shared gate: honeypot and timing.
 *
 * The timing field is stamped by JavaScript on page load, so it is absent for
 * visitors without JavaScript - those fall back to the honeypot alone rather
 * than being locked out. A stale stamp (a page left open) is fine; only
 * implausibly fast submissions are rejected.
 */
function screenForBots(form) {
  if (singleLine(form.get('website_url'))) return 'spam';

  const renderedAt = Number(form.get('rendered_at'));
  if (Number.isFinite(renderedAt) && renderedAt > 0) {
    const elapsed = (Date.now() - renderedAt) / 1000;
    if (elapsed >= 0 && elapsed < MIN_FILL_SECONDS) return 'tooFast';
  }
  return null;
}

/**
 * @returns {{ok: true, kind: string, data: object} | {ok: false, fields?: string[], reason?: string}}
 */
export function validate(form) {
  const bot = screenForBots(form);
  if (bot) return { ok: false, reason: bot };

  const kind = normaliseKind(form.get('form'));
  const get = (name) => singleLine(form.get(name));
  const locale = normaliseLocale(form.get('locale'));
  const email = get('email');
  const fields = [];

  const requireText = (name) => {
    const value = get(name);
    if (!value || value.length > LIMITS[name]) fields.push(name);
    return value;
  };

  if (!EMAIL_RE.test(email) || email.length > LIMITS.email) fields.push('email');
  // Consent is required on every form and is never pre-ticked in the markup.
  const consent = Boolean(form.get('consent'));
  if (!consent) fields.push('consent');

  if (kind === 'contact') {
    const data = {
      kind,
      locale,
      email,
      consent,
      firstName: requireText('firstName'),
      lastName: requireText('lastName'),
      profile: requireText('profile'),
      subject: requireText('subject'),
      phone: get('phone'),
      message: String(form.get('message') ?? '').trim(),
    };
    if (!data.message || data.message.length > LIMITS.message) fields.push('message');
    if (data.phone && !PHONE_RE.test(data.phone)) fields.push('phone');
    return fields.length ? { ok: false, fields } : { ok: true, kind, data };
  }

  if (kind === 'book-order') {
    const edition = get('edition');
    const quantity = Number(form.get('quantity'));
    const data = {
      kind,
      locale,
      email,
      consent,
      edition,
      quantity,
      firstName: requireText('firstName'),
      lastName: requireText('lastName'),
      organisation: requireText('organisation'),
      country: requireText('country'),
      phone: get('phone'),
      message: String(form.get('message') ?? '').trim(),
    };
    if (!['fr', 'en'].includes(edition)) fields.push('edition');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      fields.push('quantity');
    }
    if (data.phone && !PHONE_RE.test(data.phone)) fields.push('phone');
    if (data.message.length > LIMITS.message) fields.push('message');
    return fields.length ? { ok: false, fields } : { ok: true, kind, data };
  }

  // newsletter - deliberately minimal: we store only what is needed to send it.
  const language = get('language');
  const data = {
    kind,
    locale,
    email,
    consent,
    firstName: get('firstName'),
    language,
  };
  if (!LOCALES.includes(language)) fields.push('language');
  if (data.firstName.length > LIMITS.firstName) fields.push('firstName');
  return fields.length ? { ok: false, fields } : { ok: true, kind, data };
}

/** Plain-text body. No HTML mail - nothing here needs it. */
export function renderEmail(data) {
  const rows =
    data.kind === 'book-order'
      ? [
          ['Request', 'Founding Book - order request (NOT a payment)'],
          ['Edition', data.edition === 'fr' ? 'French' : 'English'],
          ['Quantity', String(data.quantity)],
          ['Name', `${data.firstName} ${data.lastName}`],
          ['Organisation', data.organisation],
          ['Country', data.country],
          ['Email', data.email],
          ['Phone', data.phone || '-'],
        ]
      : [
          ['Name', `${data.firstName} ${data.lastName}`],
          ['Email', data.email],
          ['Phone', data.phone || '-'],
          ['Profile', data.profile],
          ['Subject', data.subject],
        ];

  return [
    ...rows.map(([k, v]) => `${(k + ':').padEnd(15)}${v}`),
    `${'Site language:'.padEnd(15)}${data.locale}`,
    '',
    '---',
    '',
    data.message || '(no message)',
    '',
    '---',
    'Sent from the MHSV® website.',
  ].join('\n');
}

async function sendEmail(data, env) {
  const recipient = env.CONTACT_RECIPIENT;
  const sender = env.CONTACT_SENDER;
  const transport = (env.CONTACT_TRANSPORT || 'log').toLowerCase();

  if (!recipient) throw new Error('CONTACT_RECIPIENT is not configured');

  const tag = data.kind === 'book-order' ? 'BOOK' : 'CONTACT';
  const subject =
    data.kind === 'book-order'
      ? `[MHSV® ${tag}] Order request - ${data.quantity}× ${data.edition.toUpperCase()}`
      : `[MHSV® ${tag} ${data.locale.toUpperCase()}] ${data.subject}`;
  const text = renderEmail(data);

  if (transport === 'log') {
    console.log('[form] transport=log - not sent\n', { to: recipient, subject, text });
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
      // reply_to is the visitor, so replying from the mailbox just works.
      body: JSON.stringify({ from: sender, to: [recipient], reply_to: data.email, subject, text }),
    });
    if (!response.ok) {
      throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
    }
    return;
  }

  if (transport === 'smtp') {
    // Imported lazily so hosts using Resend never bundle nodemailer.
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
 * Newsletter subscription.
 *
 * Handed to a mailing provider rather than stored here: double opt-in,
 * unsubscribe links and suppression lists are exactly what a provider is for,
 * and a bespoke list would put subscriber data in the repository's blast
 * radius. Brevo's double-opt-in endpoint sends the confirmation itself, so
 * nobody is subscribed until they click it.
 */
async function subscribe(data, env) {
  const provider = (env.NEWSLETTER_PROVIDER || 'log').toLowerCase();

  if (provider === 'log') {
    console.log('[newsletter] provider=log - not subscribed\n', {
      email: data.email,
      firstName: data.firstName || '-',
      language: data.language,
    });
    return;
  }

  if (provider === 'brevo') {
    for (const key of ['BREVO_API_KEY', 'BREVO_LIST_ID', 'BREVO_DOI_TEMPLATE_ID']) {
      if (!env[key]) throw new Error(`${key} is not configured`);
    }
    const response = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        includeListIds: [Number(env.BREVO_LIST_ID)],
        templateId: Number(env.BREVO_DOI_TEMPLATE_ID),
        redirectionUrl: env.BREVO_DOI_REDIRECT_URL || `https://www.mhsv.ch/${data.language}/`,
        attributes: {
          ...(data.firstName ? { PRENOM: data.firstName } : {}),
          LANGUE: data.language.toUpperCase(),
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Brevo responded ${response.status}: ${await response.text()}`);
    }
    return;
  }

  throw new Error(`Unknown NEWSLETTER_PROVIDER "${provider}"`);
}

export async function send(result, env) {
  if (result.kind === 'newsletter') return subscribe(result.data, env);
  return sendEmail(result.data, env);
}

/** Static page a no-JavaScript submit lands on. */
const RESULT_PAGE = {
  contact: 'message-sent',
  'book-order': 'order-sent',
  newsletter: 'newsletter-sent',
};

/**
 * Handle a POST.
 *
 * Returns JSON when the client asked for it (the enhanced path), otherwise a
 * 303 to a static result page so every form still works without JavaScript.
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
    return respond(wantsJson, DEFAULT_LOCALE, 'contact', { ok: false, reason: 'server' }, 400);
  }

  const locale = normaliseLocale(form.get('locale'));
  const kind = normaliseKind(form.get('form'));
  const result = validate(form);

  if (!result.ok) {
    // A caught spam attempt gets the same shape a human sees, so a bot learns
    // nothing from probing. Nothing is sent.
    if (result.reason === 'spam') {
      console.warn('[form] honeypot triggered - discarded');
      return respond(wantsJson, locale, kind, { ok: true }, 200);
    }
    return respond(wantsJson, locale, kind, result, 422);
  }

  try {
    await send(result, env);
  } catch (error) {
    console.error(`[form:${result.kind}] failed:`, error);
    return respond(wantsJson, locale, kind, { ok: false, reason: 'server' }, 502);
  }

  return respond(wantsJson, locale, kind, { ok: true }, 200);
}

function respond(wantsJson, locale, kind, payload, status) {
  if (wantsJson) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  const page = payload.ok ? RESULT_PAGE[kind] || 'message-sent' : 'message-error';
  return new Response(null, { status: 303, headers: { Location: `/${locale}/${page}/` } });
}

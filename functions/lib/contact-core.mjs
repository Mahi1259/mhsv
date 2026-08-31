import { renderEmailHtml } from './email-template.mjs';
import { CREST_BASE64, CREST_CID, CREST_FILENAME } from './crest-logo.mjs';

export const LOCALES = ['fr', 'en', 'de', 'it'];

export const NEWSLETTER_LANGUAGES = ['fr', 'en'];
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

const MIN_FILL_SECONDS = 3;
const MAX_QUANTITY = 500;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s./-]{6,40}$/;

const singleLine = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

export function normaliseLocale(value) {
  const locale = String(value ?? '').toLowerCase();
  return LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

function normaliseKind(value) {
  const kind = String(value ?? 'contact').toLowerCase();
  return FORM_KINDS.includes(kind) ? kind : 'contact';
}

function screenForBots(form) {
  if (singleLine(form.get('website_url'))) return 'spam';

  const renderedAt = Number(form.get('rendered_at'));
  if (Number.isFinite(renderedAt) && renderedAt > 0) {
    const elapsed = (Date.now() - renderedAt) / 1000;
    if (elapsed >= 0 && elapsed < MIN_FILL_SECONDS) return 'tooFast';
  }
  return null;
}

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

  const language = get('language');
  const data = {
    kind,
    locale,
    email,
    consent,
    firstName: get('firstName'),
    language,
  };
  if (!NEWSLETTER_LANGUAGES.includes(language)) fields.push('language');
  if (data.firstName.length > LIMITS.firstName) fields.push('firstName');
  return fields.length ? { ok: false, fields } : { ok: true, kind, data };
}

export function renderEmail(data) {
  const rows =
    data.kind === 'book-order'
      ? [
          ['Demande', 'Livre Fondateur - demande de commande (PAS un paiement)'],
          ['Édition', data.edition === 'fr' ? 'Française' : 'Anglaise'],
          ['Quantité', String(data.quantity)],
          ['Nom', `${data.firstName} ${data.lastName}`],
          ['Organisation', data.organisation],
          ['Pays', data.country],
          ['E-mail', data.email],
          ['Téléphone', data.phone || '-'],
        ]
      : [
          ['Nom', `${data.firstName} ${data.lastName}`],
          ['E-mail', data.email],
          ['Téléphone', data.phone || '-'],
          ['Profil', data.profile],
          ['Sujet', data.subject],
        ];

  return [
    ...rows.map(([k, v]) => `${(k + ' :').padEnd(17)}${v}`),
    '',
    '---',
    '',
    data.message || '(aucun message)',
    '',
    '---',
    'Envoyé depuis le site MHSV®.',
  ].join('\n');
}

const EMBEDS_LOGO = new Set(['smtp', 'brevo']);

function embedsLogo(env) {
  return EMBEDS_LOGO.has((env.CONTACT_TRANSPORT || 'log').toLowerCase());
}

async function deliver(message, env) {
  const recipient = env.CONTACT_RECIPIENT;
  const sender = env.CONTACT_SENDER;
  const transport = (env.CONTACT_TRANSPORT || 'log').toLowerCase();

  if (!recipient) throw new Error('CONTACT_RECIPIENT is not configured');

  const { subject, text, html, replyTo } = message;

  const inlineCrest = html && EMBEDS_LOGO.has(transport);

  if (transport === 'log') {
    console.log(`[${message.tag || 'form'}] transport=log - not sent\n`, {
      to: recipient,
      subject,
      text,
      htmlBytes: html ? html.length : 0,
    });
    return;
  }

  if (transport === 'brevo') {
    if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is not configured');
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { email: sender },
        to: [{ email: recipient }],
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        subject,
        textContent: text,
        ...(html ? { htmlContent: html } : {}),
        ...(inlineCrest
          ? {
              attachment: [
                { content: CREST_BASE64, name: CREST_FILENAME },
              ],
            }
          : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Brevo responded ${response.status}: ${await response.text()}`);
    }
    return;
  }

  if (transport === 'smtp') {
// Split so esbuild cannot see a literal specifier and pull nodemailer into the
// Cloudflare bundle. Workers have no raw TCP, so smtp cannot run there anyway.
    const specifier = ['node', 'mailer'].join('');
    const { default: nodemailer } = await import(specifier).catch(() => {
      throw new Error(
        'CONTACT_TRANSPORT="smtp" needs nodemailer, which is not available on this host. ' +
          'Cloudflare Workers cannot open SMTP connections - use CONTACT_TRANSPORT="brevo" there.',
      );
    });
    const port = Number(env.SMTP_PORT || 587);
    const mailer = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    await mailer.sendMail({
      from: sender,
      to: recipient,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
      ...(html ? { html } : {}),
      ...(inlineCrest
        ? {
            attachments: [
              {
                filename: CREST_FILENAME,
                content: CREST_BASE64,
                encoding: 'base64',
                cid: CREST_CID,
                contentType: 'image/png',
                contentDisposition: 'inline',
              },
            ],
          }
        : {}),
    });
    return;
  }

  throw new Error(`Unknown CONTACT_TRANSPORT "${transport}"`);
}

async function sendEmail(data, env) {
  const tag = data.kind === 'book-order' ? 'LIVRE' : 'CONTACT';
  const subject =
    data.kind === 'book-order'
      ? `[MHSV® ${tag}] Demande de commande - ${data.quantity}× ${data.edition.toUpperCase()}`
      : `[MHSV® ${tag} ${data.locale.toUpperCase()}] ${data.subject}`;

  await deliver(
    {
      subject,
      text: renderEmail(data),
      html: renderEmailHtml(data, {
        siteUrl: env.PUBLIC_SITE_URL,
        embedLogo: embedsLogo(env),
      }),
      replyTo: data.email,
      tag: 'form',
    },
    env,
  );
}

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

  if (provider === 'smtp' || provider === 'email') {
    const edition = data.language === 'fr' ? 'française' : 'anglaise';
    await deliver(
      {
        subject: `[MHSV® NEWSLETTER] ${data.email} - édition ${edition}`,
        text: [
          `${'Demande :'.padEnd(17)}Inscription à la newsletter (opt-in simple)`,
          `${'Nom :'.padEnd(17)}${data.firstName || '-'}`,
          `${'E-mail :'.padEnd(17)}${data.email}`,
          `${'Édition :'.padEnd(17)}${edition}`,
          '',
          '---',
          '',
          'L’abonné a coché la case de consentement sur le site mais n’a PAS',
          'confirmé par e-mail. Ne l’ajoutez à la liste que si cette base est',
          'acceptable.',
          '',
          '---',
          'Envoyé depuis le site MHSV®.',
        ].join('\n'),
        html: renderEmailHtml(data, {
          siteUrl: env.PUBLIC_SITE_URL,
          embedLogo: embedsLogo(env),
        }),
        replyTo: data.email,
        tag: 'newsletter',
      },
      env,
    );
    return;
  }

  if (provider === 'brevo') {
    for (const key of ['BREVO_API_KEY', 'BREVO_LIST_ID']) {
      if (!env[key]) throw new Error(`${key} is not configured`);
    }

    const templateId =
      env[`BREVO_DOI_TEMPLATE_ID_${data.language.toUpperCase()}`] || env.BREVO_DOI_TEMPLATE_ID;
    if (!templateId) throw new Error('BREVO_DOI_TEMPLATE_ID is not configured');

    const now = new Date().toISOString();

    const response = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        includeListIds: [Number(env.BREVO_LIST_ID)],
        templateId: Number(templateId),
        redirectionUrl:
          env.BREVO_DOI_REDIRECT_URL || `https://www.mhsv.ch/${data.language}/`,
        attributes: {
          ...(data.firstName ? { PRENOM: data.firstName } : {}),
          LANGUE: data.language.toUpperCase(),
          CONSENT: 'yes',
          CONSENT_AT: now,
          SIGNUP_AT: now,
          SOURCE: `website:newsletter:${data.locale}`,
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

const RESULT_PAGE = {
  contact: 'message-sent',
  'book-order': 'order-sent',
  newsletter: 'newsletter-sent',
};

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

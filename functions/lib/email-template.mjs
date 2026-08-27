/**
 * HTML body for the internal notification emails.
 *
 * Internal only - this goes to MHSV® staff when someone submits the contact
 * form or requests the Founding Book. It is not a newsletter and not a
 * public-facing design, so it stays deliberately plain: one column, a header,
 * a table of what was submitted, the message, a footer.
 *
 * IN FRENCH, and only French, whatever language the visitor used. There is one
 * recipient mailbox, so there is one audience - MHSV® in Geneva - not four.
 * Translating the labels to the visitor's locale would send that mailbox
 * German- and Italian-labelled mail, which nobody there asked for and which
 * would inherit the DE/IT text still awaiting native review. French is the
 * organisation's own language and the one its legal notice says prevails.
 *
 * What the VISITOR wrote is never touched: their name, subject, profile and
 * message arrive exactly as typed, and a "Langue du site" row records which
 * version of the site they used.
 *
 * Written for MAIL CLIENTS, not browsers. Tables for layout, inline styles
 * only, no flexbox, no grid, no <style> block - Outlook and Gmail strip or
 * ignore most of what a web page relies on. If this looks like 2005 HTML, that
 * is why.
 *
 * The plain-text version in contact-core.mjs is still sent alongside it. Both
 * go in every message: some readers prefer text, some filters score
 * text-less mail worse, and a broken HTML part should never mean an unreadable
 * notification.
 */

import { CREST_CID } from './crest-logo.mjs';

/**
 * Where the crest comes from when it is NOT embedded.
 *
 * Always the production domain, never PUBLIC_SITE_URL. That variable is
 * whatever the running instance is - http://localhost:8788 in dev - and mail is
 * read in a client that has no idea what that is. Emails went out with a
 * localhost image URL until this was fixed.
 */
const PRODUCTION_ORIGIN = 'https://www.mhsv.ch';

const NAVY = '#0C1D3A';
const GOLD = '#D4AF37';
const INK = '#1c2431';
const MUTED = '#5b6675';
const RULE = '#dfe3e9';
const PAPER = '#f4f6f9';

/**
 * Escape everything that came from the form.
 *
 * This is the important line in the file. Every value below is typed by a
 * stranger on a public form and then dropped into HTML that MHSV® staff open in
 * their mail client. Without this, a name like `<img src=x onerror=...>` is
 * markup by the time it reaches them. The plain-text version never had this
 * problem, which is exactly why it is easy to forget when adding an HTML one.
 */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Keep the visitor's line breaks without letting any other markup through. */
function escMultiline(value) {
  return esc(value).replace(/\r?\n/g, '<br />');
}

/**
 * The fields for each form, in the order staff read them.
 *
 * Same shape as the plain-text renderer so the two cannot drift into showing
 * different things.
 */
function fieldsFor(data) {
  if (data.kind === 'newsletter') {
    return [
      ['Demande', 'Inscription à la newsletter'],
      ['Nom', data.firstName || '-'],
      ['E-mail', data.email],
      ['Édition', data.language === 'fr' ? 'Française' : 'Anglaise'],
    ];
  }
  if (data.kind === 'book-order') {
    return [
      ['Demande', 'Livre Fondateur - demande de commande (PAS un paiement)'],
      ['Édition', data.edition === 'fr' ? 'Française' : 'Anglaise'],
      ['Quantité', String(data.quantity)],
      ['Nom', `${data.firstName} ${data.lastName}`],
      ['Organisation', data.organisation],
      ['Pays', data.country],
      ['E-mail', data.email],
      ['Téléphone', data.phone || '-'],
    ];
  }
  return [
    ['Nom', `${data.firstName} ${data.lastName}`],
    ['E-mail', data.email],
    ['Téléphone', data.phone || '-'],
    ['Profil', data.profile],
    ['Sujet', data.subject],
  ];
}

/**
 * @param {object} data     validated submission
 * @param {object} [options]
 * @param {boolean} [options.embedLogo]  reference the crest as a cid: attachment
 * @param {string}  [options.siteUrl]    override the origin for the linked crest
 */
export function renderEmailHtml(data, options = {}) {
  /*
   * A localhost or 127.0.0.1 origin is never usable from a mail client, so it
   * is discarded rather than passed through - dev would otherwise send mail
   * pointing at the developer's own machine.
   */
  const given = String(options.siteUrl || '').replace(/\/+$/, '');
  const siteUrl = given && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(given) ? given : PRODUCTION_ORIGIN;

  /*
   * Embedded beats linked every time here. The crest travels with the message,
   * so it shows even though www.mhsv.ch is not serving yet and even where
   * remote images are blocked - which is the default in most clients.
   */
  const logoSrc = options.embedLogo ? `cid:${CREST_CID}` : `${siteUrl}/icon-192.png`;
  const isOrder = data.kind === 'book-order';
  const isNewsletter = data.kind === 'newsletter';
  const heading = isOrder
    ? 'Livre Fondateur - demande de commande'
    : isNewsletter
      ? 'Inscription à la newsletter'
      : 'Demande via le formulaire de contact';

  const rows = [...fieldsFor(data), ['Langue du site', String(data.locale || '').toUpperCase()]]
    .map(([label, value], i) => {
      const email = label === 'E-mail' && value;
      const shown = email
        ? `<a href="mailto:${esc(value)}" style="color:${NAVY};">${esc(value)}</a>`
        : esc(value);
      return `
              <tr>
                <td style="padding:10px 16px;border-top:${i ? `1px solid ${RULE}` : '0'};background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};width:38%;vertical-align:top;">
                  <strong style="color:${INK};">${esc(label)}</strong>
                </td>
                <td style="padding:10px 16px;border-top:${i ? `1px solid ${RULE}` : '0'};background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${INK};vertical-align:top;">
                  ${shown}
                </td>
              </tr>`;
    })
    .join('');

  const message = data.message
    ? escMultiline(data.message)
    : `<span style="color:${MUTED};">${
        isNewsletter
          ? 'Aucun message - il s’agit d’une demande d’inscription.'
          : '(aucun message)'
      }</span>`;

  /*
   * The order banner. The Founding Book flow is a REQUEST, never a purchase -
   * there is no price and no payment anywhere - and the person reading this
   * needs to know that before they reply as if money had changed hands.
   */
  const newsletterBanner = isNewsletter
    ? `
              <tr>
                <td style="padding:12px 16px;background:#fdf7e6;border:1px solid ${GOLD};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${INK};">
                  <strong>Opt-in simple.</strong> L’abonné a coché la case de consentement sur le site mais n’a PAS confirmé par e-mail. Ne l’ajoutez à la liste que si cette base est acceptable.
                </td>
              </tr>
              <tr><td style="height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>`
    : '';

  const orderBanner = isOrder
    ? `
              <tr>
                <td style="padding:12px 16px;background:#fdf7e6;border:1px solid ${GOLD};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${INK};">
                  <strong>Demande de commande uniquement.</strong> Aucun paiement n’a été encaissé et aucun prix n’a été affiché. Confirmez la disponibilité avec l’expéditeur avant de traiter cette demande comme une commande.
                </td>
              </tr>
              <tr><td style="height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
  <!-- Preheader: what shows in the inbox list next to the subject. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(heading)} - ${esc(
    `${data.firstName} ${data.lastName}`,
  )}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

          <!--
            Header. The crest is embedded as a cid: attachment where the
            transport supports it, and linked otherwise - and a linked one will
            not resolve until www.mhsv.ch is live, on top of being blocked by
            default in most clients. Either way the wordmark beside it is real
            text, so the bar reads correctly with no image at all.
          -->
          <tr>
            <td style="padding:20px 24px;background:${NAVY};border-radius:4px 4px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    <img src="${logoSrc}" width="44" height="44" alt=""
                         style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none;" />
                  </td>
                  <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-size:17px;font-weight:bold;color:#ffffff;letter-spacing:0.02em;">MHSV&reg;</div>
                    <div style="font-size:11px;color:${GOLD};letter-spacing:0.08em;text-transform:uppercase;padding-top:3px;">Notification du site</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 24px;background:#ffffff;border-left:1px solid ${RULE};border-right:1px solid ${RULE};border-bottom:1px solid ${RULE};">
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.3;color:${INK};font-weight:bold;">${esc(heading)}</h1>
            </td>
          </tr>

          <tr><td style="height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>

${orderBanner}${newsletterBanner}
          <!-- Submitted fields -->
          <tr>
            <td style="border:1px solid ${RULE};border-radius:4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
            </td>
          </tr>

          <tr><td style="height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>

          <!-- Message -->
          <tr>
            <td style="padding:16px 18px;background:#ffffff;border:1px solid ${RULE};border-left:3px solid ${GOLD};border-radius:4px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};padding-bottom:8px;">Message</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${INK};">${message}</div>
            </td>
          </tr>

          <tr><td style="height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>

          <tr>
            <td style="padding:0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};">
              Envoyé depuis le site MHSV&reg;. Répondez directement à ce message pour joindre l’expéditeur.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

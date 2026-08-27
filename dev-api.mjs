/**
 * Serves /api/contact during `astro dev`.
 *
 * WHY THIS EXISTS. The form endpoint is a Cloudflare Pages Function in
 * functions/api/contact.js, and `astro dev` does not run Pages Functions - the
 * site is output:'static', so Astro has no route to match and every form submit
 * in dev returned:
 *
 *   [WARN] [router] A `getStaticPaths()` route pattern was matched, but no
 *   matching static path was found for requested path `/api/contact`.
 *   [404] POST /api/contact
 *
 * `npm run dev:cf` (wrangler over dist/) has always worked, but it needs a
 * build first and it is not what anyone runs by reflex. A form that 404s on the
 * ordinary dev server is a trap, not a configuration choice.
 *
 * This runs the SAME handler the deployed function runs - handleContact from
 * functions/lib/contact-core.mjs, which is host-agnostic precisely so it can be
 * driven from anywhere. Nothing here is bundled: `astro:server:setup` is a dev
 * hook and does not exist in a build.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { handleContact } from './functions/lib/contact-core.mjs';

/** This file's own directory - the project root - not wherever npm was run. */
const ROOT = dirname(fileURLToPath(import.meta.url));

const ENDPOINT = '/api/contact';

/**
 * Dev sends nothing by default.
 *
 * A local .env may hold working SMTP or Resend credentials - this project's
 * does - and in that case every submit while poking at the UI delivers a real
 * message to a real inbox. Dev therefore forces the `log` transport and prints
 * the mail to the terminal instead.
 *
 * To genuinely send from dev, opt in explicitly:
 *
 *   MHSV_DEV_SEND=yes npm run dev
 */
function devEnv() {
  /*
   * .env has to be read explicitly. Astro loads it into import.meta.env for the
   * app, NOT into process.env, so the handler saw no CONTACT_RECIPIENT and threw
   * "not configured". The empty prefix loads every key, not just the PUBLIC_
   * ones - this is a dev-only node process and the handler needs the unprefixed
   * names.
   *
   * Read from ROOT rather than process.cwd() so it still resolves when the dev
   * server is started from somewhere else, and read on EVERY request so editing
   * .env takes effect without a restart.
   */
  const env = { ...loadEnv('development', ROOT, ''), ...process.env };

  if (process.env.MHSV_DEV_SEND !== 'yes') {
    env.CONTACT_TRANSPORT = 'log';
    env.NEWSLETTER_PROVIDER = 'log';

    /*
     * Dev must work with no .env at all.
     *
     * The handler requires a recipient before it will do anything, which is
     * right in production and pointless here - nothing is being delivered, the
     * message is printed to the terminal. Without these defaults a checkout
     * with no .env answers every form submit with 502 "CONTACT_RECIPIENT is not
     * configured", which looks like a broken endpoint rather than missing
     * config. Real values still win when they are present.
     */
    env.CONTACT_RECIPIENT ||= 'dev@localhost';
    env.CONTACT_SENDER ||= 'dev@localhost';
  }
  return env;
}

/** Node's IncomingMessage -> a Web Request, which is what the handler takes. */
async function toRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.set(key, value);
  }

  return new Request(new URL(req.url, `http://${req.headers.host || 'localhost'}`), {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
}

export default function devApi() {
  return {
    name: 'mhsv-dev-api',
    hooks: {
      'astro:server:setup': ({ server, logger }) => {
        const sending = process.env.MHSV_DEV_SEND === 'yes';
        logger.info(
          sending
            ? `${ENDPOINT} live - MHSV_DEV_SEND=yes, mail WILL be sent`
            : `${ENDPOINT} live - mail is logged, not sent (MHSV_DEV_SEND=yes to send)`,
        );

        server.middlewares.use(async (req, res, next) => {
          if (!req.url || req.url.split('?')[0] !== ENDPOINT) return next();

          try {
            const response = await handleContact(await toRequest(req), devEnv());

            /*
             * Say it again, per request. The startup banner scrolls away, and
             * the form itself shows its success message either way - because
             * the handler DID succeed; only delivery was skipped. Without this
             * the terminal shows "not sent" while the browser says "sent", and
             * the natural reading is that sending is broken.
             */
            if (!sending && req.method === 'POST' && response.status < 400) {
              logger.info('mail was NOT delivered (dev default). MHSV_DEV_SEND=yes npm run dev');
            }
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (error) {
            // Never let a handler fault take the dev server down.
            logger.error(`${ENDPOINT} failed: ${error?.stack || error}`);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, reason: 'server' }));
          }
        });
      },
    },
  };
}

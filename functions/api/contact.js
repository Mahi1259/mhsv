/**
 * Cloudflare Pages Function - POST /api/contact
 *
 * Cloudflare routes by file path, so this file IS the /api/contact endpoint;
 * there is no config block. Pages Functions use the Web Request/Response API,
 * which is what the shared core is written against, so this is a two-line
 * adapter like the Vercel and Netlify ones beside it.
 *
 * `env` is Cloudflare's per-request bindings object, not process.env - the
 * secrets are set with `wrangler pages secret put` or in the Pages dashboard,
 * and the core reads them from whatever object it is handed.
 */
import { handleContact } from '../lib/contact-core.mjs';

export const onRequestPost = ({ request, env }) => handleContact(request, env);

/** Anything other than POST gets the same 405 the other hosts return. */
export const onRequest = ({ request, env }) => handleContact(request, env);

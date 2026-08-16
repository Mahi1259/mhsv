/**
 * Netlify Function - POST /api/contact
 *
 * Netlify Functions v2 uses the Web Request/Response API, so this is a thin
 * adapter over the host-independent core. The Cloudflare Workers equivalent is
 * in DEPLOY.md and is nearly identical.
 */
import { handleContact } from './lib/contact-core.mjs';

export default async (request) => handleContact(request, process.env);

export const config = {
  path: '/api/contact',
};

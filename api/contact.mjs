/**
 * Vercel Function — POST /api/contact
 *
 * Vercel's Node runtime uses the (req, res) signature, while the shared core is
 * written against the Web Request/Response API. This adapter bridges the two,
 * so validation and sending live in exactly one place across Vercel, Netlify
 * and Cloudflare.
 *
 * Node runtime rather than Edge on purpose: Edge cannot open a TCP socket, so
 * the SMTP transport — the realistic option for a Swiss mail host — would not
 * run there.
 */
import { handleContact } from '../functions/lib/contact-core.mjs';

/**
 * Recover the request body.
 *
 * Vercel's Node runtime may have already consumed and parsed the stream: it
 * parses `application/x-www-form-urlencoded` (the no-JavaScript submit) into an
 * object, but leaves `multipart/form-data` (the fetch submit) alone. Handle
 * both, and fall back to reading the raw stream.
 */
async function readBody(req) {
  const body = req.body;

  if (body !== undefined && body !== null) {
    if (Buffer.isBuffer(body)) return { buffer: body, contentType: null };
    if (typeof body === 'string') return { buffer: Buffer.from(body), contentType: null };
    if (typeof body === 'object') {
      // Already parsed into fields — re-encode so the core sees a normal body.
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
        else params.append(key, String(value));
      }
      return {
        buffer: Buffer.from(params.toString()),
        contentType: 'application/x-www-form-urlencoded',
      };
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), contentType: null };
}

/** Node lowercases header names but allows array values; Headers wants strings. */
function toHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, String(value));
  }
  return headers;
}

export default async function handler(req, res) {
  try {
    const headers = toHeaders(req.headers);
    const hasBody = !['GET', 'HEAD'].includes(req.method);

    let requestBody;
    if (hasBody) {
      const { buffer, contentType } = await readBody(req);
      requestBody = buffer;
      if (contentType) {
        headers.set('content-type', contentType);
        headers.delete('content-length');
      }
    }

    const proto = headers.get('x-forwarded-proto') || 'https';
    const host = headers.get('host') || 'localhost';
    const request = new Request(new URL(req.url, `${proto}://${host}`), {
      method: req.method,
      headers,
      body: requestBody,
    });

    const response = await handleContact(request, process.env);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('[contact] adapter failure:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, reason: 'server' }));
  }
}

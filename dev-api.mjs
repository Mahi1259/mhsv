import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { handleContact } from './functions/lib/contact-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));

const ENDPOINT = '/api/contact';

function wantsToSend() {
  const env = { ...loadEnv('development', ROOT, ''), ...process.env };
  return env.MHSV_DEV_SEND === 'yes';
}
function devEnv() {
  const env = { ...loadEnv('development', ROOT, ''), ...process.env };

  if (env.MHSV_DEV_SEND !== 'yes') {
    env.CONTACT_TRANSPORT = 'log';
    env.NEWSLETTER_PROVIDER = 'log';

    env.CONTACT_RECIPIENT ||= 'dev@localhost';
    env.CONTACT_SENDER ||= 'dev@localhost';
  }
  return env;
}

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
        logger.info(
          wantsToSend()
            ? `${ENDPOINT} live - MHSV_DEV_SEND=yes, mail WILL be sent`
            : `${ENDPOINT} live - mail is logged, not sent (npm run dev:send to send)`,
        );

        server.middlewares.use(async (req, res, next) => {
          if (!req.url || req.url.split('?')[0] !== ENDPOINT) return next();

          try {
            const response = await handleContact(await toRequest(req), devEnv());

            if (!wantsToSend() && req.method === 'POST' && response.status < 400) {
              logger.info(
                'mail was NOT delivered. Use `npm run dev:send`, or put MHSV_DEV_SEND=yes in .env',
              );
            }
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (error) {
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

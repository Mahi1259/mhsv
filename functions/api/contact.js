import { handleContact } from '../lib/contact-core.mjs';

export const onRequestPost = ({ request, env }) => handleContact(request, env);

export const onRequest = ({ request, env }) => handleContact(request, env);

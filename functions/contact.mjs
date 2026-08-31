import { handleContact } from './lib/contact-core.mjs';

export default async (request) => handleContact(request, process.env);

export const config = {
  path: '/api/contact',
};

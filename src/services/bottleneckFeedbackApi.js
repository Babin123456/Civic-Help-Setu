import { withCsrfHeaders } from '../utils/csrf.js';

const messages = {
  401: 'Sign in again to access the shared moderation queue.',
  403: 'A verified administrator account is required.',
  409: 'This report changed. Refresh before reviewing it, or retry a changed submission with a new receipt key.',
  423: 'This attachment is quarantined and cannot be downloaded.',
  429: 'Too many submissions. Wait a minute before retrying. Your feedback is still in the form.',
};
export async function feedbackRequest({ method = 'GET', body, query = '', key, getToken, signal } = {}) {
  const token = await getToken?.();
  const response = await fetch(`/api/bottleneck-feedback${query}`, { method, signal, credentials: 'same-origin',
    headers: withCsrfHeaders({ 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(messages[response.status] || 'Feedback service unavailable. Nothing has been confirmed; keep this form open and retry.');
  return response.json();
}

export async function encodeFeedbackAttachment(file) {
  if (!file) return null;
  if (file.size < 1 || file.size > 256 * 1024 || !['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG or PDF between 1 byte and 256 KB.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { base64: btoa(binary), contentType: file.type };
}

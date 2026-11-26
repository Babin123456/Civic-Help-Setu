// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ToiletIssueReportModal from '../src/components/toilets/ToiletIssueReportModal.jsx';
import PublicToiletReviewQueue from '../src/components/admin/PublicToiletReviewQueue.jsx';

const auth = vi.hoisted(() => ({ user: { id: 'admin', role: 'admin' }, getSessionToken: vi.fn() }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../src/context/ToastContext', () => ({ useToast: () => ({ toast: {} }) }));
vi.mock('../src/services/publicToiletService', () => ({ reportMaintenanceIssue: vi.fn(), submitFeedback: vi.fn() }));
let container, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  vi.unstubAllGlobals(); vi.resetAllMocks();
});
const reply = (ok, data) => ({ ok, json: async () => data });
const click = async element => { await act(async () => element.click()); };

it('shows no receipt on failed persistence, and reuses the key on a successful retry', async () => {
  fetch.mockResolvedValueOnce(reply(false, { error: 'storage_unavailable' }))
    .mockResolvedValueOnce(reply(true, { receiptSeal: 'PT-server-receipt', submittedAt: '2026-11-21T01:00:00Z' }));
  const success = vi.fn();
  await act(async () => root.render(<ToiletIssueReportModal facility={{ id: 'pt-1', name: 'Facility' }} onClose={() => {}} onSuccess={success} />));
  const textarea = container.querySelector('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Broken tap needs repair');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const submit = async () => { await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); };
  await submit();
  expect(container.textContent).toContain('could not be saved');
  expect(container.textContent).not.toContain('Submission Recorded');
  expect(success).not.toHaveBeenCalled();
  await submit();
  expect(fetch.mock.calls[1][1].headers['Idempotency-Key']).toBe(fetch.mock.calls[0][1].headers['Idempotency-Key']);
  expect(container.textContent).toContain('PT-server-receipt');
  expect(success).toHaveBeenCalledTimes(1);
});

it('loads authenticated pages and does not display a successful review after failed persistence', async () => {
  auth.getSessionToken.mockResolvedValue('admin-token');
  fetch.mockResolvedValueOnce(reply(true, { items: [{ id: 'a', facilityId: 'pt-1', description: 'Broken tap', timestamp: '2026-11-21', status: 'queued_for_moderation' }], nextCursor: 'page-two' }))
    .mockResolvedValueOnce(reply(false, {}))
    .mockResolvedValueOnce(reply(true, { items: [{ id: 'b', facilityId: 'pt-2', description: 'Broken door', timestamp: '2026-11-21', status: 'queued_for_moderation' }], nextCursor: null }));
  await act(async () => root.render(<PublicToiletReviewQueue />));
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer admin-token');
  await click([...container.querySelectorAll('button')].find(x => x.textContent.includes('Approve')));
  expect(container.textContent).toContain('Review was not saved');
  expect(container.textContent).toContain('Approve');
  await click([...container.querySelectorAll('button')].find(x => x.textContent.includes('Load more')));
  expect(container.textContent).toContain('Broken tap');
  expect(container.textContent).toContain('Broken door');
  expect(fetch.mock.calls[2][0]).toContain('cursor=page-two');
});

it('clears loaded reports when the signed-in identity changes', async () => {
  auth.getSessionToken.mockResolvedValue('admin-token');
  fetch.mockResolvedValue(reply(true, { items: [{ id: 'a', description: 'Private queue report', timestamp: '2026-11-21', status: 'approved' }], nextCursor: null }));
  await act(async () => root.render(<PublicToiletReviewQueue />));
  expect(container.textContent).toContain('Private queue report');
  auth.user = { id: 'other', role: 'citizen' };
  auth.getSessionToken.mockResolvedValue(null);
  await act(async () => root.render(<PublicToiletReviewQueue />));
  expect(container.textContent).not.toContain('Private queue report');
  expect(container.textContent).toContain('Sign in as an administrator');
  auth.user = { id: 'admin', role: 'admin' };
});

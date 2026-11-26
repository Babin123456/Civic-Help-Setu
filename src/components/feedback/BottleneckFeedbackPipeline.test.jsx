// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import BottleneckFeedbackPrompt from './BottleneckFeedbackPrompt.jsx';
import BottleneckFeedbackDashboard from '../admin/BottleneckFeedbackDashboard.jsx';
const auth = vi.hoisted(() => ({ isDemoMode: false, getSessionToken: async () => 'verified-session-token' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth, useOptionalAuth: () => auth }));

let root, host;
const settle = async work => { await act(async () => { await work?.(); await new Promise(resolve => setTimeout(resolve, 0)); }); };
const click = text => { const button = [...host.querySelectorAll('button')].find(node => node.textContent.includes(text)); expect(button, text).toBeTruthy(); button.click(); };
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('shared feedback UI', () => {
  it('retains feedback on failure, retries the same receipt key, then confirms only after server persistence', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ id: 'durable-receipt' }, 201));
    vi.stubGlobal('fetch', fetch);
    await settle(() => root.render(<BottleneckFeedbackPrompt serviceId="driving-licence" serviceName="Driving Licence" />));
    await settle(() => click('Stuck or confused'));
    const notes = host.querySelector('textarea');
    await settle(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(notes, 'Synthetic retained details'); notes.dispatchEvent(new Event('input', { bubbles: true })); });
    await settle(() => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="alert"]').textContent).toContain('unavailable');
    expect(host.textContent).not.toContain('Thank You'); expect(notes.value).toBe('Synthetic retained details');
    await settle(() => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetch.mock.calls[1][1].headers['Idempotency-Key']);
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer verified-session-token');
    expect(host.textContent).toContain('Thank You'); expect(host.textContent).toContain('shared moderation queue');
  });

  it('guards rapid duplicate submits while a network request is pending', async () => {
    let complete; const fetch = vi.fn(() => new Promise(resolve => { complete = resolve; })); vi.stubGlobal('fetch', fetch);
    await settle(() => root.render(<BottleneckFeedbackPrompt serviceId="driving-licence" />)); await settle(() => click('Stuck or confused'));
    await settle(() => { for (let i = 0; i < 2; i++) host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(fetch).toHaveBeenCalledTimes(1); expect(host.querySelector('button[type="submit"]').disabled).toBe(true);
    await settle(() => complete(json({ id: 'saved' }, 201))); expect(host.textContent).toContain('Thank You');
  });

  it('shows durable moderation, isolated spam, SLA and immutable audit; conflicts preserve the review form', async () => {
    const item = { id: 'a'.repeat(64), serviceId: 'driving-licence', serviceName: 'Synthetic shared guide', category: 'other', rating: 3,
      status: 'pending', notes: 'Synthetic report', createdAt: 1, revision: 7, overdue: true, attachment: { state: 'quarantined' } };
    const fetch = vi.fn(async (url, options) => {
      if (options.method === 'PATCH') return json({}, 409);
      if (url.includes('view=audit')) return json({ items: [{ id: 'audit-1', status: 'reviewed', reviewedBy: 'verified-admin', revision: 7 }] });
      if (url.includes('view=moderation')) return json({ items: [item], nextCursor: null });
      return json({ totalReports: 5, averageFrictionScore: 3, categoryCounts: { other: 5 }, severityDistribution: {}, stepBreakdown: [] });
    });
    vi.stubGlobal('fetch', fetch); await settle(() => root.render(<BottleneckFeedbackDashboard />));
    expect(host.textContent).toContain('oldest first'); expect(host.textContent).toContain('Suspected spam');
    await settle(() => click('Show Individual')); await settle(() => click('Moderation Action'));
    expect(host.textContent).toContain('SLA overdue'); expect(host.textContent).toContain('verified-admin');
    expect(host.textContent).toContain('quarantined'); expect(host.textContent).not.toContain('Download scanner-approved');
    await settle(() => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="alert"]').textContent).toContain('changed'); expect(host.querySelector('[role="dialog"]')).toBeTruthy();
    const mutation = fetch.mock.calls.find(([, options]) => options.method === 'PATCH'); expect(JSON.parse(mutation[1].body).revision).toBe(7);
  });

  it('denies a demo role masquerading as a shared moderator', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => url.includes('view=moderation') ? json({}, 403) : json({ totalReports: 0 })));
    await settle(() => root.render(<BottleneckFeedbackDashboard />));
    expect(host.querySelector('[role="alert"]').textContent).toContain('verified administrator'); expect(host.textContent).not.toContain('Demo Moderator');
  });
});

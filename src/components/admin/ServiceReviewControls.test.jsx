import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReviewControls } from './ServiceDraftsPanel.jsx';
import { reviewDraft, saveDraft } from '../../services/serviceDrafts';
import { approveDraft, submitForReview } from '../../services/serviceReview';
import { setCurrentActor } from '../../services/accessControl';
import { MOCK_SERVICES } from '../../data/services';

const published = MOCK_SERVICES[0];
const editor = { role: 'admin', username: 'Editor Ann' };
const reviewer = { role: 'admin', username: 'Reviewer Raj' };

let id;
beforeEach(() => {
  const data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  });
  setCurrentActor(editor);
  id = saveDraft({ ...structuredClone(published), fees: 'Rs 250 (revised)' }, { serviceId: published.id }).draftId;
});

const render = (viewer) => renderToStaticMarkup(<ReviewControls state={reviewDraft(id)} viewer={viewer} onAct={() => {}} />);

describe('ReviewControls', () => {
  it('asks for a source and offers to send a high-impact change', () => {
    const html = render('Editor Ann');
    expect(html).toContain('Another admin must approve it');
    expect(html).toContain('Fees');
    expect(html).toContain('Where do the changed facts come from?');
    expect(html).toContain('Send for second review');
    expect(html).not.toContain('Approve</button>');
  });

  it('shows the guide official sources to check against', () => {
    const html = render('Editor Ann');
    expect(html).toContain('Official sources on this guide');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('shows the sender no approve button, only a reason it is not theirs to decide, and a withdraw', () => {
    submitForReview(id, { sourceReference: 'Notification 12/2026' });
    const html = render('Editor Ann');
    expect(html).toContain('You sent this change, so another admin must review it.');
    expect(html).toContain('Withdraw from review');
    expect(html).not.toContain('>Approve<');
    expect(html).toContain('Notification 12/2026');
  });

  it('shows another admin a reason box with Approve and Return', () => {
    submitForReview(id, { sourceReference: 'Notification 12/2026' });
    setCurrentActor(reviewer);
    const html = render('Reviewer Raj');
    expect(html).toContain('Reason for your decision');
    expect(html).toContain('>Approve<');
    expect(html).toContain('Return for changes');
    expect(html).not.toContain('Withdraw from review');
  });

  it('shows who approved, when, and why', () => {
    submitForReview(id, { sourceReference: 'Notification 12/2026' });
    setCurrentActor(reviewer);
    approveDraft(id, { reason: 'Matches the notice' });
    const html = render('Reviewer Raj');
    expect(html).toContain('Approved by');
    expect(html).toContain('Reviewer Raj');
    expect(html).toContain('Matches the notice');
    expect(html).toContain('It can be published');
  });

  it('says no review is needed for a low-impact edit', () => {
    id = saveDraft({ ...structuredClone(published), processingTime: '2 days' }, { draftId: id }).draftId;
    const html = render('Editor Ann');
    expect(html).toContain('no second reviewer is needed');
    expect(html).not.toContain('Send for second review');
  });
});

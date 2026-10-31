import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ServiceDraftsPanel, { DiffTable, DraftPreview } from './ServiceDraftsPanel.jsx';
import { diffRecords, saveDraft } from '../../services/serviceDrafts';
import { setCurrentActor } from '../../services/accessControl';
import { MOCK_SERVICES } from '../../data/services';
import { LanguageProvider } from '../../context/LanguageContext';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));

const published = MOCK_SERVICES[0];

beforeEach(() => {
  const data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  });
  setCurrentActor({ role: 'admin', username: 'Test Admin' });
});

describe('ServiceDraftsPanel', () => {
  it('explains the empty state', () => {
    const html = renderToStaticMarkup(<ServiceDraftsPanel onEditDraft={() => {}} />);
    expect(html).toContain('Service drafts');
    expect(html).toContain('No drafts');
    expect(html).toContain('Drafts are private to this browser');
  });

  it('lists each draft with Review, Edit and Discard labelled by name', () => {
    saveDraft({ ...structuredClone(published), fees: 'Rs 99' }, { serviceId: published.id, author: 'Test Admin' });
    saveDraft({ name: 'Brand new guide' });
    const html = renderToStaticMarkup(<ServiceDraftsPanel onEditDraft={() => {}} />);
    expect(html).toContain(`aria-label="Review draft ${published.name}"`);
    expect(html).toContain('aria-label="Discard draft Brand new guide"');
    expect(html).toContain('Edit of a published guide');
    expect(html).toContain('New guide');
  });
});

describe('DiffTable', () => {
  it('is a labelled, focusable region with a caption and column headers', () => {
    const changes = diffRecords({ fees: 'Free', documents: ['ID'] }, { fees: 'Rs 10', documents: ['ID', 'Photo'] });
    const html = renderToStaticMarkup(<DiffTable changes={changes} />);
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<caption>');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
  });

  it('writes the kind of change out in words, not only colour', () => {
    const html = renderToStaticMarkup(<DiffTable changes={diffRecords({ fees: 'Free' }, { fees: 'Rs 10', shortDescription: 'New' })} />);
    expect(html).toContain('Changed');
    expect(html).toContain('Added');
    expect(html).toContain('Rs 10');
  });

  it('shows added and removed list items', () => {
    const html = renderToStaticMarkup(<DiffTable changes={diffRecords({ documents: ['ID', 'Photo'] }, { documents: ['ID', 'Address'] })} />);
    expect(html).toContain('Removed: Photo');
    expect(html).toContain('Added: Address');
  });

  it('says so when nothing differs', () => {
    expect(renderToStaticMarkup(<DiffTable changes={[]} />)).toContain('No field differs');
  });
});

describe('DraftPreview', () => {
  const render = (record) =>
    renderToStaticMarkup(
      <LanguageProvider>
        <MemoryRouter>
          <DraftPreview record={record} />
        </MemoryRouter>
      </LanguageProvider>
    );

  it('renders the draft with the public page and marks it as a preview', () => {
    const html = render({
      ...structuredClone(published),
      name: 'Draft-only name',
    });
    expect(html).toContain('Draft-only name');
    expect(html).toContain('data-preview="true"');
    expect(html).toContain('Preview only');
  });

  it('handles a record with only the required fields', () => {
    const html = render({
      id: 'bare-guide',
      name: 'Bare guide',
      category: published.category,
      type: 'Online',
      difficulty: 'Easy',
      shortDescription: 'Just the basics.',
      fees: 'Free of cost',
      processingTime: '3 days',
      documents: ['Proof of address'],
      officialSources: [{ name: 'Portal', url: 'https://example.gov.in' }],
    });
    expect(html).toContain('Bare guide');
    expect(html).toContain('Just the basics.');
  });

  it('does not touch the saved-services list or the catalogue', () => {
    render({ ...structuredClone(published), fees: 'Rs 1' });
    expect(localStorage.getItem('civicbridge_saved')).toBeNull();
    expect(localStorage.getItem('civicbridge_custom_services')).toBeNull();
  });
});

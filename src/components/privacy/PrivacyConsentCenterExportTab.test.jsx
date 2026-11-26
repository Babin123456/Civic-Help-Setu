import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The modal picks its tab with useState('consents') and has no prop for it, and a static render
// cannot click the tab button. So the initial tab state is switched to 'export_delete' here.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState: (initial, ...rest) => actual.useState(initial === 'consents' ? 'export_delete' : initial, ...rest),
  };
});

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  }),
}));

import PrivacyConsentCenterModal from './PrivacyConsentCenterModal';

describe('PrivacyConsentCenterModal export and delete tab', () => {
  it('renders the export section without throwing', () => {
    const html = renderToStaticMarkup(
      <PrivacyConsentCenterModal isOpen={true} onClose={() => {}} />
    );

    expect(html).toContain('Verify Export Dossier Integrity (SHA-256)');
  });
});

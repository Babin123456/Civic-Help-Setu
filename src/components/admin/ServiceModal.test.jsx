import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceModal from './ServiceModal.jsx';
import { MOCK_SERVICES } from '../../data/services';

// The real hook uses react-router's useBlocker, which needs a data router that a static render does not have.
vi.mock('../../hooks/useUnsavedChangesGuard', () => ({
  default: () => ({ isBlocked: false, stay: () => {}, discard: () => {} }),
}));

const render = (props) =>
  renderToStaticMarkup(<ServiceModal isOpen onClose={() => {}} onSave={() => {}} {...props} />);

describe('ServiceModal', () => {
  it('opens the add form, including the intake windows fieldset', () => {
    const html = render({ serviceToEdit: null });
    expect(html).toContain('Application intake windows');
  });

  it('renders with serviceToEdit set', () => {
    const service = { ...MOCK_SERVICES[0], intakeWindows: [{ label: 'Round 1', startDate: '2026-01-01', endDate: '2026-02-01' }] };
    const html = render({ serviceToEdit: service });
    expect(html).toContain('Application intake windows');
  });

  it('renders nothing while closed', () => {
    expect(render({ isOpen: false, serviceToEdit: null })).toBe('');
  });
});

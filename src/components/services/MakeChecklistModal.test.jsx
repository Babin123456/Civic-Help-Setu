import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MakeChecklistModal from './MakeChecklistModal';
import { REQUIREMENT_TYPES } from '../../services/requirementTypes';

const mockService = {
  id: 'birth-cert-test',
  name: 'Birth Certificate Registration',
  documents: [
    'Hospital birth proof',
    'Parents Aadhaar cards',
    'Affidavit if born at home (maybe required)',
  ],
  documentRequirements: {
    'Hospital birth proof': { type: REQUIREMENT_TYPES.REQUIRED },
  },
};

describe('MakeChecklistModal component', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <MakeChecklistModal isOpen={false} service={mockService} onClose={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog and header when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <MakeChecklistModal isOpen={true} service={mockService} onClose={() => {}} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Make Checklist: Birth Certificate Registration');
    expect(html).toContain('Review and edit requirements before saving to your checklist');
  });

  it('displays the strict grounding and uncertainty disclaimer note', () => {
    const html = renderToStaticMarkup(
      <MakeChecklistModal isOpen={true} service={mockService} onClose={() => {}} />
    );

    expect(html).toContain('Strict Requirement Grounding');
    expect(html).toContain('Confirm with the department.');
  });

  it('contains Save to Checklist and Regenerate buttons', () => {
    const html = renderToStaticMarkup(
      <MakeChecklistModal isOpen={true} service={mockService} onClose={() => {}} />
    );

    expect(html).toContain('Save to Checklist');
    expect(html).toContain('Regenerate');
    expect(html).toContain('Add Item');
  });
});

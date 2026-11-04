import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ShareDirectoryModal from './ShareDirectoryModal';

describe('ShareDirectoryModal Component (#475)', () => {
  it('renders modal with list title, privacy guarantees, and create action', () => {
    const html = renderToStaticMarkup(
      <ShareDirectoryModal
        isOpen={true}
        onClose={() => {}}
        currentFilters={{ category: 'Education', search: 'Scholarship' }}
      />
    );

    expect(html).toContain('Share This Filtered List');
    expect(html).toContain('Shared views bundle catalogue query parameters only');
    expect(html).toContain('List Title');
    expect(html).toContain('Note for Recipients');
    expect(html).toContain('Create Share Link');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ShareDirectoryModal
        isOpen={false}
        onClose={() => {}}
        currentFilters={{}}
      />
    );

    expect(html).toBe('');
  });
});

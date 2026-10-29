import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OfflineCacheActionCard from './OfflineCacheActionCard';

describe('OfflineCacheActionCard', () => {
  it('renders nothing when service is null or has no id', () => {
    const htmlNull = renderToStaticMarkup(<OfflineCacheActionCard service={null} />);
    expect(htmlNull).toBe('');

    const htmlEmpty = renderToStaticMarkup(<OfflineCacheActionCard service={{}} />);
    expect(htmlEmpty).toBe('');
  });

  it('renders offline visit staging card with action button and guidance', () => {
    const service = {
      id: 'pan-card',
      name: 'PAN Card New Application',
      category: 'Identity',
    };

    const html = renderToStaticMarkup(<OfflineCacheActionCard service={service} />);
    expect(html).toContain('role="region"');
    expect(html).toContain('Offline In-Office Access');
    expect(html).toContain('Save for Offline Visit');
    expect(html).toContain('Online Only');
  });
});

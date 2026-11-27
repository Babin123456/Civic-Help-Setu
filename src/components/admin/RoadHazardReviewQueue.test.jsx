import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoadHazardReviewQueue from './RoadHazardReviewQueue';
import { ToastProvider } from '../../context/ToastContext';

describe('RoadHazardReviewQueue Component (#769)', () => {
  it('renders queue items with verification seals and moderation actions', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <RoadHazardReviewQueue />
      </ToastProvider>
    );

    expect(html).toContain('Citizen Road Hazard Moderation Queue');
    expect(html).toContain('NH-44 Outer Ring Road (Hebbal)');
    expect(html).toContain('RH-HAZ-4A12-88B1');
    expect(html).toContain('Inner Ring Road (Ashram Chowk)');
    expect(html).toContain('RH-HAZ-7C33-9F02');
    expect(html).toContain('Validate');
    expect(html).toContain('Dismiss');
  });

  it('renders accessibility attributes and region landmark', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <RoadHazardReviewQueue />
      </ToastProvider>
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Citizen Road Hazard Moderation Queue"');
    expect(html).toContain('2 Pending Review');
  });
});

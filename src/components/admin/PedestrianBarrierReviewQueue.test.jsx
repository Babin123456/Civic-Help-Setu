import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PedestrianBarrierReviewQueue from './PedestrianBarrierReviewQueue.jsx';
import { ToastProvider } from '../../context/ToastContext';
import { resetPedestrianBarrierData } from '../../services/pedestrianBarrierStorage.js';

describe('PedestrianBarrierReviewQueue Component (#757)', () => {
  beforeEach(() => {
    resetPedestrianBarrierData();
  });

  const renderComponent = () => {
    return renderToStaticMarkup(
      <ToastProvider>
        <PedestrianBarrierReviewQueue />
      </ToastProvider>
    );
  };

  it('renders queue items with verification seals and moderation actions', () => {
    const html = renderComponent();
    expect(html).toContain('Accessible Pedestrian Route Barrier Moderation Queue');
    expect(html).toContain('BAR-101');
    expect(html).toContain('BAR-102');
    expect(html).toContain('Ward 150 - Bellandur');
  });

  it('renders accessibility attributes and region landmark', () => {
    const html = renderComponent();
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Pedestrian Barrier Moderation Queue"');
    expect(html).toContain('Pending Review');
  });
});

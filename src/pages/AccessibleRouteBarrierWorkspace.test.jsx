import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import AccessibleRouteBarrierWorkspace from './AccessibleRouteBarrierWorkspace.jsx';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';
import { resetPedestrianBarrierData } from '../services/pedestrianBarrierStorage.js';

describe('AccessibleRouteBarrierWorkspace (#757)', () => {
  beforeEach(() => {
    resetPedestrianBarrierData();
  });

  const renderComponent = () => {
    return renderToString(
      <AuthProvider>
        <ToastProvider>
          <NetworkProvider>
            <AccessibleRouteBarrierWorkspace />
          </NetworkProvider>
        </ToastProvider>
      </AuthProvider>
    );
  };

  it('renders the workspace header and descriptive subtitle', () => {
    const html = renderComponent();
    expect(html).toContain('Accessible Pedestrian Route &amp; Barrier Map');
    expect(html).toContain('Municipal infrastructure accessibility layer');
    expect(html).toContain('Report Obstacle');
  });

  it('renders infrastructure metrics ribbon with curb ramp compliance and tactile coverage', () => {
    const html = renderComponent();
    expect(html).toContain('Walkway Corridors');
    expect(html).toContain('Curb Ramp Compliance');
    expect(html).toContain('Tactile Paving Coverage');
    expect(html).toContain('Active Obstacles');
  });

  it('renders functional mobility constraint controls without medical inquiries', () => {
    const html = renderComponent();
    expect(html).toContain('Functional Mobility Constraints');
    expect(html).toContain('Avoid stairs &amp; vertical steps');
    expect(html).toContain('Require dropped curb ramps');
    expect(html).toContain('Avoid dirt &amp; broken paver surfaces');
    expect(html).toContain('Require tactile paving (low-vision)');
  });

  it('renders view switcher buttons for Interactive Map and Accessible Tables Alternative', () => {
    const html = renderComponent();
    expect(html).toContain('Interactive Map &amp; Planner');
    expect(html).toContain('Accessible Tables Alternative');
  });

  it('renders the interactive SVG schematic canvas and legend', () => {
    const html = renderComponent();
    expect(html).toContain('Pedestrian Network &amp; Barrier Schematic Map');
    expect(html).toContain('Compliant Footpath');
    expect(html).toContain('Verified Barrier');
  });

  it('renders statutory audit recency notice when corridors exceed 30-day inspection threshold', () => {
    const html = renderComponent();
    expect(html).toContain('Audit Recency Notice');
    expect(html).toContain('30-day window');
  });
});

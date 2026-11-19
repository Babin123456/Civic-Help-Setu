import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import WardBudgetWorkspace from './WardBudgetWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';
import { resetWardBudgetData } from '../services/wardBudgetStorage.js';

describe('WardBudgetWorkspace (#765)', () => {
  beforeEach(() => {
    resetWardBudgetData();
  });

  const renderComponent = () => {
    return renderToString(
      <AuthProvider>
        <ToastProvider>
          <NetworkProvider>
            <WardBudgetWorkspace />
          </NetworkProvider>
        </ToastProvider>
      </AuthProvider>
    );
  };

  it('renders the header with participatory budget cycle title and budget pool', () => {
    const html = renderComponent();
    expect(html).toContain('Ward 150 (Bellandur) Participatory Citizen Budget');
    expect(html).toContain('Ward Pool Ceiling');
    expect(html).toContain('Submit Ward Proposal');
  });

  it('renders advisory disclaimers and statutory notices', () => {
    const html = renderComponent();
    expect(html).toContain('Advisory Notice');
    expect(html).toContain('Municipal Ward Committee rules');
  });

  it('renders initial seeded proposal cards', () => {
    const html = renderComponent();
    expect(html).toContain('Footpath Restoration and Tactile Paving on 14th Main Road');
    expect(html).toContain('Secondary Stormwater Drain Desilting and Trash Rack Placement');
  });

  it('renders tabs for navigation including Deliberate, Ballot, and Tracking', () => {
    const html = renderComponent();
    expect(html).toContain('Browse &amp; Deliberate');
    expect(html).toContain('Active Citizen Ballot');
    expect(html).toContain('Ground Implementation Tracking');
  });

  it('renders search input and category filter dropdown', () => {
    const html = renderComponent();
    expect(html).toContain('Search by street, landmark, or works...');
    expect(html).toContain('All Categories');
    expect(html).toContain('Roads &amp; Footpaths');
    expect(html).toContain('Sanitation &amp; Drainage');
  });
});


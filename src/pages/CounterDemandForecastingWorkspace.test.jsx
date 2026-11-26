import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CounterDemandForecastingWorkspace from './CounterDemandForecastingWorkspace';
import {
  CounterDemandSkeleton,
  CounterDemandEmptyState,
  CounterDemandStaleNotice,
  CounterDemandOfflineNotice,
  CounterDemandPermissionDenied,
  CounterDemandErrorState,
} from '../components/counterDemand/CounterDemandStates';
import CounterDemandAccessibleTable from '../components/counterDemand/CounterDemandAccessibleTable';
import CounterDemandPublicNotice from '../components/counterDemand/CounterDemandPublicNotice';
import CounterDemandOverrideModal from '../components/counterDemand/CounterDemandOverrideModal';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'mgr_test', role: 'manager' } }),
}));

describe('CounterDemandForecastingWorkspace (#764)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  const renderWorkspace = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <NetworkProvider>
          <ToastProvider>
            <CounterDemandForecastingWorkspace />
          </ToastProvider>
        </NetworkProvider>
      </MemoryRouter>
    );
  };

  it('renders workspace title, citizen advisory banner, and filters', () => {
    const html = renderWorkspace();

    expect(html).toContain('Civic Counter Demand &amp; Queue Staffing');
    expect(html).toContain('Zero-Guarantee Principle');
    expect(html).toContain('Target Civic Service Centre');
    expect(html).toContain('Planning Date');
    expect(html).toContain('Chart View');
    expect(html).toContain('Accessible Table');
    expect(html).toContain('Operational Queue Staffing Allocation');
  });

  it('renders public notice with zero-guarantee wait time disclaimer', () => {
    const html = renderToStaticMarkup(
      <CounterDemandPublicNotice aggregateTrafficRating="Moderate" />
    );

    expect(html).toContain('Citizen Advisory: Estimated Footfall &amp; Counter Planning');
    expect(html).toContain('Zero-Guarantee Principle');
    expect(html).toContain('Typical Traffic: Moderate');
  });

  it('renders accessible semantic data table alternative', () => {
    const mockForecast = [
      {
        hour: '09:00',
        predictedDemand: 28,
        lowerBound80: 24,
        upperBound80: 32,
        lowerBound95: 22,
        upperBound95: 34,
        recommendedCounters: 6,
        bufferCounters: 7,
        utilization: 0.78,
        expectedWaitMinutes: 12.5,
      },
      {
        hour: '10:00',
        predictedDemand: 38,
        lowerBound80: 34,
        upperBound80: 42,
        lowerBound95: 31,
        upperBound95: 45,
        recommendedCounters: 8,
        bufferCounters: 9,
        utilization: 0.82,
        expectedWaitMinutes: 14.0,
      },
    ];

    const html = renderToStaticMarkup(
      <CounterDemandAccessibleTable
        hourlyForecast={mockForecast}
        officeName="South Delhi Municipal Centre"
        targetDate="2026-11-18"
      />
    );

    expect(html).toContain('Operating Hour');
    expect(html).toContain('Expected Demand');
    expect(html).toContain('80% Interval');
    expect(html).toContain('95% Interval');
    expect(html).toContain('28 citizens/hr');
    expect(html).toContain('38 citizens/hr');
    expect(html).toContain('Peak');
  });

  it('renders resilient UI states: skeleton, empty, stale, offline, permission denied, error', () => {
    expect(renderToStaticMarkup(<CounterDemandSkeleton />)).toContain('counter-demand-skeleton');

    expect(
      renderToStaticMarkup(
        <CounterDemandEmptyState message="No records found." />
      )
    ).toContain('No Historical Footfall Aggregates');

    expect(
      renderToStaticMarkup(
        <CounterDemandStaleNotice lastUpdated="2026-11-10T10:00:00Z" />
      )
    ).toContain('Showing cached baseline data');

    expect(
      renderToStaticMarkup(<CounterDemandOfflineNotice />)
    ).toContain('Offline Mode:');

    expect(
      renderToStaticMarkup(
        <CounterDemandPermissionDenied requiredRole="centre_manager" />
      )
    ).toContain('Access Restricted');

    expect(
      renderToStaticMarkup(
        <CounterDemandErrorState error="Queue computation failed." />
      )
    ).toContain('Unable to Compute Forecast');
  });

  it('renders human override modal with mandatory justification textarea', () => {
    const html = renderToStaticMarkup(
      <CounterDemandOverrideModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        variancePct={25}
        officeName="South Delhi Municipal Centre"
        planDate="2026-11-18"
      />
    );

    expect(html).toContain('Staffing Variance Justification Required');
    expect(html).toContain('25%');
    expect(html).toContain('Operational Justification');
    expect(html).toContain('Confirm &amp; Record Override');
  });
});


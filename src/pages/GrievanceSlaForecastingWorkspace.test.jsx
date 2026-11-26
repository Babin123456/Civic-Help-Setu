import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GrievanceSlaForecastingWorkspace from './GrievanceSlaForecastingWorkspace';
import {
  proposeBottleneckIntervention,
  resetGrievanceSlaStorage,
} from '../services/grievanceSlaForecastingService';
import { BOTTLENECK_STAGES } from '../data/grievanceSlaContract';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Clock: () => <span data-testid="icon-clock" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  ShieldCheck: () => <span data-testid="icon-shield" />,
  TrendingUp: () => <span data-testid="icon-trend" />,
  Sliders: () => <span data-testid="icon-sliders" />,
  Info: () => <span data-testid="icon-info" />,
  Layers: () => <span data-testid="icon-layers" />,
  Activity: () => <span data-testid="icon-activity" />,
  FileText: () => <span data-testid="icon-file" />,
}));

describe('GrievanceSlaForecastingWorkspace Component (#1175)', () => {
  beforeEach(() => {
    resetGrievanceSlaStorage();
  });

  it('renders workspace title and zero-guarantee disclaimer', () => {
    const html = renderToStaticMarkup(<GrievanceSlaForecastingWorkspace />);

    expect(html).toContain('Public Grievance SLA Forecasting &amp; Bottleneck Analytics');
    expect(html).toContain('Zero-Guarantee Principle:');
    expect(html).toContain('Cohort-based empirical turnaround distributions');
  });

  it('renders forecast summary metric cards and prediction intervals', () => {
    const html = renderToStaticMarkup(<GrievanceSlaForecastingWorkspace />);

    expect(html).toContain('Statutory SLA (Target)');
    expect(html).toContain('Predicted Median Duration');
    expect(html).toContain('80% Prediction Interval');
    expect(html).toContain('Breach Risk Probability');
    expect(html).toContain('Cohort Provenance &amp; Sample Disclosures');
  });

  it('renders with existing intervention proposals when present', () => {
    proposeBottleneckIntervention({
      stage: BOTTLENECK_STAGES.FIELD_INSPECTION,
      title: 'Deploy additional junior engineers to Ward 4',
      details: 'Expedite pending inspections',
      recommendedBy: 'AI_BOTTLENECK_ENGINE',
    });

    const html = renderToStaticMarkup(<GrievanceSlaForecastingWorkspace />);
    expect(html).toContain('Human Approval &amp; Actions (1)');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AiEvaluationSuitePanel from './AiEvaluationSuitePanel.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';

const renderPanel = () => {
  return renderToStaticMarkup(
    <ToastProvider>
      <AiEvaluationSuitePanel />
    </ToastProvider>
  );
};

describe('AiEvaluationSuitePanel (#406)', () => {
  it('renders evaluation suite header, metrics cards, and benchmark controls', () => {
    const html = renderPanel();
    expect(html).toContain('AI Grounding &amp; Hallucination Evaluation Suite');
    expect(html).toContain('TEST PASS RATE');
    expect(html).toContain('AVG GROUNDING SCORE');
    expect(html).toContain('HALLUCINATIONS DETECTED');
    expect(html).toContain('BENCHMARK DOMAINS');
    expect(html).toContain('Run Standard Benchmark');
    expect(html).toContain('Test Hallucination Detection');
    expect(html).toContain('Copy Report');
    expect(html).toContain('JSON');
  });

  it('renders benchmark cases with domain badges and status indicators', () => {
    const html = renderPanel();
    expect(html).toContain('BM-VOTER-01');
    expect(html).toContain('Electoral Services');
    expect(html).toContain('What is the minimum age to apply for a new Voter ID card');
    expect(html).toContain('BM-PENSION-02');
    expect(html).toContain('BM-ADVERSARIAL-FABRICATED-05');
  });
});

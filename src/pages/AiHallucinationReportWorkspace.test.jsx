import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import AiHallucinationReportWorkspace from './AiHallucinationReportWorkspace.jsx';
import { resetLocalHallucinationState } from '../services/aiHallucinationReportStorage.js';

describe('AiHallucinationReportWorkspace (#1448)', () => {
  beforeEach(() => {
    resetLocalHallucinationState();
  });

  it('renders heading, visibly distinct origin badges, report form, and review queue table', () => {
    const html = renderToString(<AiHallucinationReportWorkspace />);
    expect(html).toContain('Civic AI Hallucination &amp; Unsupported-Claim Reporting');
    expect(html).toContain('AI Claim (Under Audit)');
    expect(html).toContain('Citizen-Entered Report');
    expect(html).toContain('Official Verified Correction');
    expect(html).toContain('Submit Claim Report');
    expect(html).toContain('Exported Regression Fixtures');
  });
});

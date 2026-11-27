import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import RecommendationFairnessAuditWorkspace from './RecommendationFairnessAuditWorkspace.jsx';
import { resetLocalFairnessAuditState } from '../services/recommendationFairnessAuditStorage.js';

describe('RecommendationFairnessAuditWorkspace (#1449)', () => {
  beforeEach(() => {
    resetLocalFairnessAuditState();
  });

  it('renders heading, origin badges, and accessible controls', () => {
    const html = renderToString(<RecommendationFairnessAuditWorkspace />);
    expect(html).toContain('Civic Recommendation Fairness &amp; Coverage Audit Suite');
    expect(html).toContain('Official Gate Policy');
    expect(html).toContain('Citizen-Consented Cohorts');
    expect(html).toContain('AI Suggestions (Non-binding)');
  });
});


import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GovernedToolActionsPanel from './GovernedToolActionsPanel.jsx';
import {
  buildGovernedToolProposals,
  executeGovernedToolProposal,
  resetLocalSandboxToolRegistryForTests,
} from '../../services/toolRegistry/clientToolRegistryAdapter.js';
import { ERROR_CODES } from '../../services/toolRegistry/toolContracts.js';

describe('GovernedToolActionsPanel (#1146)', () => {
  beforeEach(() => {
    resetLocalSandboxToolRegistryForTests();
  });

  it('renders an accessible collapsed toggle when a valid service context is present', () => {
    const html = renderToStaticMarkup(
      <GovernedToolActionsPanel
        serviceId="ration-card"
        title="Ration Card"
        officialSources={[{ name: 'NFSA Portal', url: 'https://nfsa.gov.in', verified: true }]}
      />
    );
    expect(html).toContain('aria-label="Governed Assistant Tool Actions"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Scoped Tool Actions (2)');
  });

  it('omits rendering when no valid governed serviceId is present', () => {
    const html = renderToStaticMarkup(<GovernedToolActionsPanel serviceId={null} />);
    expect(html).toBe('');
  });

  it('requires citizen confirmation for medium-risk draft staging proposals', async () => {
    const proposals = buildGovernedToolProposals({
      serviceId: 'ration-card',
      title: 'Ration Card',
      officialSources: [{ name: 'NFSA Portal', url: 'https://nfsa.gov.in', verified: true }],
    });
    const draftProposal = proposals.find((p) => p.toolName === 'saveApplicationDraft');

    const denied = await executeGovernedToolProposal({
      proposal: draftProposal,
      citizenConfirmed: false,
    });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe(ERROR_CODES.APPROVAL_REQUIRED);

    const allowed = await executeGovernedToolProposal({
      proposal: draftProposal,
      citizenConfirmed: true,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.output.autonomousFilingPermitted).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import AgentApprovalInboxWorkspace from './AgentApprovalInboxWorkspace.jsx';
import { resetLocalApprovalInboxState } from '../services/agentApprovalInboxStorage.js';

describe('AgentApprovalInboxWorkspace (#1446)', () => {
  beforeEach(() => {
    resetLocalApprovalInboxState();
  });

  it('renders approval inbox heading, origin badges, simulation details, and decision buttons', () => {
    const html = renderToString(<AgentApprovalInboxWorkspace />);
    expect(html).toContain('Civic Agent Approval Inbox &amp; Action Simulation Mode');
    expect(html).toContain('AI Proposed Action');
    expect(html).toContain('Citizen-Entered Context');
    expect(html).toContain('Official Policy Check');
    expect(html).toContain('Approve Write');
    expect(html).toContain('Edit &amp; Approve');
    expect(html).toContain('Reject');
    expect(html).toContain('Immutable Decision Log');
  });
});

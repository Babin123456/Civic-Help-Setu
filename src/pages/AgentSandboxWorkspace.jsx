/**
 * src/pages/AgentSandboxWorkspace.jsx
 *
 * Page for the Secure Agent Sandbox (#1179).
 * Accessible at /agent-sandbox.
 */

import AgentSandboxWorkspace from '../components/agentSandbox/AgentSandboxWorkspace';

export default function AgentSandboxWorkspacePage() {
  return (
    <div className="section">
      <div className="container">
        <AgentSandboxWorkspace />
      </div>
    </div>
  );
}

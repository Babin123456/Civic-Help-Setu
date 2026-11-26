/**
 * src/pages/PolicyEngineWorkspace.jsx
 *
 * Page for the Civic Agent Workflow Policy-as-Code Engine (#1187).
 * Accessible at /policy-engine.
 */

import PolicyEngineWorkspace from '../components/policyEngine/PolicyEngineWorkspace';

export default function PolicyEngineWorkspacePage() {
  return (
    <div className="section">
      <div className="container">
        <PolicyEngineWorkspace />
      </div>
    </div>
  );
}

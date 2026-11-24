/**
 * src/pages/ServiceChangeSandboxWorkspace.jsx
 *
 * Page for the Civic Case Collaboration Space (#1183).
 * Accessible at /case-collaboration.
 */

import CaseCollaborationWorkspace from '../components/caseCollaboration/CaseCollaborationWorkspace';
 * Page for the Civic Service Change Sandbox with Shadow Traffic Evaluation
 * (#1181). Accessible at /service-change-sandbox.
 */

import ServiceChangeSandboxWorkspace from '../components/serviceChangeSandbox/ServiceChangeSandboxWorkspace';

export default function ServiceChangeSandboxWorkspacePage() {
  return (
    <div className="section">
      <div className="container">
        <CaseCollaborationWorkspace />
        <ServiceChangeSandboxWorkspace />
      </div>
    </div>
  );
}

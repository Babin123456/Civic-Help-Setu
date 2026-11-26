/**
 * src/pages/PolicySimulationWorkspace.jsx
 *
 * Page for the Agent-Based Civic Policy Scenario Simulator (#1176).
 * Accessible at /policy-simulation and /services/:serviceId/policy-simulation.
 */

import { useParams } from 'react-router-dom';
import PolicySimulationWorkspace from '../components/policySimulation/PolicySimulationWorkspace';

export default function PolicySimulationWorkspacePage() {
  const { serviceId } = useParams();

  // The workspace loads its catalogue from the API. A serviceId from the URL
  // can pre-filter services in a future enhancement; for now it is accepted for
  // route parity with other service-scoped workspaces.
  return (
    <div className="section">
      <div className="container">
        {serviceId && (
          <nav style={{ marginBottom: '1rem' }}>
            <a
              href="/policy-simulation"
              style={{ marginRight: '0.5rem', fontSize: '0.92rem' }}
              aria-label="Back to policy simulator catalogue"
            >
              ← All scenarios
            </a>
          </nav>
        )}
        <PolicySimulationWorkspace />
      </div>
    </div>
  );
}

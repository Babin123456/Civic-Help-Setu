/**
 * src/pages/CostCarbonGovernorWorkspace.jsx
 *
 * Page for the Civic Agent Cost and Carbon Budget Governor (#1185).
 * Accessible at /cost-carbon-governor.
 */

import CostCarbonGovernorWorkspace from '../components/costCarbonGovernor/CostCarbonGovernorWorkspace';

export default function CostCarbonGovernorWorkspacePage() {
  return (
    <div className="section">
      <div className="container">
        <CostCarbonGovernorWorkspace />
      </div>
    </div>
  );
}

/**
 * src/components/policySimulation/SimulationResults.jsx
 *
 * Renders aggregate simulation results: totals, by-service, by-office and
 * by-persona tables. Aggregate-only — no individual prediction.
 */

import {
  TrendingUp,
  Users,
  Building2,
  MapPin,
  Activity,
  Info,
} from 'lucide-react';

export function SimulationResults({ result }) {
  const { totals, byService, byOffice, byPersona, scenario, reproducibilityDigest, disclaimer } = result;

  return (
    <section className="sim-results" aria-label="Simulation results">
      <div className="results-card">
        <header className="results-header">
          <h2>
            <TrendingUp aria-hidden="true" /> {scenario.title}
          </h2>
          <p className="results-meta">
            Data version: {result.dataVersion} &bull; Reproducibility:
            {reproducibilityDigest} &bull; Aggregate only &mdash; no individual prediction
          </p>
        </header>

        <div className="results-totals" aria-label="Aggregate totals">
          <h3>Aggregate totals</h3>
          <div className="totals-grid">
            <TotalsCard label="Estimated daily demand" value={totals.estimatedDailyDemand} suffix=" applications" icon={<Activity aria-hidden="true" />} />
            <TotalsCard label="Estimated daily in-person visits" value={totals.estimatedDailyInPersonVisits} suffix=" visits" icon={<Users aria-hidden="true" />} />
            <TotalsCard label="Estimated daily online demand" value={totals.estimatedDailyOnlineDemand} suffix=" applications" icon={<Building2 aria-hidden="true" />} />
            <TotalsCard label="Estimated daily travel minutes" value={totals.estimatedDailyTravelMinutes} suffix=" minutes" icon={<MapPin aria-hidden="true" />} />
            <TotalsCard label="Average document burden" value={totals.averageDocumentBurden} suffix=" (0-1)" icon={<Info aria-hidden="true" />} />
          </div>
        </div>

        <h3 className="results-sub">By service</h3>
        <div className="results-table-wrap">
          <table aria-label="Service-level simulation results">
            <caption>Estimated demand, visits, travel and document burden per service.</caption>
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th>Daily demand</th>
                <th>In-person visits</th>
                <th>Online demand</th>
                <th>Travel min/day</th>
                <th>Doc burden</th>
              </tr>
            </thead>
            <tbody>
              {byService.map((row) => (
                <tr key={row.serviceId}>
                  <td>{row.serviceName}</td>
                  <td>{row.category}</td>
                  <td>{row.estimatedDailyDemand}</td>
                  <td>{row.estimatedDailyInPersonVisits}</td>
                  <td>{row.estimatedDailyOnlineDemand}</td>
                  <td>{row.estimatedDailyTravelMinutes}</td>
                  <td>{row.averageDocumentBurden}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="results-sub">By office</h3>
        <div className="results-table-wrap">
          <table aria-label="Office-level travel and capacity results">
            <caption>Travel minutes and capacity multiplier per office.</caption>
            <thead>
              <tr>
                <th>Office</th>
                <th>Base travel (min)</th>
                <th>Adjusted travel (min)</th>
                <th>Travel reduction (min)</th>
                <th>Capacity multiplier</th>
              </tr>
            </thead>
            <tbody>
              {byOffice.map((row) => (
                <tr key={row.officeId}>
                  <td>{row.officeName}</td>
                  <td>{row.baseTravelMinutes}</td>
                  <td>{row.adjustedTravelMinutes}</td>
                  <td>{row.travelMinutesReduction}</td>
                  <td>{row.capacityMultiplier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="results-sub">By persona archetype (aggregate only)</h3>
        <div className="results-table-wrap">
          <table aria-label="Persona archetype aggregate results">
            <caption>Archetype-level averages. Not an individual prediction or citizen record.</caption>
            <thead>
              <tr>
                <th>Archetype</th>
                <th>Label</th>
                <th>Estimated demand</th>
                <th>Avg travel (min)</th>
                <th>Avg doc burden</th>
              </tr>
            </thead>
            <tbody>
              {byPersona.map((row) => (
                <tr key={row.personaId}>
                  <td>{row.archetype}</td>
                  <td>{row.label}</td>
                  <td>{row.estimatedDemand}</td>
                  <td>{row.averageTravelMinutes}</td>
                  <td>{row.averageDocumentBurden}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="results-disclaimer">{disclaimer}</p>
      </div>
    </section>
  );
}

function TotalsCard({ label, value, suffix, icon }) {
  return (
    <div className="totals-card">
      <div className="totals-card-icon" aria-hidden="true">{icon}</div>
      <div className="totals-card-body">
        <p className="totals-card-label">{label}</p>
        <p className="totals-card-value">{value}{suffix}</p>
      </div>
    </div>
  );
}

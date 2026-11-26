/**
 * src/components/policySimulation/PolicySimulationWorkspace.jsx
 *
 * Main container for the Agent-Based Civic Policy Scenario Simulator.
 * Wires scenario selection, simulation (via API), results and sensitivity.
 * Accessible, mobile-first; no PII is collected or logged.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  PolicySimulationLoading,
  PolicySimulationEmpty,
  PolicySimulationError,
  PolicySimulationStale,
} from './PolicySimulationStates';
import { ScenarioSelector } from './ScenarioSelector';
import { SimulationResults } from './SimulationResults';
import { SensitivityPanel } from './SensitivityPanel';
import { listScenarios } from '../../data/civicPolicySimulationData.js';

const API_BASE = '/api/policy-simulation';

export default function PolicySimulationWorkspace() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const role = user?.role || 'guest';

  const [catalogue, setCatalogue] = useState(null);
  const [catalogueError, setCatalogueError] = useState(null);

  const [simulation, setSimulation] = useState(null);
  const [simError, setSimError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [staleNotice, setStaleNotice] = useState(null);

  const abortRef = useRef(null);

  const baseline = listScenarios().find((s) => s.id === 'scenario-baseline');
  const defaultScenarioId = baseline ? baseline.id : listScenarios()[0]?.id || null;

  // Initialize parameters from the baseline scenario (synchronous, synthetic data).
  const [parameters, setParameters] = useState(() => {
    const scenario = listScenarios().find((s) => s.id === defaultScenarioId) || null;
    return {
      scenarioId: defaultScenarioId,
      personaIds: (scenario?.personaIds || []).slice(),
      serviceIds: (scenario?.serviceIds || []).slice(),
      officeIds: (scenario?.officeIds || []).slice(),
      leverIds: (scenario?.leverIds || []).slice(),
      dayCount: 30,
    };
  });

  // Load the public catalogue on mount.
  const loadCatalogue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}?action=catalogue`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load catalogue');
      const data = await res.json();
      setCatalogue(data.ok ? data : null);
      if (!data.ok) setCatalogueError(data.error || 'Unknown catalogue error');
    } catch (error) {
      setCatalogueError(error.message);
    }
  }, []);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const handleParametersChange = useCallback((next) => {
    setParameters(next);
    setSimulation(null);
    setSimError(null);
  }, []);

  const runSimulation = useCallback(async () => {
    if (!parameters.scenarioId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSimulating(true);
    setSimError(null);
    setStaleNotice(null);

    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate', ...parameters }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Simulation failed');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Simulation returned no result');
      setSimulation(data.simulation);
      if (data.simulation.isStale) {
        setStaleNotice(data.simulation.uncertainty.message);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      setSimError(error.message);
      addToast({ type: 'error', message: error.message });
    } finally {
      setSimulating(false);
    }
  }, [parameters, addToast]);

  const handleSave = useCallback(async () => {
    if (role === 'guest') {
      addToast({ type: 'info', message: 'Sign in to save a named scenario configuration.' });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-scenario', scenarioId: parameters.scenarioId, name: `Saved ${parameters.scenarioId}`, parameters }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      if (data.ok) addToast({ type: 'success', message: 'Scenario configuration saved.' });
    } catch (error) {
      addToast({ type: 'error', message: error.message });
    }
  }, [parameters, role, addToast]);

  // Render states
  if (catalogue === null && !catalogueError) {
    return <PolicySimulationLoading />;
  }
  if (catalogueError) {
    return <PolicySimulationError message={catalogueError} onRetry={loadCatalogue} />;
  }
  if (!parameters.scenarioId) {
    return <PolicySimulationEmpty />;
  }
  if (simulating) {
    return <PolicySimulationLoading />;
  }
  if (simError) {
    return <PolicySimulationError message={simError} onRetry={runSimulation} />;
  }

  return (
    <section className="policy-simulation-workspace" aria-label="Agent-based civic policy scenario simulator">
      <div className="container">
        <header className="workspace-header">
          <h1 className="workspace-title">
            Policy Scenario Simulator
          </h1>
          <p className="workspace-subtitle">
            Agent-based, synthetic-persona simulation of how policy changes could
            affect service demand, travel burden and document requirements.
          </p>
        </header>

        {staleNotice && <PolicySimulationStale notice={staleNotice} />}

        <div className="workspace-body">
          <aside className="workspace-sidebar">
            <ScenarioSelector
              scenarios={catalogue.scenarios}
              personas={catalogue.personas}
              services={catalogue.services}
              offices={catalogue.offices}
              levers={catalogue.levers}
              onParametersChange={handleParametersChange}
              defaultScenarioId={defaultScenarioId}
            />
            {simulation && (
              <div className="sidebar-actions">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={handleSave}
                  disabled={role === 'guest'}
                  title={role === 'guest' ? 'Sign in to save' : 'Save this scenario configuration'}
                >
                  Save configuration
                </button>
              </div>
            )}
          </aside>

          <main className="workspace-main">
            {simulation ? (
              <>
                <SimulationResults result={simulation} />
                <SensitivityPanel result={simulation} />
              </>
            ) : (
              <PolicySimulationEmpty />
            )}
          </main>
        </div>

        <footer className="workspace-footer">
          <p className="workspace-disclaimer">
            Illustrative agent-based scenario output. Synthetic personas only.
            Does not predict individual outcomes, claim official verification, or
            autonomously file or deny any application. Confirm policy changes with
            the relevant authority before rollout.
          </p>
        </footer>
      </div>
    </section>
  );
}

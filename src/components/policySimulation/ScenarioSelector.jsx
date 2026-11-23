/**
 * src/components/policySimulation/ScenarioSelector.jsx
 *
 * Scenario and parameter selection for the policy simulation workspace.
 * Emits the chosen parameters to the parent. Accessible, mobile-first.
 */

import { useState, useCallback } from 'react';
import {
  ArrowRight,
  Users,
  Building2,
  List,
} from 'lucide-react';

export function ScenarioSelector({
  scenarios,
  personas,
  services,
  offices,
  levers,
  onParametersChange,
  defaultScenarioId,
}) {
  const [scenarioId, setScenarioId] = useState(defaultScenarioId || (scenarios[0]?.id || null));
  const [selectedPersonaIds, setSelectedPersonaIds] = useState(
    (scenarios.find((s) => s.id === scenarioId)?.personaIds || personas.map((p) => p.id)).slice()
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState(
    (scenarios.find((s) => s.id === scenarioId)?.serviceIds || services.map((s) => s.id)).slice()
  );
  const [selectedOfficeIds, setSelectedOfficeIds] = useState(
    (scenarios.find((s) => s.id === scenarioId)?.officeIds || offices.map((o) => o.id)).slice()
  );
  const [selectedLeverIds, setSelectedLeverIds] = useState(
    (scenarios.find((s) => s.id === scenarioId)?.leverIds || []).slice()
  );
  const [dayCount, setDayCount] = useState(30);

  const scenario = scenarios.find((s) => s.id === scenarioId) || null;

  const handleScenarioChange = useCallback((id) => {
    setScenarioId(id);
    const s = scenarios.find((x) => x.id === id) || null;
    setSelectedPersonaIds((s?.personaIds || personas.map((p) => p.id)).slice());
    setSelectedServiceIds((s?.serviceIds || services.map((x) => x.id)).slice());
    setSelectedOfficeIds((s?.officeIds || offices.map((x) => x.id)).slice());
    setSelectedLeverIds((s?.leverIds || []).slice());
  }, [scenarios, personas, services, offices]);

  const toggleSelection = useCallback((setter, current, id) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const notify = useCallback(() => {
    onParametersChange({
      scenarioId,
      personaIds: selectedPersonaIds,
      serviceIds: selectedServiceIds,
      officeIds: selectedOfficeIds,
      leverIds: selectedLeverIds,
      dayCount,
    });
  }, [scenarioId, selectedPersonaIds, selectedServiceIds, selectedOfficeIds, selectedLeverIds, dayCount, onParametersChange]);

  return (
    <section className="sim-selector" aria-label="Scenario configuration">
      <div className="selector-card">
        <h2 className="selector-title">Configure scenario</h2>

        <div className="selector-field">
          <label htmlFor="sim-scenario">Scenario</label>
          <select
            id="sim-scenario"
            value={scenarioId}
            onChange={(e) => { handleScenarioChange(e.target.value); notify(); }}
            aria-describedby="sim-scenario-desc"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {scenario && (
            <p id="sim-scenario-desc" className="selector-hint">
              {scenario.description}
            </p>
          )}
        </div>

        <div className="selector-grid">
          <MultiSelect
            label="Personas (synthetic archetypes)"
            id="sim-personas"
            items={personas}
            value={selectedPersonaIds}
            onChange={(id) => { toggleSelection(setSelectedPersonaIds, selectedPersonaIds, id); notify(); }}
            icon={<Users aria-hidden="true" />}
            emptyText="Select at least one persona"
          />
          <MultiSelect
            label="Services"
            id="sim-services"
            items={services}
            value={selectedServiceIds}
            onChange={(id) => { toggleSelection(setSelectedServiceIds, selectedServiceIds, id); notify(); }}
            icon={<Building2 aria-hidden="true" />}
            emptyText="Select at least one service"
          />
          <MultiSelect
            label="Offices / facilitation centres"
            id="sim-offices"
            items={offices}
            value={selectedOfficeIds}
            onChange={(id) => { toggleSelection(setSelectedOfficeIds, selectedOfficeIds, id); notify(); }}
            icon={<List aria-hidden="true" />}
            emptyText="Select at least one office"
          />
        </div>

        <div className="selector-field">
          <label htmlFor="sim-levers">Policy levers (toggle on)</label>
          <div className="lever-chips" role="group" aria-label="Policy levers">
            {levers.map((lever) => {
              const active = selectedLeverIds.includes(lever.id);
              return (
                <button
                  key={lever.id}
                  type="button"
                  className={`lever-chip ${active ? 'active' : ''}`}
                  onClick={() => {
                    toggleSelection(setSelectedLeverIds, selectedLeverIds, lever.id);
                    notify();
                  }}
                  aria-pressed={active}
                  title={lever.description}
                >
                  <span className="lever-chip-label">{lever.label}</span>
                  {active && <span className="lever-chip-on" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
          <p className="selector-hint">
            Levers are deterministic rules. Each one carries a risk note; review
            it before relying on the result.
          </p>
        </div>

        <div className="selector-field selector-inline">
          <label htmlFor="sim-days">Simulation window (days)</label>
          <input
            id="sim-days"
            type="number"
            min="1"
            max="365"
            value={dayCount}
            onChange={(e) => {
              const v = Math.max(1, Math.min(365, Number(e.target.value) || 1));
              setDayCount(v);
              notify();
            }}
          />
          <span className="selector-hint">How many days of aggregate demand to model.</span>
        </div>

        <div className="selector-actions">
          <button className="btn btn-primary" type="button" onClick={notify} aria-label="Run simulation">
            <ArrowRight aria-hidden="true" /> Run simulation
          </button>
        </div>
      </div>
    </section>
  );
}

function MultiSelect({ label, items, value, onChange, icon, emptyText }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="multiselect" aria-label={label}>
      <button
        type="button"
        className={`multiselect-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {icon}
        <span className="multiselect-label">{label}</span>
        <span className="multiselect-count">{value.length} of {items.length}</span>
      </button>
      {open && (
        <div className="multiselect-list" role="listbox">
          {items.length === 0 && <div role="option" aria-disabled="true">{emptyText}</div>}
          {items.map((item) => {
            const active = value.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`multiselect-option ${active ? 'selected' : ''}`}
                onClick={() => onChange(item.id)}
              >
                <span className="multiselect-option-name">{item.label || item.name}</span>
                {active && <span className="multiselect-option-on" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

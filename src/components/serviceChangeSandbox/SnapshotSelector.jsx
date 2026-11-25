/**
 * src/components/serviceChangeSandbox/SnapshotSelector.jsx
 *
 * Snapshot, journey pattern and replay configuration for the service change
 * sandbox. Emits the chosen parameters to the parent. Accessible, mobile-first.
 */

import { useState, useCallback } from 'react';
import { Clock, List, Database, RefreshCw, Users } from 'lucide-react';

export function SnapshotSelector({
  snapshots,
  serviceVersions,
  journeyPatterns,
  onParametersChange,
  defaultSnapshotId
}) {
  const [snapshotId, setSnapshotId] = useState(defaultSnapshotId || (snapshots[0]?.id || null));
  const [selectedJourneyPatternIds, setSelectedJourneyPatternIds] = useState(
    (snapshots.find((s) => s.id === snapshotId) || snapshots[0])?.id
      ? journeyPatterns.map((j) => j.id).slice()
      : []
  );
  const [replayCount, setReplayCount] = useState(1000);
  const [seed, setSeed] = useState(null);

  const snapshot = snapshots.find((s) => s.id === snapshotId) || null;
  const fromVersion = serviceVersions.find((v) => v.id === snapshot?.fromVersionId) || null;
  const toVersion = serviceVersions.find((v) => v.id === snapshot?.toVersionId) || null;

  const togglePattern = useCallback((id) => {
    setSelectedJourneyPatternIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const notify = useCallback(() => {
    onParametersChange({
      snapshotId,
      journeyPatternIds: selectedJourneyPatternIds,
      replayCount,
      seed: seed ? Number(seed) : null
    });
  }, [snapshotId, selectedJourneyPatternIds, replayCount, seed, onParametersChange]);

  return (
    <section className="scs-selector" aria-label="Snapshot configuration">
      <div className="selector-card">
        <h2 className="selector-title">Configure shadow-traffic run</h2>

        <div className="selector-field">
          <List aria-hidden="true" />
          <label htmlFor="scs-snapshot">Staging snapshot</label>
          <select
            id="scs-snapshot"
            value={snapshotId}
            onChange={(e) => { setSnapshotId(e.target.value); notify(); }}
            aria-describedby="scs-snapshot-desc"
          >
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} — {s.status}
              </option>
            ))}
          </select>
          {snapshot && (
            <p id="scs-snapshot-desc" className="selector-hint">
              {snapshot.description}
              {snapshot.productionWriteBlocked ? ' • Production writes blocked during this shadow run.' : ''}
            </p>
          )}
        </div>

        <div className="selector-grid">
          <div className="selector-field">
            <Database aria-hidden="true" />
            <label htmlFor="scs-from-version">Baseline service version</label>
            <select id="scs-from-version" disabled>
              <option value={fromVersion?.id || 'none'}>{fromVersion?.serviceName || '—'} ({fromVersion?.version || '—'})</option>
            </select>
          </div>
          <div className="selector-field">
            <RefreshCw aria-hidden="true" />
            <label htmlFor="scs-to-version">Proposed service version</label>
            <select id="scs-to-version" disabled>
              <option value={toVersion?.id || 'none'}>{toVersion?.serviceName || '—'} ({toVersion?.version || '—'})</option>
            </select>
          </div>
        </div>

        <div className="selector-field">
          <label htmlFor="scs-patterns">Journey patterns to replay</label>
          <div className="pattern-chips" role="group" aria-label="Journey patterns">
            {journeyPatterns.map((pattern) => {
              const active = selectedJourneyPatternIds.includes(pattern.id);
              return (
                <button
                  key={pattern.id}
                  type="button"
                  className={`pattern-chip ${active ? 'active' : ''}`}
                  onClick={() => { togglePattern(pattern.id); notify(); }}
                  aria-pressed={active}
                  title={pattern.label}
                >
                  <span className="pattern-chip-label">{pattern.label}</span>
                  {active && <span className="pattern-chip-on" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
          <p className="selector-hint">
            Synthetic journey patterns only. No citizen data is replayed.
          </p>
        </div>

        <div className="selector-field selector-inline">
          <label htmlFor="scs-replay">Replay count</label>
          <input
            id="scs-replay"
            type="number"
            min="1"
            max="100000"
            value={replayCount}
            onChange={(e) => {
              const v = Math.max(1, Math.min(100000, Number(e.target.value) || 1));
              setReplayCount(v);
              notify();
            }}
          />
          <span className="selector-hint">How many synthetic journeys to replay per pattern.</span>
        </div>

        <div className="selector-field selector-inline">
          <label htmlFor="scs-seed">Deterministic seed</label>
          <input
            id="scs-seed"
            type="number"
            value={seed ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value) || null;
              setSeed(v);
              notify();
            }}
          />
          <span className="selector-hint">Same seed always reproduces the same comparison. Leave blank for the snapshot's default seed.</span>
        </div>

        <div className="selector-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={notify}
            disabled={!snapshotId || selectedJourneyPatternIds.length === 0}
            aria-label="Run shadow traffic"
          >
            <Clock aria-hidden="true" /> Run shadow traffic
          </button>
        </div>

        <div className="selector-risk">
          <Users aria-hidden="true" />
          <strong>Shadow traffic never writes to production.</strong> Results are
          illustrative and untrusted. Publishing or rolling back requires explicit
          human approval.
        </div>
      </div>
    </section>
  );
}

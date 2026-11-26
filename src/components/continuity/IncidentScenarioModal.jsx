import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { SCENARIO_CATEGORIES } from '../../services/continuityPlannerService';

export const IncidentScenarioModal = ({ isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(SCENARIO_CATEGORIES.INFRASTRUCTURE_FAILURE);
  const [severity, setSeverity] = useState('HIGH');
  const [narrative, setNarrative] = useState('');
  const [injects, setInjects] = useState([
    {
      timeOffsetMinutes: 0,
      title: 'Initial Detection & Alert',
      eventDescription: 'First alert received from ground monitoring unit regarding major service disruption.',
      expectedDecisions: 'Isolate affected sector, Invoke emergency duty roster',
      requiredPersonnel: 'Incident Commander, Duty Engineer',
    },
    {
      timeOffsetMinutes: 30,
      title: 'Escalation & Public Notice',
      eventDescription: 'Secondary backup systems experience delay; citizens begin calling helplines.',
      expectedDecisions: 'Issue public broadcast, Deploy mobile backup unit',
      requiredPersonnel: 'Public Relations Officer, Ward Officer',
    },
  ]);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleAddInject = () => {
    setInjects((prev) => [
      ...prev,
      {
        timeOffsetMinutes: prev.length > 0 ? prev[prev.length - 1].timeOffsetMinutes + 30 : 0,
        title: `Inject Step ${prev.length + 1}`,
        eventDescription: '',
        expectedDecisions: '',
        requiredPersonnel: '',
      },
    ]);
  };

  const handleUpdateInject = (index, field, value) => {
    setInjects((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveInject = (index) => {
    setInjects((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Scenario title is required');
      return;
    }

    try {
      onSave({
        title: title.trim(),
        category,
        severity,
        narrative: narrative.trim(),
        timelineInjects: injects.map((inj) => ({
          timeOffsetMinutes: Number(inj.timeOffsetMinutes) || 0,
          title: inj.title.trim(),
          eventDescription: inj.eventDescription.trim(),
          expectedDecisions: typeof inj.expectedDecisions === 'string'
            ? inj.expectedDecisions.split(',').map((s) => s.trim()).filter(Boolean)
            : inj.expectedDecisions,
          requiredPersonnel: typeof inj.requiredPersonnel === 'string'
            ? inj.requiredPersonnel.split(',').map((s) => s.trim()).filter(Boolean)
            : inj.requiredPersonnel,
        })),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save scenario template');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="scenario-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>
            Create Custom Incident Drill Scenario
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.6rem 0.85rem', borderRadius: '0.4rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
            Scenario Title:
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ward 4 Main Water Pipeline Rupture & Contamination"
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
              Category:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value={SCENARIO_CATEGORIES.INFRASTRUCTURE_FAILURE}>Infrastructure Failure</option>
              <option value={SCENARIO_CATEGORIES.CYBER_ATTACK}>Cyber Incident / Ransomware</option>
              <option value={SCENARIO_CATEGORIES.SEVERE_WEATHER}>Severe Weather / Monsoon Flooding</option>
              <option value={SCENARIO_CATEGORIES.OFFICE_SYSTEM_OUTAGE}>Office System Outage</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
              Severity Level:
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CATASTROPHIC">Catastrophic</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
            Incident Narrative Context:
          </label>
          <textarea
            rows="3"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="Detailed description of the incident origin, weather conditions, initial casualties or infrastructure loss..."
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          />
        </div>

        {/* TIMELINE INJECTS BUILDER */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>
              Timeline Injects Sequence ({injects.length} Injects)
            </label>
            <button
              type="button"
              onClick={handleAddInject}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
            >
              <Plus size={13} />
              <span>Add Inject</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {injects.map((inj, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.65rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-main)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-main)' }}>
                    Inject Step #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInject(idx)}
                    disabled={injects.length <= 1}
                    aria-label="Remove inject"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    placeholder="T+ Mins"
                    value={inj.timeOffsetMinutes}
                    onChange={(e) => handleUpdateInject(idx, 'timeOffsetMinutes', e.target.value)}
                    style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                  />
                  <input
                    type="text"
                    placeholder="Inject Title (e.g. Pressure Drops to Zero)"
                    value={inj.title}
                    onChange={(e) => handleUpdateInject(idx, 'title', e.target.value)}
                    style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                  />
                </div>

                <textarea
                  rows="2"
                  placeholder="Event description presented to officers during drill..."
                  value={inj.eventDescription}
                  onChange={(e) => handleUpdateInject(idx, 'eventDescription', e.target.value)}
                  style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            Save Scenario
          </button>
        </div>
      </form>
    </div>
  );
};

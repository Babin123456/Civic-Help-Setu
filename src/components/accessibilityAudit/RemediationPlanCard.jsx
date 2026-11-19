import { useState } from 'react';
import {
  Wrench,
  Calendar,
  CheckCircle,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';

export default function RemediationPlanCard({
  plan = [],
  onPlanChange,
  readOnly = false,
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newAction, setNewAction] = useState('');
  const [newPriority, setNewPriority] = useState('HIGH');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleStatusChange = (index, status) => {
    if (readOnly || !onPlanChange) return;
    const updated = [...plan];
    updated[index] = { ...updated[index], status };
    onPlanChange(updated);
  };

  const handleDateChange = (index, targetDate) => {
    if (readOnly || !onPlanChange) return;
    const updated = [...plan];
    updated[index] = { ...updated[index], targetDate };
    onPlanChange(updated);
  };

  const handleResponsibleChange = (index, responsibleParty) => {
    if (readOnly || !onPlanChange) return;
    const updated = [...plan];
    updated[index] = { ...updated[index], responsibleParty };
    onPlanChange(updated);
  };

  const handleRemoveItem = (index) => {
    if (readOnly || !onPlanChange) return;
    const updated = plan.filter((_, idx) => idx !== index);
    onPlanChange(updated);
  };

  const handleAddCustomBarrier = () => {
    if (!newLabel.trim()) return;
    const targetDays = newPriority === 'CRITICAL' ? 30 : 60;
    const targetDate = new Date(Date.now() + targetDays * 86400000).toISOString().split('T')[0];

    const newItem = {
      id: `custom_${Date.now()}`,
      key: `custom_${Date.now()}`,
      facility: 'General Facility',
      label: newLabel.trim(),
      measuredValue: null,
      unit: '',
      benchmarkDisplay: 'Custom Barrier',
      gap: null,
      critical: newPriority === 'CRITICAL',
      priority: newPriority,
      recommendedAction: newAction.trim() || 'Inspect and execute physical remediation',
      targetDays,
      targetDate,
      responsibleParty: 'Facility Maintenance / Engineering Division',
      status: 'IDENTIFIED',
      notes: '',
    };

    onPlanChange([newItem, ...plan]);
    setNewLabel('');
    setNewAction('');
    setShowAddForm(false);
  };

  return (
    <div
      role="region"
      aria-label="Accessibility Barrier Remediation Plan"
      style={{
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wrench size={22} color="#059669" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
            Barrier Remediation Action Plan ({plan.length} items)
          </h3>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #059669',
              background: '#ecfdf5',
              color: '#047857',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Add Custom Barrier
          </button>
        )}
      </div>

      {/* Add Custom Form */}
      {showAddForm && (
        <div
          style={{
            border: '1px solid #bbf7d0',
            background: '#f0fdf4',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#166534' }}>Add Custom Accessibility Barrier</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Barrier description (e.g. Broken pavement curb)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              style={{
                padding: '0.45rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
              }}
            />
            <input
              type="text"
              placeholder="Recommended corrective action"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              style={{
                padding: '0.45rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
              }}
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              style={{
                padding: '0.45rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
              }}
            >
              <option value="CRITICAL">Critical Priority (Immediate Hazard)</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddCustomBarrier}
            style={{
              padding: '0.4rem 0.85rem',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add to Remediation Plan
          </button>
        </div>
      )}

      {plan.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary, #64748b)' }}>
          <CheckCircle size={32} color="#059669" style={{ marginBottom: '0.4rem' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>Zero non-compliant barriers identified.</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem' }}>
            All assessed facility measurements meet Harmonised Guidelines benchmarks.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {plan.map((item, idx) => (
            <div
              key={item.id || idx}
              style={{
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                padding: '0.85rem',
                background: item.priority === 'CRITICAL' ? '#fef2f2' : 'var(--bg-card, #ffffff)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: item.priority === 'CRITICAL' ? '#dc2626' : '#d97706',
                        color: '#ffffff',
                      }}
                    >
                      {item.priority}
                    </span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary, #0f172a)' }}>
                      {item.label}
                    </strong>
                    {item.gap !== null && (
                      <span style={{ fontSize: '0.78rem', color: '#b91c1c', fontWeight: 600 }}>
                        (Gap: {item.gap} {item.unit})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #475569)', marginTop: '0.2rem' }}>
                    <strong>Action:</strong> {item.recommendedAction}
                  </div>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    title="Remove barrier from plan"
                    aria-label={`Remove barrier ${item.label}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              {/* Controls Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.6rem',
                  marginTop: '0.5rem',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary, #475569)', marginBottom: '0.2rem', fontWeight: 600 }}>
                    <Calendar size={13} /> Target Date
                  </label>
                  <input
                    type="date"
                    disabled={readOnly}
                    value={item.targetDate || ''}
                    onChange={(e) => handleDateChange(idx, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.8rem',
                      background: 'var(--bg-input, #ffffff)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary, #475569)', marginBottom: '0.2rem', fontWeight: 600 }}>
                    <UserCheck size={13} /> Responsible Party
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={item.responsibleParty || ''}
                    onChange={(e) => handleResponsibleChange(idx, e.target.value)}
                    placeholder="e.g. PWD Sub-Division"
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.8rem',
                      background: 'var(--bg-input, #ffffff)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary, #475569)', marginBottom: '0.2rem', fontWeight: 600 }}>
                    Remediation Status
                  </label>
                  <select
                    disabled={readOnly}
                    value={item.status || 'IDENTIFIED'}
                    onChange={(e) => handleStatusChange(idx, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.8rem',
                      background: 'var(--bg-input, #ffffff)',
                      fontWeight: 600,
                    }}
                  >
                    <option value="IDENTIFIED">Identified (Baseline)</option>
                    <option value="PLANNED">Planned (Budgeted)</option>
                    <option value="IN_PROGRESS">In Progress (Execution)</option>
                    <option value="REMEDIATED">Remediated (Work Done)</option>
                    <option value="VERIFIED">Verified (Post-Inspection)</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

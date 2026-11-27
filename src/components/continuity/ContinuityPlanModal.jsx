import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { PLAN_STATES } from '../../services/continuityPlannerService';

export const ContinuityPlanModal = ({ isOpen, onClose, onSave, initialPlan = null }) => {
  const [title, setTitle] = useState(initialPlan?.title || '');
  const [jurisdictionId, setJurisdictionId] = useState(initialPlan?.jurisdictionId || 'ward-12-pune');
  const [department, setDepartment] = useState(initialPlan?.department || 'Municipal Administration');
  const [rtoHours, setRtoHours] = useState(initialPlan?.recoveryObjectives?.rtoHours || 4);
  const [rpoHours, setRpoHours] = useState(initialPlan?.recoveryObjectives?.rpoHours || 1);
  const [criticalOps, setCriticalOps] = useState(
    initialPlan?.recoveryObjectives?.criticalOperations?.join('\n') ||
      'Drinking Water Distribution\nEmergency Public Grievance Desk'
  );
  const [alternateFacilities, setAlternateFacilities] = useState(
    initialPlan?.recoveryObjectives?.alternateFacilities?.join('\n') ||
      'Ward 12 Community Bhavan (Backup Diesel Generator)\nDistrict Red Cross Relief Center'
  );

  const [contacts, setContacts] = useState(
    initialPlan?.contactTree?.length > 0
      ? initialPlan.contactTree
      : [
          { role: 'Incident Commander', officerName: 'Chief Duty Officer', phone: '9822011111', email: 'duty.officer@civic.gov.in', priorityOrder: 1 },
        ]
  );

  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleAddContact = () => {
    setContacts((prev) => [
      ...prev,
      { role: 'Operations Officer', officerName: '', phone: '', email: '', priorityOrder: prev.length + 1 },
    ]);
  };

  const handleUpdateContact = (index, field, value) => {
    setContacts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveContact = (index) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      onSave({
        id: initialPlan?.id,
        title: title.trim(),
        jurisdictionId: jurisdictionId.trim(),
        department: department.trim(),
        status: initialPlan?.status || PLAN_STATES.DRAFT,
        recoveryObjectives: {
          rtoHours: Number(rtoHours) || 4,
          rpoHours: Number(rpoHours) || 1,
          criticalOperations: criticalOps.split('\n').map((s) => s.trim()).filter(Boolean),
          alternateFacilities: alternateFacilities.split('\n').map((f) => f.trim()).filter(Boolean),
        },
        contactTree: contacts,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save continuity plan');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
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
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="plan-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>
            {initialPlan ? 'Edit Continuity Plan' : 'Create Public Service Continuity Plan'}
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
          <label style={{ fontSize: '0.85rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
            Plan Title:
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ward 12 Essential Public Services Continuity Plan"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
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
              Jurisdiction ID / Scope:
            </label>
            <input
              type="text"
              required
              value={jurisdictionId}
              onChange={(e) => setJurisdictionId(e.target.value)}
              placeholder="e.g. ward-12-pune"
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
              Responsible Department:
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Public Health & Engineering"
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>
        </div>

        {/* RECOVERY OBJECTIVES */}
        <div style={{ padding: '0.85rem', background: 'var(--glass-bg)', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '700' }}>
            Recovery Objectives (RTO & RPO)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.65rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                Target RTO (Hours to restore):
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={rtoHours}
                onChange={(e) => setRtoHours(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                Target RPO (Max tolerable data loss in hrs):
              </label>
              <input
                type="number"
                min="0"
                max="48"
                value={rpoHours}
                onChange={(e) => setRpoHours(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                Critical Operations (one per line):
              </label>
              <textarea
                rows="2"
                value={criticalOps}
                onChange={(e) => setCriticalOps(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                Alternate Backup Facilities:
              </label>
              <textarea
                rows="2"
                value={alternateFacilities}
                onChange={(e) => setAlternateFacilities(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          </div>
        </div>

        {/* EMERGENCY CONTACT TREE */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>Emergency Escalation Call Tree</label>
            <button
              type="button"
              onClick={handleAddContact}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
            >
              <Plus size={13} />
              <span>Add Officer</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {contacts.map((contact, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.2fr 1fr 1.2fr auto',
                  gap: '0.4rem',
                  alignItems: 'center',
                  background: 'var(--bg-main)',
                  padding: '0.4rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-light)',
                }}
              >
                <input
                  type="text"
                  placeholder="Role (e.g. Commander)"
                  value={contact.role}
                  onChange={(e) => handleUpdateContact(idx, 'role', e.target.value)}
                  style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
                <input
                  type="text"
                  placeholder="Officer Name"
                  value={contact.officerName}
                  onChange={(e) => handleUpdateContact(idx, 'officerName', e.target.value)}
                  style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
                <input
                  type="text"
                  placeholder="Phone"
                  value={contact.phone}
                  onChange={(e) => handleUpdateContact(idx, 'phone', e.target.value)}
                  style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={contact.email}
                  onChange={(e) => handleUpdateContact(idx, 'email', e.target.value)}
                  style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveContact(idx)}
                  disabled={contacts.length <= 1}
                  aria-label="Remove contact"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.2rem' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            Save Plan
          </button>
        </div>
      </form>
    </div>
  );
};

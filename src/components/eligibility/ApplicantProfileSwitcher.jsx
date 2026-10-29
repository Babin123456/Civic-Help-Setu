import { useState, useEffect } from 'react';
import { Users, Plus, Check, Trash2, UserPlus, Sparkles, X } from 'lucide-react';
import { logDiagnostic } from '../../utils/diagnostics';
import {
  getApplicantProfiles,
  getActiveProfileId,
  setActiveProfileId,
  createApplicantProfile,
  deleteApplicantProfile,
  RELATIONSHIP_TYPES,
} from '../../services/applicantProfileService';
import { logDiagnostic } from '../../utils/diagnostics';

export default function ApplicantProfileSwitcher({ onProfileChanged }) {
  const [profiles, setProfiles] = useState(() => getApplicantProfiles());
  const [activeId, setActiveId] = useState(() => getActiveProfileId());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [age, setAge] = useState('60');
  const [employment, setEmployment] = useState('retired');
  const [annualIncome, setAnnualIncome] = useState('150000');
  const [category, setCategory] = useState('General');
  const [formError, setFormError] = useState('');

  const refreshState = () => {
    const freshProfiles = getApplicantProfiles();
    const freshActiveId = getActiveProfileId();
    setProfiles(freshProfiles);
    setActiveId(freshActiveId);
  };

  const handleSelect = (id) => {
    try {
      setActiveProfileId(id);
      setActiveId(id);
      if (onProfileChanged) {
        const selected = profiles.find((p) => p.id === id);
        onProfileChanged(selected);
      }
    } catch (err) {
      logDiagnostic('Could not switch the applicant profile', err);
    }
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setFormError('Please enter applicant name.');
      return;
    }

    try {
      const created = createApplicantProfile({
        name,
        relationship,
        age: Number(age) || 30,
        employment,
        annualIncome: Number(annualIncome) || 0,
        category,
      });

      refreshState();
      setIsAddModalOpen(false);
      setName('');
      if (onProfileChanged) onProfileChanged(created);
    } catch (err) {
      setFormError(err.message || 'Failed to create applicant profile.');
    }
  };

  const handleDelete = (id) => {
    try {
      deleteApplicantProfile(id);
      setConfirmDeleteId(null);
      refreshState();
      if (onProfileChanged) {
        onProfileChanged(getApplicantProfiles()[0]);
      }
    } catch (err) {
      logDiagnostic('Could not update the applicant profiles', err);
    }
  };

  const activeProfile = profiles.find((p) => p.id === activeId) || profiles[0];

  return (
    <div
      className="applicant-profile-switcher"
      style={{
        background: 'var(--card-bg, #1e293b)',
        border: '1px solid var(--border-color, #334155)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
      role="region"
      aria-label="Applicant Profile Selection"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--primary-color, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
              Assessing Eligibility For:
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>
              {activeProfile?.name}{' '}
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '99px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  fontWeight: 500,
                  marginLeft: '0.35rem',
                  textTransform: 'capitalize',
                }}
              >
                {activeProfile?.relationship}
              </span>
            </div>
          </div>
        </div>

        {/* Profile pills & Add button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {profiles.map((prof) => {
            const isSelected = prof.id === activeId;
            return (
              <button
                key={prof.id}
                type="button"
                onClick={() => handleSelect(prof.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '99px',
                  fontSize: '0.85rem',
                  fontWeight: isSelected ? 600 : 500,
                  background: isSelected ? 'var(--primary-color, #3b82f6)' : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected ? '#ffffff' : 'var(--text-main, #cbd5e1)',
                  border: isSelected ? '1px solid var(--primary-color, #3b82f6)' : '1px solid var(--border-color, #475569)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                aria-pressed={isSelected}
              >
                {isSelected && <Check size={14} />}
                <span>{prof.name}</span>
                {prof.id !== 'prof_self' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(prof.id);
                    }}
                    title="Delete profile"
                    style={{
                      opacity: 0.6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete profile ${prof.name}`}
                  >
                    <X size={12} />
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '99px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--primary-color, #60a5fa)',
              border: '1px dashed var(--border-color, #3b82f6)',
              cursor: 'pointer',
            }}
            aria-label="Add family member profile"
          >
            <Plus size={14} /> Add Applicant
          </button>
        </div>
      </div>

      {/* Confirmation for deleting profile */}
      {confirmDeleteId && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
          }}
        >
          <span>Are you sure? Removing this profile will also remove its saved eligibility records.</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleDelete(confirmDeleteId)}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                background: 'transparent',
                color: 'var(--text-main, #fff)',
                border: '1px solid var(--border-color, #475569)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Applicant Modal */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-applicant-modal-title"
        >
          <div
            style={{
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 id="add-applicant-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={20} color="var(--primary-color, #3b82f6)" /> Add Household Applicant
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Applicant Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar (Father)"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #475569)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--text-main, #f8fafc)',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Relationship
                  </label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #475569)',
                      background: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--text-main, #f8fafc)',
                    }}
                  >
                    {RELATIONSHIP_TYPES.filter((r) => r.id !== 'self').map((rel) => (
                      <option key={rel.id} value={rel.id} style={{ background: '#1e293b' }}>
                        {rel.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #475569)',
                      background: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--text-main, #f8fafc)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Employment
                  </label>
                  <select
                    value={employment}
                    onChange={(e) => setEmployment(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #475569)',
                      background: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--text-main, #f8fafc)',
                    }}
                  >
                    <option value="salaried" style={{ background: '#1e293b' }}>Salaried</option>
                    <option value="self-employed" style={{ background: '#1e293b' }}>Self-Employed</option>
                    <option value="student" style={{ background: '#1e293b' }}>Student</option>
                    <option value="retired" style={{ background: '#1e293b' }}>Retired</option>
                    <option value="unemployed" style={{ background: '#1e293b' }}>Unemployed</option>
                    <option value="farmer" style={{ background: '#1e293b' }}>Farmer / Cultivator</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Annual Income (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #475569)',
                      background: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--text-main, #f8fafc)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #475569)',
                    background: 'transparent',
                    color: 'var(--text-main, #f8fafc)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary-color, #3b82f6)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

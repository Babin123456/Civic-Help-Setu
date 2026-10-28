import React, { useState, useEffect } from 'react';
import {
  Share2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Copy,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  Check,
  ExternalLink,
  Ban,
  Layers,
} from 'lucide-react';
import {
  EXPIRATION_PRESETS,
  createJourneyHandoff,
  getUserHandoffs,
  revokeJourneyHandoff,
} from '../../services/journeyHandoffService';

const JourneyHandoffModal = ({
  isOpen,
  onClose,
  serviceId,
  serviceName,
  availableTasks = [],
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'manage'
  const [title, setTitle] = useState('');
  const [recipientLabel, setRecipientLabel] = useState('Family Member / Volunteer');
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [hoursValid, setHoursValid] = useState(168); // 7 days
  const [createdHandoff, setCreatedHandoff] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [myHandoffs, setMyHandoffs] = useState([]);
  const [error, setError] = useState('');

  // Default tasks if none passed
  const tasksToUse =
    availableTasks && availableTasks.length > 0
      ? availableTasks
      : [
          { id: 'prep_docs', title: 'Collect printed photocopies of age and residence proof' },
          { id: 'prep_photos', title: 'Get 4 passport-size photographs with white background' },
          { id: 'prep_counter', title: 'Locate designated counter and operating hours at office' },
          { id: 'prep_notary', title: 'Verify notary seal on self-declaration affidavit' },
        ];

  useEffect(() => {
    if (isOpen && serviceName) {
      setTitle(`Preparation for ${serviceName}`);
      setSelectedTaskIds(tasksToUse.map((t) => t.id || t.title));
      loadMyHandoffs();
    }
  }, [isOpen, serviceName]);

  const loadMyHandoffs = () => {
    if (currentUser) {
      const list = getUserHandoffs(currentUser);
      setMyHandoffs(list.filter((h) => !serviceId || h.serviceId === serviceId));
    }
  };

  if (!isOpen) return null;

  const handleToggleTask = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleCreateHandoff = (e) => {
    e.preventDefault();
    setError('');

    if (selectedTaskIds.length === 0) {
      setError('Please select at least one preparation task to include in the handoff.');
      return;
    }

    try {
      const selectedTasks = tasksToUse.filter((t) =>
        selectedTaskIds.includes(t.id || t.title)
      );

      const handoff = createJourneyHandoff(currentUser, {
        serviceId: serviceId || 'general-prep',
        serviceName: serviceName || 'Civic Service Journey',
        title,
        recipientLabel,
        tasks: selectedTasks,
        hoursValid,
      });

      setCreatedHandoff(handoff);
      loadMyHandoffs();
    } catch (err) {
      setError(err.message || 'Failed to create shared handoff.');
    }
  };

  const getShareUrl = (token) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/shared-checklist/${token}`;
  };

  const handleCopyLink = async (token) => {
    const url = getShareUrl(token);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleRevoke = (handoffId) => {
    if (window.confirm('Are you sure you want to revoke this shared link immediately? The recipient will no longer be able to open or view it.')) {
      try {
        revokeJourneyHandoff(handoffId, currentUser, 'Revoked by owner');
        loadMyHandoffs();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="handoff-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '0.75rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Share2 size={22} />
            </div>
            <div>
              <h3 id="handoff-dialog-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>
                Civic Journey Handoff & Shared Checklist
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Safely delegate non-sensitive preparation tasks to a family member or caregiver.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Security & Isolation Callout */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: 'rgba(56, 189, 248, 0.08)',
            borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            gap: '0.65rem',
            alignItems: 'flex-start',
            fontSize: '0.775rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <ShieldCheck size={16} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--accent-main)' }}>Zero Profile Exposure: </strong>
            Shared links never expose your profile details, login credentials, or stored documents. Links expire automatically and can be revoked at any time.
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-light)',
            background: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setCreatedHandoff(null);
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: '600',
              fontSize: '0.85rem',
              border: 'none',
              background: activeTab === 'create' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              borderBottom: activeTab === 'create' ? '2px solid var(--accent-main)' : 'none',
              color: activeTab === 'create' ? 'var(--accent-main)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Create New Handoff
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('manage');
              loadMyHandoffs();
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: '600',
              fontSize: '0.85rem',
              border: 'none',
              background: activeTab === 'manage' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              borderBottom: activeTab === 'manage' ? '2px solid var(--accent-main)' : 'none',
              color: activeTab === 'manage' ? 'var(--accent-main)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Manage Active Handoffs ({myHandoffs.filter((h) => h.status === 'ACTIVE').length})
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontSize: '0.825rem',
              }}
            >
              {error}
            </div>
          )}

          {activeTab === 'create' && (
            <>
              {createdHandoff ? (
                /* Generated Share Link Card */
                <div
                  style={{
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid #10b981',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    textAlign: 'center',
                  }}
                >
                  <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto' }} />
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Shared Checklist Ready!
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Anyone with this private link can view and check off the {createdHandoff.tasks.length} delegated preparation tasks.
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={getShareUrl(createdHandoff.token)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-main)',
                        fontSize: '0.825rem',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(createdHandoff.token)}
                      className="btn btn-primary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', display: 'flex', gap: '0.35rem' }}
                    >
                      {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                      {linkCopied ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Expires on: {new Date(createdHandoff.expiresAt).toLocaleString()}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setCreatedHandoff(null)}
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    >
                      Create Another Handoff
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn btn-primary"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Handoff Creation Form */
                <form onSubmit={handleCreateHandoff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                        Checklist Title / Context
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Document photocopies for Father"
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-main)',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                        Trusted Helper Role
                      </label>
                      <input
                        type="text"
                        value={recipientLabel}
                        onChange={(e) => setRecipientLabel(e.target.value)}
                        placeholder="e.g. Daughter, Caregiver, Volunteer"
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-main)',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>
                  </div>

                  {/* Expiration Presets */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                      Auto-Expiration Period
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {EXPIRATION_PRESETS.map((preset) => {
                        const isSelected = hoursValid === preset.hours;
                        return (
                          <button
                            type="button"
                            key={preset.id}
                            onClick={() => setHoursValid(preset.hours)}
                            style={{
                              padding: '0.4rem 0.75rem',
                              borderRadius: '0.5rem',
                              fontSize: '0.78rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--accent-main)' : 'rgba(255, 255, 255, 0.1)',
                              background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                              color: isSelected ? 'var(--accent-main)' : 'var(--text-secondary)',
                            }}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selective Tasks Checklist */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                      Choose Non-Sensitive Tasks to Include ({selectedTaskIds.length} of {tasksToUse.length} selected)
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--border-main)',
                      }}
                    >
                      {tasksToUse.map((task) => {
                        const taskId = task.id || task.title;
                        const isChecked = selectedTaskIds.includes(taskId);
                        return (
                          <label
                            key={taskId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                              fontSize: '0.825rem',
                              color: isChecked ? 'var(--text-primary)' : 'var(--text-tertiary)',
                              cursor: 'pointer',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.35rem',
                              background: isChecked ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleTask(taskId)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span>{task.title || task.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 1.25rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}
                    >
                      <Share2 size={15} /> Generate Shared Link
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {activeTab === 'manage' && (
            /* Manage Active Handoffs List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myHandoffs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
                  No shared handoffs created for this service yet.
                </div>
              ) : (
                myHandoffs.map((handoff) => (
                  <div
                    key={handoff.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-light)',
                      background: 'rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '99px',
                              background:
                                handoff.status === 'ACTIVE'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : handoff.status === 'EXPIRED'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              color:
                                handoff.status === 'ACTIVE'
                                  ? '#10b981'
                                  : handoff.status === 'EXPIRED'
                                  ? '#f59e0b'
                                  : '#ef4444',
                            }}
                          >
                            {handoff.status}
                          </span>
                          <strong style={{ fontSize: '0.925rem', color: 'var(--text-primary)' }}>
                            {handoff.title}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Role: {handoff.recipientLabel} • {handoff.tasks?.length || 0} tasks
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {handoff.status === 'ACTIVE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(handoff.token)}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'flex', gap: '0.25rem' }}
                            >
                              <Copy size={13} /> Copy Link
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevoke(handoff.id)}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: '#ef4444', display: 'flex', gap: '0.25rem' }}
                            >
                              <Ban size={13} /> Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      {handoff.status === 'ACTIVE'
                        ? `Expires: ${new Date(handoff.expiresAt).toLocaleString()}`
                        : handoff.status === 'REVOKED'
                        ? `Revoked on: ${new Date(handoff.revokedAt).toLocaleString()}`
                        : `Expired on: ${new Date(handoff.expiresAt).toLocaleString()}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JourneyHandoffModal;

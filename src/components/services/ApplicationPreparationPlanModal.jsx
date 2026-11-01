import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  X,
  Share2,
  RotateCcw,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import {
  generatePreparationPlan,
  calculatePlanProgress,
  toggleTaskCompletion,
  addCustomTask,
  removeTaskFromPlan,
  editTaskInPlan,
  getStoredPlan,
  clearStoredPlan,
  TASK_CATEGORIES,
} from '../../services/applicationPreparationPlanService';

export default function ApplicationPreparationPlanModal({
  service,
  isOpen,
  onClose,
}) {
  const [plan, setPlan] = useState(() => {
    if (!service) return null;
    return getStoredPlan(service.id) || generatePreparationPlan(service);
  });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Initialize or load plan when modal opens or service changes
  useEffect(() => {
    if (!service) return;
    const existing = getStoredPlan(service.id);
    if (existing) {
      setPlan(existing);
    } else {
      const generated = generatePreparationPlan(service);
      setPlan(generated);
    }
  }, [service]);

  const progress = useMemo(() => calculatePlanProgress(plan), [plan]);

  if (!isOpen || !service || !plan) return null;

  const handleToggle = (taskId) => {
    const updated = toggleTaskCompletion(plan, taskId);
    setPlan(updated);
  };

  const handleStartEdit = (task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditNotes(task.notes || '');
  };

  const handleSaveEdit = (taskId) => {
    if (!editTitle.trim()) return;
    const updated = editTaskInPlan(plan, taskId, {
      title: editTitle,
      notes: editNotes,
    });
    setPlan(updated);
    setEditingTaskId(null);
  };

  const handleRemove = (taskId) => {
    const updated = removeTaskFromPlan(plan, taskId);
    setPlan(updated);
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const updated = addCustomTask(plan, {
      title: newTitle,
      notes: newNotes,
    });
    setPlan(updated);
    setNewTitle('');
    setNewNotes('');
    setShowAddForm(false);
  };

  const handleResetToDefault = () => {
    clearStoredPlan(service.id);
    const fresh = generatePreparationPlan(service);
    setPlan(fresh);
  };

  const handleCopyPlan = () => {
    const textLines = [
      `Application Preparation Plan for: ${service.title || service.name}`,
      `Progress: ${progress.completed}/${progress.total} completed (${progress.percentage}%)`,
      '',
      ...plan.tasks.map((t, idx) => `${t.completed ? '[x]' : '[ ]'} ${idx + 1}. ${t.title}${t.notes ? ` (${t.notes})` : ''}`),
      '',
      'Note: Step sequencing is advisory. Verify local authority guidelines before submitting.',
    ];
    navigator.clipboard?.writeText(textLines.join('\n'));
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prep-plan-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.85rem',
          maxWidth: '720px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Sparkles style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
              <h2 id="prep-plan-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                Application Preparation Plan
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              Structured preparation checklist for <strong>{service.title || service.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.35rem',
              cursor: 'pointer',
              color: '#94a3b8',
              borderRadius: '0.375rem',
            }}
          >
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Progress Card */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                Preparation Progress
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: progress.percentage === 100 ? '#16a34a' : '#2563eb' }}>
                {progress.completed} of {progress.total} tasks completed ({progress.percentage}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress.percentage}%`,
                  height: '100%',
                  backgroundColor: progress.percentage === 100 ? '#16a34a' : '#2563eb',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Advisory Notice */}
          <div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem 1rem', backgroundColor: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#1e3a8a' }}>
            <Info style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <strong>Grounded Plan Notice:</strong> Tasks are derived strictly from documented service criteria and forms. Step sequencing is advisory; local submission counters may accept documents in varying order.
            </div>
          </div>

          {/* Task List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {plan.tasks.map((task) => {
              const isEditing = editingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: task.completed ? '#f8fafc' : '#ffffff',
                    border: `1px solid ${task.completed ? '#cbd5e1' : '#e2e8f0'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(task.id)}
                    aria-label={task.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      marginTop: '0.15rem',
                      color: task.completed ? '#16a34a' : '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    {task.completed ? (
                      <CheckCircle2 style={{ width: '1.35rem', height: '1.35rem', color: '#16a34a' }} />
                    ) : (
                      <Circle style={{ width: '1.35rem', height: '1.35rem' }} />
                    )}
                  </button>

                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #2563eb', fontSize: '0.875rem' }}
                        />
                        <input
                          type="text"
                          placeholder="Optional notes or instructions..."
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          style={{ width: '100%', padding: '0.35rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(task.id)}
                            style={{ padding: '0.3rem 0.6rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTaskId(null)}
                            style={{ padding: '0.3rem 0.6rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: task.completed ? '#64748b' : '#0f172a',
                            textDecoration: task.completed ? 'line-through' : 'none',
                          }}
                        >
                          {task.title}
                        </div>
                        {task.notes && (
                          <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem' }}>
                            {task.notes}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                            {task.categoryLabel || task.category}
                          </span>
                          {task.isSuggestedOrder && (
                            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 500 }}>
                              Suggested Order
                            </span>
                          )}
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Source: {task.sourceRequirement ? (task.sourceRequirement.length > 40 ? `${task.sourceRequirement.slice(0, 40)}...` : task.sourceRequirement) : task.sourceField}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(task)}
                        title="Edit task"
                        aria-label={`Edit task ${task.title}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#94a3b8' }}
                      >
                        <Edit2 style={{ width: '0.9rem', height: '0.9rem' }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(task.id)}
                        title="Remove task"
                        aria-label={`Remove task ${task.title}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#ef4444' }}
                      >
                        <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Custom Task Form */}
          {showAddForm ? (
            <form onSubmit={handleAddCustom} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.85rem', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                Add Personal Preparation Task
              </div>
              <input
                type="text"
                placeholder="e.g., Get notarized affidavit from local notary..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '0.4rem 0.65rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                placeholder="Optional personal notes..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                style={{ width: '100%', padding: '0.35rem 0.65rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="submit"
                  style={{ padding: '0.35rem 0.75rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Add Task
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{ padding: '0.35rem 0.75rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                alignSelf: 'flex-start',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                backgroundColor: '#f1f5f9',
                color: '#2563eb',
                border: '1px solid #e2e8f0',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus style={{ width: '0.9rem', height: '0.9rem' }} />
              Add Personal Task
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={handleResetToDefault}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw style={{ width: '0.85rem', height: '0.85rem' }} />
            Reset to Generated Plan
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCopyPlan}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copiedFeedback ? (
                <>
                  <Check style={{ width: '0.85rem', height: '0.85rem', color: '#16a34a' }} />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 style={{ width: '0.85rem', height: '0.85rem' }} />
                  Copy Plan
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '0.375rem',
                backgroundColor: '#2563eb',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

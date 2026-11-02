import { useState, useEffect, useId, useCallback } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Info,
  Trash2,
  Plus,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';
import {
  CONFIRM_WITH_DEPARTMENT,
  generateServiceChecklist,
  saveServiceChecklist,
} from '../../services/makeChecklistService';
import { REQUIREMENT_TYPES, REQUIREMENT_LABELS } from '../../services/requirementTypes';
import { useModalKeyboard } from '../../hooks/useModalKeyboard';

export default function MakeChecklistModal({
  isOpen,
  onClose,
  service,
  onSaveChecklist,
}) {
  const modalRef = useModalKeyboard(isOpen, onClose);
  const titleId = useId();

  const [loading, setLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState('');
  const [items, setItems] = useState([]);
  const [newItemTitle, setNewTitle] = useState('');
  const [newItemType, setNewItemType] = useState(REQUIREMENT_TYPES.UNVERIFIED);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadChecklist = useCallback(async (serviceObj) => {
    if (!serviceObj) return;
    setLoading(true);
    try {
      const generated = await generateServiceChecklist(serviceObj);
      const mapped = (generated.items || []).map((label, idx) => {
        const req = generated.requirements?.[label] || {};
        return {
          id: `item-${idx}-${Date.now()}`,
          title: label,
          type: req.type || REQUIREMENT_TYPES.UNVERIFIED,
          condition: req.condition || null,
          isAmbiguous: Boolean(req.isAmbiguous || req.condition === CONFIRM_WITH_DEPARTMENT),
          source: req.source || null,
        };
      });

      setItems(mapped);
      setIsFallback(Boolean(generated.isFallback));
      setFallbackReason(generated.fallbackReason || '');
    } catch {
      setIsFallback(true);
      setFallbackReason('AI service unavailable. Fell back to original requirements.');
      const fallbackItems = (serviceObj.documents || []).map((doc, idx) => ({
        id: `fb-${idx}`,
        title: doc,
        type: REQUIREMENT_TYPES.UNVERIFIED,
        condition: null,
        isAmbiguous: false,
        source: null,
      }));
      setItems(fallbackItems);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !service) return undefined;

    const timer = setTimeout(() => {
      loadChecklist(service);
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, service, loadChecklist]);

  if (!isOpen || !service) return null;

  const handleTitleChange = (id, newTitle) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const handleTypeChange = (id, newType) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const isAmbiguous = newType === 'ambiguous';
        const type = isAmbiguous ? REQUIREMENT_TYPES.UNVERIFIED : newType;
        const condition = isAmbiguous ? CONFIRM_WITH_DEPARTMENT : (type === REQUIREMENT_TYPES.CONDITIONAL ? item.condition || 'Confirm with the department.' : null);

        return {
          ...item,
          type,
          condition,
          isAmbiguous,
        };
      })
    );
  };

  const handleDeleteItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    const trimmed = newItemTitle.trim();
    if (!trimmed) return;

    const isAmbiguous = newItemType === 'ambiguous';
    const type = isAmbiguous ? REQUIREMENT_TYPES.UNVERIFIED : newItemType;

    const newItem = {
      id: `custom-${Date.now()}`,
      title: trimmed,
      type,
      condition: isAmbiguous ? CONFIRM_WITH_DEPARTMENT : null,
      isAmbiguous,
      source: null,
    };

    setItems((prev) => [...prev, newItem]);
    setNewTitle('');
    setShowAddForm(false);
  };

  const handleSave = () => {
    const finalItems = items.map((i) => i.title.trim()).filter(Boolean);
    const finalRequirements = {};

    for (const item of items) {
      const cleanLabel = item.title.trim();
      if (!cleanLabel) continue;
      finalRequirements[cleanLabel] = {
        type: item.type,
        condition: item.condition,
        source: item.source,
        isAmbiguous: item.isAmbiguous,
      };
    }

    const checklistData = {
      items: finalItems,
      requirements: finalRequirements,
    };

    saveServiceChecklist(service.id, checklistData);
    onSaveChecklist?.(checklistData);
    onClose();
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        padding: '1rem',
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface, #1e293b)',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-main, rgba(255, 255, 255, 0.1))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          color: 'var(--text-primary, #f8fafc)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main, #38bdf8)',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h2
                id={titleId}
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Make Checklist: {service.name}
              </h2>
              <p
                style={{
                  margin: '0.15rem 0 0',
                  fontSize: '0.8rem',
                  color: 'var(--text-tertiary, #94a3b8)',
                }}
              >
                Review and edit requirements before saving to your checklist
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.375rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'grid',
            gap: '1rem',
            flex: 1,
          }}
        >
          {/* Policy & Governance Notice */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary, #cbd5e1)',
              lineHeight: 1.5,
            }}
          >
            <Info size={16} color="var(--accent-main, #38bdf8)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Strict Requirement Grounding:</strong> Only requirements documented in the official service catalogue are converted. Ambiguous items are preserved as <em>&ldquo;Confirm with the department.&rdquo;</em> Documents are marked officially mandatory only if confirmed by official sources.
            </div>
          </div>

          {/* Fallback Notice if AI failed */}
          {isFallback && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                fontSize: '0.82rem',
                color: '#f59e0b',
                lineHeight: 1.5,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Fallback Mode Active:</strong> {fallbackReason || 'AI parsing was unavailable. Checklist populated directly from verified service catalogue requirements.'}
              </div>
            </div>
          )}

          {loading ? (
            <div
              style={{
                padding: '3rem 1rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                display: 'grid',
                placeItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Sparkles size={28} className="animate-pulse" color="var(--accent-main)" />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>
                Converting service requirements into a structured checklist...
              </p>
            </div>
          ) : (
            <>
              {/* Checklist Items Editor */}
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Checklist Items ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.65rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                {items.length === 0 ? (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', fontStyle: 'italic', margin: '0.5rem 0' }}>
                    No checklist items generated. Click &ldquo;Add Item&rdquo; to add custom requirements.
                  </p>
                ) : (
                  items.map((item, index) => {
                    const selectValue = item.isAmbiguous
                      ? 'ambiguous'
                      : item.type;

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.04))',
                          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                          display: 'grid',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--text-tertiary)',
                              width: '20px',
                            }}
                          >
                            #{index + 1}
                          </span>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleTitleChange(item.id, e.target.value)}
                            aria-label={`Checklist item #${index + 1}`}
                            style={{
                              flex: 1,
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                              backgroundColor: 'var(--bg-main, #0f172a)',
                              color: 'var(--text-primary, #f8fafc)',
                              fontSize: '0.88rem',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            aria-label={`Delete item ${item.title}`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '0.4rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '0.375rem',
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            paddingLeft: '28px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <label
                              htmlFor={`type-select-${item.id}`}
                              style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}
                            >
                              Status:
                            </label>
                            <select
                              id={`type-select-${item.id}`}
                              value={selectValue}
                              onChange={(e) => handleTypeChange(item.id, e.target.value)}
                              aria-label={`Requirement status for ${item.title}`}
                              style={{
                                fontSize: '0.78rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '0.375rem',
                                border: '1px solid var(--border-main)',
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              <option value={REQUIREMENT_TYPES.REQUIRED}>Official requirement</option>
                              <option value="ambiguous">Confirm with the department</option>
                              <option value={REQUIREMENT_TYPES.CONDITIONAL}>Conditional requirement</option>
                              <option value={REQUIREMENT_TYPES.OPTIONAL}>Optional suggestion</option>
                              <option value={REQUIREMENT_TYPES.UNVERIFIED}>Not verified</option>
                            </select>
                          </div>

                          {item.isAmbiguous && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '0.35rem',
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                fontWeight: 500,
                              }}
                            >
                              {CONFIRM_WITH_DEPARTMENT}
                            </span>
                          )}

                          {!item.isAmbiguous && item.type === REQUIREMENT_TYPES.REQUIRED && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '0.35rem',
                                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                color: 'var(--accent-main)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                fontWeight: 500,
                              }}
                            >
                              {REQUIREMENT_LABELS.required}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Add Custom Item Inline Form */}
                {showAddForm && (
                  <form
                    onSubmit={handleAddItem}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      backgroundColor: 'rgba(56, 189, 248, 0.05)',
                      border: '1px dashed var(--accent-main, #38bdf8)',
                      display: 'grid',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={newItemTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Identity Proof copy"
                        autoFocus
                        aria-label="New checklist requirement name"
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-main)',
                          backgroundColor: 'var(--bg-main)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                        }}
                      />
                      <select
                        value={newItemType}
                        onChange={(e) => setNewItemType(e.target.value)}
                        aria-label="New item requirement type"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.45rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-main)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <option value={REQUIREMENT_TYPES.UNVERIFIED}>Not verified</option>
                        <option value="ambiguous">Confirm with department</option>
                        <option value={REQUIREMENT_TYPES.REQUIRED}>Official requirement</option>
                        <option value={REQUIREMENT_TYPES.CONDITIONAL}>Conditional</option>
                        <option value={REQUIREMENT_TYPES.OPTIONAL}>Optional</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        Add to list
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-main, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => loadChecklist(service)}
            disabled={loading}
            className="btn btn-secondary"
            style={{
              fontSize: '0.85rem',
              padding: '0.5rem 0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <RotateCcw size={15} /> Regenerate
          </button>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || items.length === 0}
              className="btn btn-primary"
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1.1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Check size={16} /> Save to Checklist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

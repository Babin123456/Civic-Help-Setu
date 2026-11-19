import { useState, useMemo, useEffect } from 'react';
import AccessibleModal from '../common/AccessibleModal';
import {
  CheckSquare,
  Square,
  Trash2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import {
  readLibraryChecklist,
  saveLibraryChecklist,
  deleteLibraryChecklist,
  LIBRARY_STORAGE_EVENT,
} from '../../services/libraryChecklistStorage';
import { buildLibraryChecklistItems } from '../../services/libraryService';
import { MEMBERSHIP_CATEGORY_LABELS } from '../../data/libraryContract';
import { useToast } from '../../context/ToastContext';

export default function LibraryChecklistModal({
  isOpen,
  onClose,
  library,
}) {
  if (!isOpen || !library) return null;

  return (
    <LibraryChecklistModalContent
      key={`${library.id}_${isOpen}`}
      isOpen={isOpen}
      onClose={onClose}
      library={library}
    />
  );
}

function LibraryChecklistModalContent({
  isOpen,
  onClose,
  library,
}) {
  const { toast } = useToast();
  const [checklistState, setChecklistState] = useState(() => readLibraryChecklist(library.id));
  const [selectedCategory, setSelectedCategory] = useState(
    () => checklistState?.selectedCategory || 'general_adult'
  );
  const [customInput, setCustomInput] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');

  // Sync with cross-tab / storage updates
  useEffect(() => {
    const handleStorageEvent = () => {
      setChecklistState(readLibraryChecklist(library.id));
    };
    window.addEventListener(LIBRARY_STORAGE_EVENT, handleStorageEvent);
    return () => window.removeEventListener(LIBRARY_STORAGE_EVENT, handleStorageEvent);
  }, [library.id]);

  const baseItems = useMemo(() => {
    return buildLibraryChecklistItems(library, selectedCategory);
  }, [library, selectedCategory]);

  const allItems = useMemo(() => {
    const custom = checklistState?.customItems || [];
    return [...new Set([...baseItems, ...custom])];
  }, [baseItems, checklistState?.customItems]);

  const checkedList = checklistState?.checked || [];

  const handleToggle = (itemLabel) => {
    setSaveStatus('saving');
    const isChecked = checkedList.includes(itemLabel);
    const nextChecked = isChecked
      ? checkedList.filter((l) => l !== itemLabel)
      : [...checkedList, itemLabel];

    const res = saveLibraryChecklist(
      library.id,
      {
        ...checklistState,
        checked: nextChecked,
        selectedCategory,
      },
      checklistState?.rev
    );

    if (res.ok) {
      setChecklistState(res.state);
      setSaveStatus('saved');
    } else if (res.reason === 'conflict') {
      toast?.warning?.('Checklist was updated in another tab; refreshed with latest changes.');
      setChecklistState(res.state);
      setSaveStatus('saved');
    } else {
      toast?.error?.('Failed to save checklist.');
      setSaveStatus('error');
    }
  };

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    setSelectedCategory(newCat);
    setSaveStatus('saving');

    const res = saveLibraryChecklist(
      library.id,
      {
        ...checklistState,
        selectedCategory: newCat,
      },
      checklistState?.rev
    );

    if (res.ok) {
      setChecklistState(res.state);
      setSaveStatus('saved');
    }
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;

    if (allItems.includes(trimmed)) {
      toast?.warning?.('This checklist item already exists.');
      return;
    }

    setSaveStatus('saving');
    const nextCustom = [...(checklistState?.customItems || []), trimmed];
    const res = saveLibraryChecklist(
      library.id,
      {
        ...checklistState,
        customItems: nextCustom,
        selectedCategory,
      },
      checklistState?.rev
    );

    if (res.ok) {
      setChecklistState(res.state);
      setCustomInput('');
      setSaveStatus('saved');
      toast?.success?.('Custom reminder added.');
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm('Are you sure you want to permanently clear and delete your saved checklist data for this library?')) {
      deleteLibraryChecklist(library.id);
      setChecklistState(readLibraryChecklist(library.id));
      toast?.info?.('Saved checklist data wiped from browser storage.');
    }
  };

  const completedCount = allItems.filter((i) => checkedList.includes(i)).length;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Library Membership Checklist"
      subtitle={`Application preparation for ${library.name}`}
      maxWidth="620px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Privacy Note */}
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-tertiary)',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-light)',
            padding: '0.6rem 0.75rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <ShieldCheck size={16} style={{ color: 'var(--success, #16a34a)', flexShrink: 0 }} />
          <span>Checklist progress is kept strictly private in your local browser and is never uploaded or shared.</span>
        </div>

        {/* Membership Category Selector */}
        {Array.isArray(library.membershipCategories) && library.membershipCategories.length > 0 && (
          <div>
            <label htmlFor="modal-membership-category" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Target Membership Category:
            </label>
            <select
              id="modal-membership-category"
              value={selectedCategory}
              onChange={handleCategoryChange}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              {library.membershipCategories.map((c) => (
                <option key={c.category} value={c.category}>
                  {MEMBERSHIP_CATEGORY_LABELS[c.category] || c.category} (Fee: ₹{c.annualFee}, Deposit: ₹{c.cautionDeposit || 0})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Progress & Save Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {completedCount} of {allItems.length} requirements prepared
          </span>
          <span style={{ fontSize: '0.8rem', color: saveStatus === 'saving' ? 'var(--warning, #f59e0b)' : 'var(--text-tertiary)' }}>
            {saveStatus === 'saving' ? 'Saving...' : 'Saved to browser'}
          </span>
        </div>

        {/* Checklist Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
          {allItems.map((item, idx) => {
            const isDone = checkedList.includes(item);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggle(item)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${isDone ? 'rgba(22, 163, 74, 0.3)' : 'var(--border-light)'}`,
                  backgroundColor: isDone ? 'rgba(22, 163, 74, 0.05)' : 'var(--bg-main)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ color: isDone ? 'var(--success, #16a34a)' : 'var(--text-tertiary)', flexShrink: 0, marginTop: '2px' }}>
                  {isDone ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
                    textDecoration: isDone ? 'line-through' : 'none',
                    lineHeight: 1.4,
                  }}
                >
                  {item}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add Custom Reminder Form */}
        <form onSubmit={handleAddCustom} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Add personal task (e.g. Attest college ID photocopy)..."
            aria-label="Add custom checklist item"
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-main)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
          <button
            type="submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.5rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '0.4rem',
              backgroundColor: 'var(--accent-main)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} /> Add
          </button>
        </form>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
          <button
            type="button"
            onClick={handleDeleteAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'none',
              border: 'none',
              color: 'var(--danger, #ef4444)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: '0.25rem 0',
            }}
          >
            <Trash2 size={14} /> Clear & Wipe My Saved Data
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '0.4rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </AccessibleModal>
  );
}

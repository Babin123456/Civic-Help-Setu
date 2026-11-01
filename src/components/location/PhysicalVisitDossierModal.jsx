import { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  CheckSquare,
  Square,
  Clock,
  Camera,
  Coins,
  Paperclip,
  ShieldAlert,
  Building,
  Info,
} from 'lucide-react';
import {
  generatePhysicalVisitDossier,
  formatDossierPrintableText,
} from '../../services/physicalVisitDossierService.js';

/**
 * Physical Office Visit Dossier & Checklist Modal (#434)
 *
 * Interactive pre-departure visit organizer with actionable checklist checkboxes,
 * photo specifications, exact tender/cash guidelines, stationary reminders,
 * and dealing counter operating windows.
 */
const PhysicalVisitDossierModal = ({ isOpen, onClose, office, selectedService }) => {
  const [checkedItems, setCheckedItems] = useState({});
  const [copiedText, setCopiedText] = useState(false);

  const dossier = useMemo(() => {
    if (!office) return null;
    return generatePhysicalVisitDossier({ office, service: selectedService });
  }, [office, selectedService]);

  if (!isOpen || !dossier) return null;

  const toggleCheck = (id) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyText = () => {
    const text = formatDossierPrintableText(dossier);
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPercent = Math.round((checkedCount / Math.max(1, dossier.totalItemsCount)) * 100);

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="visit-dossier-title"
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckSquare size={18} color="var(--accent-main)" />
            </div>
            <div>
              <h2
                id="visit-dossier-title"
                style={{
                  fontSize: '1.15rem',
                  fontWeight: '700',
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                Physical Visit Dossier &amp; Checklist
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  {dossier.officeName}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-main)', fontWeight: '600' }}>
                  • {dossier.targetService}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Dossier Readiness: <strong>{checkedCount} of {dossier.totalItemsCount}</strong> items packed
          </span>
          <span style={{ color: 'var(--accent-main)', fontWeight: '700' }}>
            {progressPercent}% Complete
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Dealing counter timings alert */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.65rem',
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-main)', fontWeight: '700', textTransform: 'uppercase' }}>
                Dealing Window
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                {dossier.counterTimings.publicDealingHours}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-main)', fontWeight: '700', textTransform: 'uppercase' }}>
                Best Arrival Window
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                {dossier.counterTimings.bestArrivalWindow}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-main)', fontWeight: '700', textTransform: 'uppercase' }}>
                Token Cut-Off
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                {dossier.counterTimings.tokenCutoffTime}
              </div>
            </div>
          </div>

          {/* Section 1: Documents & Photocopies */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckSquare size={16} color="var(--accent-main)" />
              1. Required Documents &amp; Photocopy Sets
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {dossier.documentChecklist.map((doc, idx) => {
                const key = `doc-${idx}`;
                const isChecked = Boolean(checkedItems[key]);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleCheck(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.5rem',
                      background: isChecked ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: isChecked ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid var(--border-light)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <div style={{ marginTop: '2px', color: isChecked ? '#22c55e' : 'var(--text-tertiary)' }}>
                      {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: isChecked ? '#22c55e' : 'var(--text-primary)' }}>
                        {doc.item} <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>({doc.quantity} {doc.originalRequired ? 'Original + Set' : 'Photocopies'})</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {doc.note}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Photo Specifications */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Camera size={16} color="var(--accent-main)" />
              2. Photograph Specifications
            </div>
            {dossier.photoSpecifications.required ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div>• <strong>Quantity:</strong> {dossier.photoSpecifications.count} Passport Photos</div>
                <div>• <strong>Dimensions:</strong> {dossier.photoSpecifications.dimensions}</div>
                <div>• <strong>Background:</strong> {dossier.photoSpecifications.background}</div>
                <div>• <strong>Rule:</strong> {dossier.photoSpecifications.note}</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#22c55e' }}>
                ✓ {dossier.photoSpecifications.dimensions} — {dossier.photoSpecifications.note}
              </div>
            )}
          </div>

          {/* Section 3: Payment & Tender */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Coins size={16} color="var(--accent-main)" />
              3. Payment &amp; Change Preparation
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div>• <strong>Estimated Counter Fee:</strong> {dossier.paymentPreparation.estimatedAmount}</div>
              <div>• <strong>Accepted Modes:</strong> {dossier.paymentPreparation.modesAccepted.join(', ')}</div>
              <div>• <strong>Tender Advice:</strong> {dossier.paymentPreparation.tenderAdvice}</div>
            </div>
          </div>

          {/* Section 4: Stationary Pack */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Paperclip size={16} color="var(--accent-main)" />
              4. Essential Stationary Pack
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {dossier.stationaryPack.map((item, idx) => {
                const key = `stat-${idx}`;
                const isChecked = Boolean(checkedItems[key]);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleCheck(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.45rem',
                      background: isChecked ? 'rgba(34, 197, 94, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                      border: isChecked ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid var(--border-light)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ color: isChecked ? '#22c55e' : 'var(--text-tertiary)' }}>
                      {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: isChecked ? '#22c55e' : 'var(--text-secondary)' }}>
                      {item}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Anti-broker reminder */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
          >
            <ShieldAlert size={18} color="#eab308" style={{ flexShrink: 0 }} />
            <span>
              <strong>Citizen Protection Notice:</strong> Never hand over original documents to unauthorized agents or touts. Only designated departmental officers inside official counter enclosures are permitted to inspect originals.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            background: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCopyText}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {copiedText ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedText ? 'Copied' : 'Copy Text Checklist'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Printer size={14} />
              <span>Print Dossier</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 1rem' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhysicalVisitDossierModal;

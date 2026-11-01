import { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  X,
  ShieldAlert,
  Info,
  BookOpen,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getFormFieldGuidance,
  extractCandidateFieldsFromService,
} from '../../services/formFieldGuidanceService';

export default function FormFieldGuidanceModal({
  service,
  isOpen,
  onClose,
}) {
  const candidateFields = useMemo(
    () => extractCandidateFieldsFromService(service),
    [service]
  );

  const [selectedField, setSelectedField] = useState(
    candidateFields[0] || 'Aadhaar Number'
  );
  const [customSearch, setCustomSearch] = useState('');

  const activeFieldLabel = customSearch.trim() || selectedField;
  const guidance = useMemo(
    () => getFormFieldGuidance(activeFieldLabel, service),
    [activeFieldLabel, service]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-guidance-title"
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
          maxWidth: '740px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
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
              <BookOpen style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
              <h2 id="form-guidance-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                Application Form Field Explainer
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              Field-by-field guidance for <strong>{service?.title || service?.name || 'Civic Service'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close form guidance"
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
          {/* Safety & Non-Submission Disclaimer */}
          <div
            style={{
              display: 'flex',
              gap: '0.65rem',
              padding: '0.85rem 1rem',
              backgroundColor: '#f8fafc',
              borderLeft: '4px solid #2563eb',
              borderRadius: '0.4rem',
              fontSize: '0.8125rem',
              color: '#334155',
              lineHeight: 1.45,
            }}
          >
            <ShieldCheck style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <strong>Safety Guardrail:</strong> This tool explains the meaning, document location, and formatting of form fields. We <strong>never invent personal answers</strong>, request passwords or OTPs, or submit applications to external government servers.
            </div>
          </div>

          {/* Field Selection & Search */}
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
              Select a Documented Form Field:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {candidateFields.map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => {
                    setSelectedField(field);
                    setCustomSearch('');
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: selectedField === field && !customSearch ? '#2563eb' : '#cbd5e1',
                    backgroundColor: selectedField === field && !customSearch ? '#eff6ff' : '#ffffff',
                    color: selectedField === field && !customSearch ? '#1d4ed8' : '#334155',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {field}
                </button>
              ))}
            </div>

            {/* Custom Search Input */}
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Or type any form field label (e.g., Khasra, EPIC, IFSC, Domicile)..."
                value={customSearch}
                onChange={(e) => setCustomSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Active Field Explanation Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.65rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Field Title & Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.725rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                  Active Field
                </span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  {guidance.fieldLabel}
                </h3>
              </div>
              {guidance.isRecognized ? (
                <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.55rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                  Standard Civic Field
                </span>
              ) : (
                <span style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '0.2rem 0.55rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                  Custom / Ambiguous Field
                </span>
              )}
            </div>

            {/* Meaning */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                Meaning & Purpose:
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                {guidance.meaning}
              </p>
            </div>

            {/* Where to find it */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FileText style={{ width: '0.95rem', height: '0.95rem' }} />
                Where to Find This Information:
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#334155', lineHeight: 1.45 }}>
                {guidance.whereToFind}
              </p>
            </div>

            {/* Format Rule */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                Prescribed Format Rule:
              </div>
              <code
                style={{
                  display: 'block',
                  backgroundColor: '#f1f5f9',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.35rem',
                  fontSize: '0.8rem',
                  color: '#0f172a',
                  fontFamily: 'monospace',
                }}
              >
                {guidance.formatRule}
              </code>
            </div>

            {/* Pitfalls & Mistakes */}
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#991b1b' }}>
              <AlertTriangle style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong>Common Pitfalls to Avoid:</strong> {guidance.pitfalls}
              </div>
            </div>

            {/* Official Confirmation Banner if Required */}
            {guidance.requiresOfficialConfirmation && (
              <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#92400e' }}>
                <Info style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <strong>Official Confirmation Required:</strong> Formatting or sub-categories for this field vary by state/portal. Verify with the latest department circular before submitting.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Never enter personal values or passwords into third-party tools.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1.1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#2563eb',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close Guidance
          </button>
        </div>
      </div>
    </div>
  );
}

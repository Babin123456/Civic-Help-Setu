import React, { useState } from 'react';
import {
  X,
  Printer,
  FileDown,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  Layers,
  Lock,
} from 'lucide-react';
import {
  VISIT_PACK_SECTIONS,
  SECTION_LABELS,
  DEFAULT_SECTION_SELECTION,
  compileVisitPackData,
  buildPrintableVisitPackHtml,
  buildPrintableVisitPackText,
} from '../../services/appointmentVisitPackService';
import { useToast } from '../../context/ToastContext';
import { logDiagnostic } from '../../utils/diagnostics';

const AppointmentVisitPackModal = ({
  isOpen,
  onClose,
  service,
  office = null,
  appointment = null,
}) => {
  const { toast } = useToast();

  const [sections, setSections] = useState(DEFAULT_SECTION_SELECTION);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [userNotes, setUserNotes] = useState('');

  if (!isOpen || !service) return null;

  const toggleSection = (key) => {
    if (key === VISIT_PACK_SECTIONS.USER_NOTES) {
      setIncludeNotes((prev) => !prev);
    }
    setSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const packData = compileVisitPackData({
    service,
    office,
    appointment,
    sectionSelection: sections,
    userNotes,
    includeUserNotes: includeNotes,
  });

  const handlePrint = () => {
    try {
      const html = buildPrintableVisitPackHtml(packData);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (!printWindow) {
        toast?.error?.('Please allow popups to open the print dossier.');
        URL.revokeObjectURL(blobUrl);
        return;
      }
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          // ignore popup print error
        }
        URL.revokeObjectURL(blobUrl);
      }, 500);
    } catch (err) {
      logDiagnostic('Print generation failed', err);
      toast?.error?.('Failed to open print preview.');
    }
  };

  const handleDownloadText = () => {
    try {
      const text = buildPrintableVisitPackText(packData);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Civic_Visit_Pack_${service.id || 'service'}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast?.success?.('Visit pack downloaded as plain text.');
    } catch {
      toast?.error?.('Failed to download visit pack text.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="visit-pack-modal-title"
    >
      <div
        className="card-glass animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-main)' }}>
              In-Person Counter Preparation
            </div>
            <h3 id="visit-pack-modal-title" style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
              Generate Civic Visit Pack: {service.name}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Customize which sections to include in your ink-friendly printable dossier.
            Vault files and sensitive demographic numbers are strictly excluded for your privacy.
          </p>

          {/* Section Selection Toggles */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
              Select Dossier Sections:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(VISIT_PACK_SECTIONS).map(([key, secVal]) => {
                const isSelected = sections[secVal];
                const isNotes = secVal === VISIT_PACK_SECTIONS.USER_NOTES;
                return (
                  <label
                    key={secVal}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '0.6rem',
                      background: isSelected
                        ? 'rgba(56, 189, 248, 0.08)'
                        : 'var(--bg-card-hover, rgba(255, 255, 255, 0.02))',
                      border: isSelected
                        ? '1px solid rgba(56, 189, 248, 0.3)'
                        : '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSection(secVal)}
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: 'var(--accent-main)',
                        cursor: 'pointer',
                      }}
                    />
                    <span>{SECTION_LABELS[secVal]}</span>
                    {isNotes && (
                      <span style={{ fontSize: '0.72rem', color: '#f59e0b', marginLeft: 'auto' }}>
                        (Excluded by default)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Optional User Notes Input (Only when toggled on) */}
          {sections[VISIT_PACK_SECTIONS.USER_NOTES] && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.85rem 1rem',
                borderRadius: '0.75rem',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-light)',
              }}
            >
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Enter Personal Questions or Notes to Take to the Counter:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Inquire about concession for senior citizens; ask about counter 5 token queue..."
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '0.45rem',
                  background: 'var(--bg-input, #1e293b)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                Note: Do not write personal bank pins or passwords. User notes are printed on your personal pack only.
              </div>
            </div>
          )}

          {/* Summary Preview Box */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.75rem',
              background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div>
              <strong>Office: </strong>
              {packData.office.isAvailable ? packData.office.name : '[No office selected - General procedure pack]'}
            </div>
            <div>
              <strong>Appointment: </strong>
              {packData.appointment.isBooked ? `Token #${packData.appointment.tokenNumber} on ${packData.appointment.appointmentDate}` : '[Walk-in mode - No advance token]'}
            </div>
            <div>
              <strong>Official Verified Sources: </strong>
              {packData.officialSources.map((s) => s.name).join(', ')} ({packData.lastVerifiedDate})
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'var(--glass-bg)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Ink-friendly monochrome &bull; Formatted for A4 / mobile
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadText}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <FileDown size={14} /> Download Plain Text
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentVisitPackModal;

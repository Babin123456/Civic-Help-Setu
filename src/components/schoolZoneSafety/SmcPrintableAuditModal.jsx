import { useState, useMemo } from 'react';
import {
  X,
  Printer,
  FileText,
} from 'lucide-react';
import { generateSMCPrintableAudit } from '../../services/upSchoolZoneSafetyService';

export default function SmcPrintableAuditModal({
  isOpen,
  onClose,
  schoolZones = [],
  audits = [],
  initialSchoolId = '',
}) {
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    initialSchoolId || schoolZones[0]?.id || ''
  );

  const dossier = useMemo(() => {
    if (!selectedSchoolId) return null;
    try {
      const filteredAudits = audits.filter((a) => a.schoolId === selectedSchoolId);
      return generateSMCPrintableAudit({
        schoolId: selectedSchoolId,
        auditsList: filteredAudits.length > 0 ? filteredAudits : null,
      });
    } catch {
      return null;
    }
  }, [selectedSchoolId, audits]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="smc-modal-title"
    >
      <div
        className="modal-content"
        style={{
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '0.75rem',
          maxWidth: '850px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Controls (Hidden in Print) */}
        <div
          className="no-print"
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
            <div>
              <h2 id="smc-modal-title" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                School Management Committee (SMC) Audit Dossier Export
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                RTE Act 2009 Sec 21 & IRC:SP:88 Compliant Printable Format
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              aria-label="Select school for dossier"
              style={{
                padding: '0.4rem 0.65rem',
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                background: '#ffffff',
              }}
            >
              {schoolZones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.district})
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: '#2563eb',
                color: '#ffffff',
              }}
            >
              <Printer size={15} /> Print Dossier
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '0.25rem',
              }}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Dossier Container */}
        {dossier && (
          <div
            id="printable-smc-dossier"
            style={{
              padding: '2rem',
              fontFamily: 'serif, system-ui, -apple-system',
              lineHeight: 1.5,
              color: '#111827',
              background: '#ffffff',
            }}
          >
            {/* Formal Government Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', color: '#1e3a8a', textTransform: 'uppercase' }}>
                State Government of Uttar Pradesh • Department of Basic Education & PWD Road Safety Cell
              </div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 900, margin: '0.35rem 0', color: '#0f172a' }}>
                {dossier.documentTitle}
              </h1>
              <div style={{ fontSize: '0.82rem', fontStyle: 'italic', color: '#475569' }}>
                {dossier.statutoryMandate}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Dossier Generated: {new Date(dossier.auditMetadata.generatedAt).toLocaleString()} • Registered UDISE+: {dossier.schoolSummary.udiseCode}
              </div>
            </div>

            {/* School Particulars Grid */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
              }}
            >
              <tbody>
                <tr style={{ background: '#f8fafc' }}>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontWeight: 700, width: '25%' }}>Institution Name</td>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }} colSpan={3}>
                    {dossier.schoolSummary.name}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontWeight: 700 }}>UDISE+ Identifier</td>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}>
                    {dossier.schoolSummary.udiseCode}
                  </td>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontWeight: 700, width: '20%' }}>Category & Enrollment</td>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>
                    {dossier.schoolSummary.category} (~{dossier.schoolSummary.studentStrength} students)
                  </td>
                </tr>
                <tr style={{ background: '#f8fafc' }}>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontWeight: 700 }}>District & Locality</td>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>
                    {dossier.schoolSummary.district} ({dossier.schoolSummary.blockOrWard})
                  </td>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontWeight: 700 }}>Settlement Scope</td>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', textTransform: 'capitalize' }}>
                    {dossier.schoolSummary.locationType} Corridor
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontWeight: 700 }}>SMC Leadership</td>
                  <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }} colSpan={3}>
                    President: {dossier.schoolSummary.smcDetails?.presidentName || 'N/A'} • Head Teacher: {dossier.schoolSummary.smcDetails?.headTeacherName || 'N/A'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Verified Entrances & Frontage */}
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '1rem 0 0.4rem 0', textTransform: 'uppercase', color: '#1e3a8a' }}>
              1. Verified Entrance Gates & Road Frontage Geometry
            </h3>
            <ul style={{ margin: '0 0 1rem 1.25rem', padding: 0, fontSize: '0.84rem' }}>
              {dossier.schoolSummary.verifiedEntrances?.map((ent) => (
                <li key={ent.gateId} style={{ marginBottom: '0.25rem' }}>
                  <strong>{ent.name}:</strong> Facing {ent.facingRoadName} ({ent.roadClassification}).
                  Designated Speed Limit: {ent.speedLimitDesignatedKmH} km/h (Signage Present: {ent.speedLimitSignPresent ? 'Yes' : 'No'}).
                </li>
              ))}
            </ul>

            {/* Itemized Hazard Inventory */}
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '1rem 0 0.4rem 0', textTransform: 'uppercase', color: '#1e3a8a' }}>
              2. Documented Road Safety Hazards & Infrastructure Deficiencies
            </h3>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '1.25rem',
                fontSize: '0.8rem',
              }}
            >
              <thead>
                <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>Report ID</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>Hazard Category</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>Severity</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>Responsible Authority</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>Status</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>Suggested Engineering Intervention</th>
                </tr>
              </thead>
              <tbody>
                {dossier.hazardInventory.map((item) => (
                  <tr key={item.reportId}>
                    <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}>
                      {item.reportId}
                    </td>
                    <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                      {item.hazardType}
                    </td>
                    <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1', fontWeight: 700 }}>
                      {item.severity}
                    </td>
                    <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>
                      {item.assignedAuthority}
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({item.authoritySource})</div>
                    </td>
                    <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>
                      {item.status}
                    </td>
                    <td style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>
                      {item.suggestedIntervention}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Recommended Statutory Actions */}
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '1rem 0 0.4rem 0', textTransform: 'uppercase', color: '#1e3a8a' }}>
              3. Recommended SMC Resolutions & Authority Submissions
            </h3>
            <ol style={{ margin: '0 0 1.25rem 1.25rem', padding: 0, fontSize: '0.84rem' }}>
              {dossier.actionRecommendations.map((rec, i) => (
                <li key={i} style={{ marginBottom: '0.35rem' }}>
                  {rec}
                </li>
              ))}
            </ol>

            {/* Ethical Non-Fault Notice */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: '0.75rem',
                color: '#475569',
                marginBottom: '1.75rem',
              }}
            >
              <strong>Notice of Empirical Observation:</strong> {dossier.ethicalDisclaimer}
            </div>

            {/* Signature Blocks */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1.5rem',
                marginTop: '2rem',
                paddingTop: '1rem',
              }}
            >
              {dossier.signOffBlocks.map((block, i) => (
                <div key={i} style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700 }}>{block.role}</div>
                  <div style={{ color: '#475569', fontSize: '0.75rem' }}>Name: {block.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.75rem' }}>
                    Signature & Date: ___________________
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

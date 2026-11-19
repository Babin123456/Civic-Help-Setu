import { useState } from 'react';
import {
  RERA_JURISDICTIONS,
  RERA_FORM_TYPE,
  RERA_RELIEF_TYPE,
  DEFAULT_STATUTORY_INTEREST_RATE,
  draftReraDisputePetition,
} from '../../services/reraDisputeService.js';
import { FileText, Copy, Check, Download, ExternalLink, ShieldCheck } from 'lucide-react';

export default function ReraPetitionDrafter({
  petitionState = {},
  onPetitionFieldChange,
  onSaveComplaint,
}) {
  const [copied, setCopied] = useState(false);

  const jurisdictionKey = petitionState.jurisdiction || 'MAHARASHTRA';
  const jurisdiction = RERA_JURISDICTIONS[jurisdictionKey] || RERA_JURISDICTIONS.MAHARASHTRA;
  const formType = petitionState.formType || RERA_FORM_TYPE.FORM_M;

  const generatedPetitionText = draftReraDisputePetition({
    jurisdiction: jurisdictionKey,
    formType,
    committedPossessionDate: petitionState.committedPossessionDate,
    gracePeriodMonths: petitionState.gracePeriodMonths || 0,
    agreementDate: petitionState.agreementDate,
    evaluationDate: petitionState.evaluationDate,
    totalPaidInr: petitionState.totalPaidInr || 0,
    totalAgreementCostInr: petitionState.totalAgreementCostInr || 0,
    annualInterestRate: petitionState.annualInterestRate || DEFAULT_STATUTORY_INTEREST_RATE,
    reliefType: petitionState.reliefType || RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST,
    complainant: petitionState.complainant,
    promoter: petitionState.promoter,
    unitDetails: petitionState.unitDetails,
    interimReliefs: petitionState.interimReliefs,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPetitionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleDownloadSlip = () => {
    const blob = new Blob([generatedPetitionText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RERA_${formType}_Petition_${jurisdictionKey}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-light, #334155)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              display: 'flex',
            }}
          >
            <FileText size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
              Statutory Form M / Form N Legal Petition Generator
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Generates court-ready complaint text for submission on state RERA portals
            </p>
          </div>
        </div>

        <a
          href={jurisdiction.portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            color: '#3b82f6',
            textDecoration: 'none',
          }}
        >
          <span>Open {jurisdiction.authorityName.split('(')[1]?.replace(')', '') || 'RERA Portal'}</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Jurisdiction & Form Selection */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label
            htmlFor="jurisdiction-select"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            State RERA Authority *
          </label>
          <select
            id="jurisdiction-select"
            value={jurisdictionKey}
            onChange={(e) => onPetitionFieldChange?.('jurisdiction', e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          >
            {Object.entries(RERA_JURISDICTIONS).map(([key, val]) => (
              <option key={key} value={key}>
                {val.stateName} - {val.authorityName}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Filing Fee: Rs. {jurisdiction.standardFeeInr} | Citation: {jurisdiction.rulesCitation}
          </span>
        </div>

        <div>
          <label
            htmlFor="form-type-select"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Statutory Forum & Form Code *
          </label>
          <select
            id="form-type-select"
            value={formType}
            onChange={(e) => onPetitionFieldChange?.('formType', e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          >
            <option value={RERA_FORM_TYPE.FORM_M}>
              Form M - Section 31 (Before Real Estate Regulatory Authority)
            </option>
            <option value={RERA_FORM_TYPE.FORM_N}>
              Form N - Section 71 (Before Adjudicating Officer for Compensation)
            </option>
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Form M for directions, delay interest & refund; Form N for compensation adjudication
          </span>
        </div>
      </div>

      {/* Case Particulars */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label
            htmlFor="complainant-name"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Complainant Full Name *
          </label>
          <input
            id="complainant-name"
            type="text"
            value={petitionState.complainant?.name || ''}
            onChange={(e) =>
              onPetitionFieldChange?.('complainant', {
                ...petitionState.complainant,
                name: e.target.value,
              })
            }
            placeholder="e.g. Anand Sundaram"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="complainant-contact"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Phone Number / Email
          </label>
          <input
            id="complainant-contact"
            type="text"
            value={petitionState.complainant?.contact || ''}
            onChange={(e) =>
              onPetitionFieldChange?.('complainant', {
                ...petitionState.complainant,
                contact: e.target.value,
              })
            }
            placeholder="e.g. 9876543210"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="promoter-name"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Promoter / Developer Name *
          </label>
          <input
            id="promoter-name"
            type="text"
            value={petitionState.promoter?.name || ''}
            onChange={(e) =>
              onPetitionFieldChange?.('promoter', {
                ...petitionState.promoter,
                name: e.target.value,
              })
            }
            placeholder="e.g. Urban Heights Private Ltd."
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="project-name"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Project Name *
          </label>
          <input
            id="project-name"
            type="text"
            value={petitionState.promoter?.projectName || ''}
            onChange={(e) =>
              onPetitionFieldChange?.('promoter', {
                ...petitionState.promoter,
                projectName: e.target.value,
              })
            }
            placeholder="e.g. Serene Meadows Phase I"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="rera-reg-no"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Project RERA Reg. No.
          </label>
          <input
            id="rera-reg-no"
            type="text"
            value={petitionState.promoter?.reraRegNo || ''}
            onChange={(e) =>
              onPetitionFieldChange?.('promoter', {
                ...petitionState.promoter,
                reraRegNo: e.target.value,
              })
            }
            placeholder={`e.g. ${jurisdiction.registrationPrefix}...`}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="unit-no"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Allotted Unit / Flat No.
          </label>
          <input
            id="unit-no"
            type="text"
            value={petitionState.unitDetails?.unitNo || ''}
            onChange={(e) =>
              onPetitionFieldChange?.('unitDetails', {
                ...petitionState.unitDetails,
                unitNo: e.target.value,
              })
            }
            placeholder="e.g. Tower B - 1402"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>
      </div>

      {/* Live Petition Preview */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
            Statutory Complaint Text Preview
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
              }}
            >
              {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Petition'}
            </button>
            <button
              type="button"
              onClick={handleDownloadSlip}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
              }}
            >
              <Download size={14} /> Download Slip
            </button>
          </div>
        </div>

        <pre
          style={{
            margin: 0,
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-primary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            color: 'var(--text-primary, #f8fafc)',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '260px',
            overflowY: 'auto',
            fontFamily: 'monospace',
          }}
        >
          {generatedPetitionText}
        </pre>
      </div>

      {/* Action footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onSaveComplaint}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.9rem',
            padding: '0.6rem 1.25rem',
          }}
        >
          <ShieldCheck size={18} />
          Save to Privacy Vault Locker
        </button>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  FileText,
  Copy,
  Printer,
  Save,
  Check,
} from 'lucide-react';
import { generateRteSection32Petition } from '../../services/rteAdmissionService.js';
import { saveRteGrievanceRecord } from '../../services/rteAdmissionStorage.js';
import { fillTextPrintWindow, PETITION_PRINT_BODY_STYLE } from '../../utils/printHtml.js';

export default function RtePetitionDrafter({
  eligibilityData,
  screeningData,
  billingData,
  onRecordSaved,
}) {
  const [childName, setChildName] = useState('Aarav Sharma');
  const [dateOfBirth, setDateOfBirth] = useState('2020-04-12');
  const [guardianName, setGuardianName] = useState('Rakesh Sharma');
  const [contactPhone, setContactPhone] = useState('9876543210');
  const [residentialAddress, setResidentialAddress] = useState('Flat 204, Pocket B, Rohini Sector 15');
  const [allotmentSlipId, setAllotmentSlipId] = useState('RTE-2026-DL-88902');
  const [targetGrade, setTargetGrade] = useState('Class 1');
  const [category, setCategory] = useState('Economically Weaker Section (EWS)');
  const [schoolName, setSchoolName] = useState('St. Xavier Convent School');
  const [schoolAddress, setSchoolAddress] = useState('Main Ring Road, Rohini');
  const [blockName, setBlockName] = useState('North-West District Block A');
  const [districtName, setDistrictName] = useState('North West Delhi');
  const [stateName, setStateName] = useState('Delhi');
  const [denialReason, setDenialReason] = useState('School authorities demanded advance donation of ₹25,000 and refused admission seat allocated in official lottery');

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const petitionText = useMemo(() => {
    return generateRteSection32Petition({
      childName,
      dateOfBirth,
      guardianName,
      contactPhone,
      residentialAddress,
      allotmentSlipId,
      category,
      targetGrade,
      schoolName,
      schoolAddress,
      blockName,
      districtName,
      stateName,
      eligibilityData,
      screeningData,
      billingData,
      denialReason,
    });
  }, [
    childName,
    dateOfBirth,
    guardianName,
    contactPhone,
    residentialAddress,
    allotmentSlipId,
    category,
    targetGrade,
    schoolName,
    schoolAddress,
    blockName,
    districtName,
    stateName,
    eligibilityData,
    screeningData,
    billingData,
    denialReason,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(petitionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    fillTextPrintWindow(printWindow, `RTE Section 32 Statutory Complaint - ${childName}`, petitionText, PETITION_PRINT_BODY_STYLE);
    printWindow.focus();
    printWindow.print();
  };

  const handleSaveToVault = async () => {
    setSaving(true);
    setSaveSuccess(null);
    try {
      const saved = await saveRteGrievanceRecord({
        childName,
        dateOfBirth,
        guardianName,
        contactPhone,
        residentialAddress,
        allotmentSlipId,
        category,
        targetGrade,
        schoolName,
        schoolAddress,
        blockName,
        districtName,
        stateName,
        denialReason,
        eligibility: eligibilityData,
        screeningAnalysis: screeningData,
        billingAnalysis: billingData,
      });

      setSaveSuccess(`Petition saved to vault with seal: ${saved.sha256Seal?.slice(0, 12)}...`);
      if (onRecordSaved) onRecordSaved(saved);
    } catch {
      setSaveSuccess('Error saving petition to vault');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <FileText style={{ width: 28, height: 28, color: '#38bdf8' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Section 32 Statutory Redressal Petition Drafter
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Auto-formulates formal complaints to BEO / DEO, State Child Rights Commission (SCPCR) and NCPCR
          </span>
        </div>
      </div>

      {/* Input Metadata Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Child Applicant Name
          </label>
          <input
            type="text"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Child Date of Birth
          </label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Contact Telephone
          </label>
          <input
            type="text"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Residential Address
          </label>
          <input
            type="text"
            value={residentialAddress}
            onChange={(e) => setResidentialAddress(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Target Grade &amp; Category
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value)}
              placeholder="Grade"
              style={{
                width: '40%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-dark, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #334155)',
              }}
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              style={{
                width: '60%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-dark, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #334155)',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            School Address &amp; Block
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
              placeholder="School Address"
              style={{
                width: '50%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-dark, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #334155)',
              }}
            />
            <input
              type="text"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              placeholder="Block"
              style={{
                width: '50%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-dark, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #334155)',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Parent / Guardian Name
          </label>
          <input
            type="text"
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            RTE Allocation / Reference ID
          </label>
          <input
            type="text"
            value={allotmentSlipId}
            onChange={(e) => setAllotmentSlipId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Respondent School Name
          </label>
          <input
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            District &amp; State
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              placeholder="District"
              style={{
                width: '50%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-dark, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #334155)',
              }}
            />
            <input
              type="text"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              placeholder="State"
              style={{
                width: '50%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-dark, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #334155)',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Specific Ground for Admission Refusal
          </label>
          <input
            type="text"
            value={denialReason}
            onChange={(e) => setDenialReason(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>
      </div>

      {/* Legal Text Area */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <pre
          style={{
            background: 'var(--bg-dark, #0f172a)',
            padding: '1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
            color: 'var(--text-primary, #f8fafc)',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            maxHeight: '360px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
          }}
        >
          {petitionText}
        </pre>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '0.5rem',
            background: copied ? '#22c55e' : '#0284c7',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          {copied ? <Check style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
          {copied ? 'Copied to Clipboard' : 'Copy Full Petition'}
        </button>

        <button
          type="button"
          onClick={handlePrint}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-dark, #0f172a)',
            color: 'var(--text-primary, #f8fafc)',
            border: '1px solid var(--border-light, #334155)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          <Printer style={{ width: 16, height: 16 }} />
          Print / Export PDF
        </button>

        <button
          type="button"
          onClick={handleSaveToVault}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '0.5rem',
            background: '#10b981',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          <Save style={{ width: 16, height: 16 }} />
          {saving ? 'Generating Seal...' : 'Save to Offline Vault'}
        </button>

        {saveSuccess && (
          <span style={{ fontSize: '0.82rem', color: '#4ade80', fontWeight: 500 }}>
            {saveSuccess}
          </span>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  FileText,
  Copy,
  Download,
  Save,
  CheckCircle,
} from 'lucide-react';
import { generateDistrictRegisteringAuthorityComplaint } from '../../services/clinicalEstablishmentService.js';

export default function DistrictAuthorityComplaintDrafter({
  compliance,
  billingAnalysis,
  onSaveToVault,
}) {
  const [complainantName, setComplainantName] = useState('Anand Kumar');
  const [complainantAddress, setComplainantAddress] = useState('Flat 402, Green Meadows, Indirapuram, Ghaziabad, UP');
  const [complainantContact, setComplainantContact] = useState('+91 98112 34567');
  const [hospitalName, setHospitalName] = useState('Apex Super Specialty Hospital');
  const [hospitalAddress, setHospitalAddress] = useState('Plot 14, Sector 62, Noida, Gautam Buddha Nagar, UP');
  const [district, setDistrict] = useState('Gautam Buddha Nagar');
  const [state, setState] = useState('Uttar Pradesh');
  const [admissionDate, setAdmissionDate] = useState('2026-03-01');
  const [dischargeDate, setDischargeDate] = useState('2026-03-06');
  const [ipdNumber, setIpdNumber] = useState('IPD-2026-8812');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const grievancePayload = useMemo(() => {
    return {
      patient: {
        name: complainantName,
        address: complainantAddress,
        contact: complainantContact,
      },
      hospitalName,
      hospitalAddress,
      district,
      state,
      admissionDate,
      dischargeDate,
      ipdNumber,
      compliance,
      billingAnalysis,
    };
  }, [
    complainantName,
    complainantAddress,
    complainantContact,
    hospitalName,
    hospitalAddress,
    district,
    state,
    admissionDate,
    dischargeDate,
    ipdNumber,
    compliance,
    billingAnalysis,
  ]);

  const complaintText = useMemo(() => {
    return generateDistrictRegisteringAuthorityComplaint(grievancePayload);
  }, [grievancePayload]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(complaintText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([complaintText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `District_Registering_Authority_Complaint_${ipdNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (onSaveToVault) {
      onSaveToVault(grievancePayload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
            }}
          >
            <FileText size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
              District Registering Authority Statutory Complaint Drafter (Section 41 & 42 CEA 2010)
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Formal legal representation addressed to District Magistrate (DM) and Chief Medical Officer (CMO)
            </p>
          </div>
        </div>
      </div>

      {/* Complainant & Hospital Form Fields */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
          padding: '1rem',
          background: 'var(--bg-secondary, #0f172a)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-light, #334155)',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
            Complainant / Representative Name
          </label>
          <input
            type="text"
            value={complainantName}
            onChange={(e) => setComplainantName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              background: 'var(--bg-input, #1e293b)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #475569)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
            Complainant Contact (Mobile / Email)
          </label>
          <input
            type="text"
            value={complainantContact}
            onChange={(e) => setComplainantContact(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              background: 'var(--bg-input, #1e293b)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #475569)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
            Complainant Residential Address
          </label>
          <input
            type="text"
            value={complainantAddress}
            onChange={(e) => setComplainantAddress(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              background: 'var(--bg-input, #1e293b)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #475569)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
            Clinical Establishment / Hospital Name
          </label>
          <input
            type="text"
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              background: 'var(--bg-input, #1e293b)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #475569)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
            Clinical Establishment Address
          </label>
          <input
            type="text"
            value={hospitalAddress}
            onChange={(e) => setHospitalAddress(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              background: 'var(--bg-input, #1e293b)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #475569)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
            District & State
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="District"
              style={{
                width: '50%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: 'var(--bg-input, #1e293b)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #475569)',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
              style={{
                width: '50%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: 'var(--bg-input, #1e293b)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #475569)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
            Patient IPD / UHID Number
          </label>
          <input
            type="text"
            value={ipdNumber}
            onChange={(e) => setIpdNumber(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              background: 'var(--bg-input, #1e293b)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #475569)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
            Admission & Discharge Dates
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
              style={{
                width: '50%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: 'var(--bg-input, #1e293b)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #475569)',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
              style={{
                width: '50%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: 'var(--bg-input, #1e293b)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #475569)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: copied ? '#22c55e' : '#3b82f6',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
        >
          {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
          {copied ? 'Copied to Clipboard!' : 'Copy Complaint'}
        </button>

        <button
          type="button"
          onClick={handleDownload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #475569)',
            background: 'var(--bg-secondary, #0f172a)',
            color: 'var(--text-primary, #f8fafc)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          <Download size={16} />
          Download Text Memorandum (.txt)
        </button>

        <button
          type="button"
          onClick={handleSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #10b981',
            background: savedSuccess ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
            color: savedSuccess ? '#ffffff' : '#10b981',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Save size={16} />
          {savedSuccess ? 'Saved to Vault!' : 'Save Grievance to Vault'}
        </button>
      </div>

      {/* Generated text preview */}
      <pre
        style={{
          background: 'var(--bg-secondary, #0f172a)',
          color: 'var(--text-primary, #cbd5e1)',
          padding: '1.25rem',
          borderRadius: '0.5rem',
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          overflowX: 'auto',
          maxHeight: '400px',
          border: '1px solid var(--border-light, #334155)',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.5',
        }}
      >
        {complaintText}
      </pre>
    </div>
  );
}

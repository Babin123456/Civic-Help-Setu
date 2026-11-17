import { useState, useMemo } from 'react';
import {
  FileText,
  Copy,
  Printer,
  Save,
  Check,
} from 'lucide-react';
import { generateCgrfPetition } from '../../services/electricityConsumerService.js';
import { saveElectricityGrievanceRecord } from '../../services/electricityConsumerStorage.js';
import { fillTextPrintWindow, PETITION_PRINT_BODY_STYLE } from '../../utils/printHtml.js';

export default function CgrfPetitionDrafterCard({
  sopData,
  disconnectionData,
  meterData,
  onRecordSaved,
}) {
  const [consumerName, setConsumerName] = useState('Sunil Verma');
  const [caNumber, setCaNumber] = useState('CA-10029384');
  const [meterNumber, setMeterNumber] = useState('MTR-882910');
  const [sanctionedLoadKw, setSanctionedLoadKw] = useState('3 kW Domestic');
  const [consumerAddress, setConsumerAddress] = useState('B-402, Shanti Vihar, Ward 14');
  const [contactPhone, setContactPhone] = useState('9876501234');
  const [discomName, setDiscomName] = useState('BESCOM (Bangalore Electricity Supply Company)');
  const [divisionOffice, setDivisionOffice] = useState('East Sub-Divisional Office, Indiranagar');
  const [districtName, setDistrictName] = useState('Bengaluru Urban');
  const [stateName, setStateName] = useState('Karnataka');
  const [grievanceDescription, setGrievanceDescription] = useState('Prolonged unscheduled outage lasting 24 hours followed by arbitrary disconnection without 15 days notice and inflated meter billing');

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const petitionText = useMemo(() => {
    return generateCgrfPetition({
      consumerName,
      caNumber,
      meterNumber,
      sanctionedLoadKw,
      consumerAddress,
      contactPhone,
      discomName,
      divisionOffice,
      districtName,
      stateName,
      sopData,
      disconnectionData,
      meterData,
      grievanceDescription,
    });
  }, [
    consumerName,
    caNumber,
    meterNumber,
    sanctionedLoadKw,
    consumerAddress,
    contactPhone,
    discomName,
    divisionOffice,
    districtName,
    stateName,
    sopData,
    disconnectionData,
    meterData,
    grievanceDescription,
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
    fillTextPrintWindow(printWindow, `CGRF Section 42(5) Petition - ${consumerName}`, petitionText, PETITION_PRINT_BODY_STYLE);
    printWindow.focus();
    printWindow.print();
  };

  const handleSaveToVault = async () => {
    setSaving(true);
    setSaveSuccess(null);
    try {
      const saved = await saveElectricityGrievanceRecord({
        consumerName,
        caNumber,
        meterNumber,
        sanctionedLoadKw,
        consumerAddress,
        contactPhone,
        discomName,
        divisionOffice,
        districtName,
        stateName,
        grievanceDescription,
        sopAnalysis: sopData,
        disconnectionAnalysis: disconnectionData,
        meterAnalysis: meterData,
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
            Section 42(5) CGRF &amp; Electricity Ombudsman Statutory Petition Drafter
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Auto-formulates formal complaints to the Consumer Grievance Redressal Forum with Section 142 penal prayers
          </span>
        </div>
      </div>

      {/* Inputs Grid */}
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
            Consumer Full Name
          </label>
          <input
            type="text"
            value={consumerName}
            onChange={(e) => setConsumerName(e.target.value)}
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
            Consumer Account (CA) / Service ID
          </label>
          <input
            type="text"
            value={caNumber}
            onChange={(e) => setCaNumber(e.target.value)}
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
            Meter Serial Number
          </label>
          <input
            type="text"
            value={meterNumber}
            onChange={(e) => setMeterNumber(e.target.value)}
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
            Sanctioned Load &amp; Category
          </label>
          <input
            type="text"
            value={sanctionedLoadKw}
            onChange={(e) => setSanctionedLoadKw(e.target.value)}
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
            Service Address &amp; Contact
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={consumerAddress}
              onChange={(e) => setConsumerAddress(e.target.value)}
              placeholder="Premises Address"
              style={{
                width: '60%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-dark, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #334155)',
              }}
            />
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Phone"
              style={{
                width: '40%',
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
            Respondent DISCOM &amp; Division
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={discomName}
              onChange={(e) => setDiscomName(e.target.value)}
              placeholder="DISCOM Name"
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
              value={divisionOffice}
              onChange={(e) => setDivisionOffice(e.target.value)}
              placeholder="Division Office"
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
            Specific Statement of Grievance
          </label>
          <input
            type="text"
            value={grievanceDescription}
            onChange={(e) => setGrievanceDescription(e.target.value)}
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

      {/* Petition Preview */}
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

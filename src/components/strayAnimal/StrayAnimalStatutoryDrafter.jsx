import { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  Building,
  Save,
  ShieldAlert,
} from 'lucide-react';
import {
  generateMunicipalAbcRequisition,
  generateRabiesPepSlip,
} from '../../services/strayAnimalAbcService.js';

export default function StrayAnimalStatutoryDrafter({
  pepCalculationData,
  onSaveRecord,
}) {
  const [draftMode, setDraftMode] = useState('MUNICIPAL_REQUISITION'); // 'MUNICIPAL_REQUISITION' or 'RABIES_PEP_SLIP'
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form Fields
  const [applicantName, setApplicantName] = useState('Pooja Varma');
  const [applicantContact, setApplicantContact] = useState('9876543210');
  const [applicantAddress, setApplicantAddress] = useState('Flat 402, Oakwood Enclave, 12th Cross Road');
  const [ward, setWard] = useState('Ward 42 (Indiranagar)');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [unsterilizedDogs, setUnsterilizedDogs] = useState('45');
  const [aggressiveIncidents, setAggressiveIncidents] = useState('Recurring territorial pack fights and bite incident reported near main park gate');

  const generatedText = useMemo(() => {
    if (draftMode === 'MUNICIPAL_REQUISITION') {
      return generateMunicipalAbcRequisition({
        applicant: {
          name: applicantName,
          contact: applicantContact,
          address: applicantAddress,
        },
        location: {
          ward,
          city,
          state,
        },
        unsterilizedDogs,
        aggressiveIncidents,
      });
    }

    return generateRabiesPepSlip({
      patient: {
        name: applicantName,
        age: '29 / Female',
        weightKg: pepCalculationData?.weightKg || 60,
      },
      exposureDate: pepCalculationData?.exposureDate || new Date().toISOString().slice(0, 10),
      animalType: 'Stray Dog',
      category: pepCalculationData?.selectedCategory || 'CATEGORY_III',
      regimenKey: pepCalculationData?.regimenKey || 'ESSEN_IM',
      rigType: pepCalculationData?.rigType || 'HRIG',
    });
  }, [
    draftMode,
    applicantName,
    applicantContact,
    applicantAddress,
    ward,
    city,
    state,
    unsterilizedDogs,
    aggressiveIncidents,
    pepCalculationData,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const filename = draftMode === 'MUNICIPAL_REQUISITION'
      ? `Municipal_ABC_Requisition_${ward.replace(/\s+/g, '_')}.txt`
      : `Rabies_PEP_Medical_Passport_${applicantName.replace(/\s+/g, '_')}.txt`;

    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveToVault = async () => {
    if (!onSaveRecord) return;

    const payload = draftMode === 'MUNICIPAL_REQUISITION'
      ? {
          recordType: 'ward_abc_requisition',
          applicant: { name: applicantName, contact: applicantContact, address: applicantAddress },
          location: { ward, city, state },
          wardNumber: ward,
          unsterilizedDogs,
          aggressiveIncidents,
          generatedText,
        }
      : {
          recordType: 'pep_vaccination_log',
          patient: { name: applicantName, contact: applicantContact, weightKg: pepCalculationData?.weightKg || 60 },
          category: pepCalculationData?.selectedCategory || 'CATEGORY_III',
          exposureDate: pepCalculationData?.exposureDate || new Date().toISOString().slice(0, 10),
          weightKg: pepCalculationData?.weightKg || 60,
          regimenKey: pepCalculationData?.regimenKey || 'ESSEN_IM',
          rigType: pepCalculationData?.rigType || 'HRIG',
          wardNumber: ward,
          generatedText,
        };

    await onSaveRecord(payload);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Statutory Animal Conflict &amp; Emergency Drafter
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Generate statutory municipal ABC requisitions or WHO-compliant Rabies PEP medical passports
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-card-secondary, #0f172a)', padding: '0.25rem', borderRadius: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setDraftMode('MUNICIPAL_REQUISITION')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '0.35rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: draftMode === 'MUNICIPAL_REQUISITION' ? '#3b82f6' : 'transparent',
              color: draftMode === 'MUNICIPAL_REQUISITION' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Building size={14} />
            Municipal ABC Requisition
          </button>

          <button
            type="button"
            onClick={() => setDraftMode('RABIES_PEP_SLIP')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '0.35rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: draftMode === 'RABIES_PEP_SLIP' ? '#ef4444' : 'transparent',
              color: draftMode === 'RABIES_PEP_SLIP' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <ShieldAlert size={14} />
            Rabies PEP Medical Passport
          </button>
        </div>
      </div>

      {/* Input Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            {draftMode === 'MUNICIPAL_REQUISITION' ? 'Applicant / RWA Name' : 'Patient Full Name'}
          </label>
          <input
            type="text"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Contact Number
          </label>
          <input
            type="text"
            value={applicantContact}
            onChange={(e) => setApplicantContact(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Ward / Locality
          </label>
          <input
            type="text"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            City / Municipality
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            State
          </label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Address / Landmark
          </label>
          <input
            type="text"
            value={applicantAddress}
            onChange={(e) => setApplicantAddress(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {draftMode === 'MUNICIPAL_REQUISITION' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              Est. Unsterilized Dogs
            </label>
            <input
              type="text"
              value={unsterilizedDogs}
              onChange={(e) => setUnsterilizedDogs(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #334155)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              Ground Aggression / Incident Description
            </label>
            <input
              type="text"
              value={aggressiveIncidents}
              onChange={(e) => setAggressiveIncidents(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #334155)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>
      )}

      {/* Document Preview Box */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <textarea
          readOnly
          value={generatedText}
          rows={14}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #334155)',
            background: 'var(--bg-card-secondary, #0f172a)',
            color: 'var(--text-primary)',
            resize: 'vertical',
            lineHeight: 1.45,
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid var(--border-light, #334155)',
            background: 'var(--bg-card-secondary, #0f172a)',
            color: 'var(--text-primary)',
          }}
        >
          {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
          {copied ? 'Copied to Clipboard' : 'Copy Text'}
        </button>

        <button
          type="button"
          onClick={handleDownload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid var(--border-light, #334155)',
            background: 'var(--bg-card-secondary, #0f172a)',
            color: 'var(--text-primary)',
          }}
        >
          <Download size={16} />
          Download .TXT
        </button>

        {onSaveRecord && (
          <button
            type="button"
            onClick={handleSaveToVault}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: saveSuccess ? '#22c55e' : '#3b82f6',
              color: '#ffffff',
              transition: 'background 0.2s ease',
            }}
          >
            {saveSuccess ? <Check size={16} /> : <Save size={16} />}
            {saveSuccess ? 'Saved to Vault!' : 'Save Record to Vault'}
          </button>
        )}
      </div>
    </div>
  );
}

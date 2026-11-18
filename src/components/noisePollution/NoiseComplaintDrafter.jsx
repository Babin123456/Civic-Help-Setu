import { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  Save,
  FileText,
} from 'lucide-react';
import { generateRule7ComplaintMemorandum } from '../../services/noisePollutionService.js';

export default function NoiseComplaintDrafter({
  evaluationData,
  onSaveLog,
}) {
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form Fields
  const [complainantName, setComplainantName] = useState('Dr. Sangeeta Kulkarni');
  const [complainantContact, setComplainantContact] = useState('9845012345');
  const [complainantAddress, setComplainantAddress] = useState('Flat 401, Silver Oak Residency, 4th Main Road');
  const [sdmOffice, setSdmOffice] = useState('Sub-Divisional Magistrate (SDM) East Division');
  const [policeStation, setPoliceStation] = useState('Indiranagar Police Station');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [incidentLocation, setIncidentLocation] = useState('Open-air lawn opposite Silver Oak Residency');
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));

  const generatedText = useMemo(() => {
    return generateRule7ComplaintMemorandum({
      complainant: {
        name: complainantName,
        contact: complainantContact,
        address: complainantAddress,
      },
      authority: {
        sdmOffice,
        policeStation,
      },
      location: {
        city,
        state,
        incidentLocation,
      },
      incidentDate,
      evaluation: evaluationData || {},
    });
  }, [
    complainantName,
    complainantContact,
    complainantAddress,
    sdmOffice,
    policeStation,
    city,
    state,
    incidentLocation,
    incidentDate,
    evaluationData,
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
    const filename = `Rule7_Noise_Complaint_${city}_${incidentDate}.txt`;
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
    if (!onSaveLog) return;

    const payload = {
      observedDbA: evaluationData?.observedDbA || 65,
      zoneKey: evaluationData?.zoneKey || 'RESIDENTIAL_AREA',
      exceedanceDbA: evaluationData?.exceedanceDbA || 0,
      sourceType: evaluationData?.sourceType || 'LOUDSPEAKER_OR_PA_SYSTEM',
      hourOfDay: evaluationData?.hourOfDay || 22,
      incidentLocation,
      complainant: {
        name: complainantName,
        contact: complainantContact,
        address: complainantAddress,
      },
      location: {
        city,
        state,
        incidentLocation,
      },
      authority: {
        sdmOffice,
        policeStation,
      },
      evaluation: evaluationData,
      generatedText,
    };

    await onSaveLog(payload);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            padding: '0.6rem',
            background: 'rgba(239, 68, 68, 0.15)',
            borderRadius: '0.75rem',
            color: '#ef4444',
          }}
        >
          <FileText size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Rule 7 Statutory Complaint Memorandum Drafter
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Court-ready formal petition to Sub-Divisional Magistrate (SDM) &amp; Police Station House Officer (SHO)
          </p>
        </div>
      </div>

      {/* Inputs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Complainant Full Name
          </label>
          <input
            type="text"
            value={complainantName}
            onChange={(e) => setComplainantName(e.target.value)}
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
            Phone / Contact
          </label>
          <input
            type="text"
            value={complainantContact}
            onChange={(e) => setComplainantContact(e.target.value)}
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
            Sub-Divisional Magistrate (SDM)
          </label>
          <input
            type="text"
            value={sdmOffice}
            onChange={(e) => setSdmOffice(e.target.value)}
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
            Police Station / DCP Office
          </label>
          <input
            type="text"
            value={policeStation}
            onChange={(e) => setPoliceStation(e.target.value)}
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
            City / District
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

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Date of Incident
          </label>
          <input
            type="date"
            value={incidentDate}
            onChange={(e) => setIncidentDate(e.target.value)}
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
            Exact Incident Location / Street
          </label>
          <input
            type="text"
            value={incidentLocation}
            onChange={(e) => setIncidentLocation(e.target.value)}
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

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
          Complainant Residential Address
        </label>
        <input
          type="text"
          value={complainantAddress}
          onChange={(e) => setComplainantAddress(e.target.value)}
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

      {/* Memorandum Output Box */}
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
          {copied ? 'Copied to Clipboard' : 'Copy Memorandum'}
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

        {onSaveLog && (
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
              background: saveSuccess ? '#22c55e' : '#ef4444',
              color: '#ffffff',
              transition: 'background 0.2s ease',
            }}
          >
            {saveSuccess ? <Check size={16} /> : <Save size={16} />}
            {saveSuccess ? 'Saved to Vault!' : 'Save Log to Vault'}
          </button>
        )}
      </div>
    </div>
  );
}

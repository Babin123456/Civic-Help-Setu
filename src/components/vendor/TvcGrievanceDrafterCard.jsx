import { useState, useMemo } from 'react';
import {
  FileText,
  Copy,
  Printer,
  Save,
  Check,
} from 'lucide-react';
import { generateSection20GrievancePetition } from '../../services/streetVendorService.js';
import { saveVendorRightsRecord } from '../../services/streetVendorStorage.js';
import { fillTextPrintWindow, PETITION_PRINT_BODY_STYLE } from '../../utils/printHtml.js';

export default function TvcGrievanceDrafterCard({
  immunityData,
  goodsSeizureData,
  relocationData,
  onRecordSaved,
}) {
  const [vendorName, setVendorName] = useState('Rameshwar Lal');
  const [vendingCategory, setVendingCategory] = useState('Stationary Street Vendor (Fixed Pitch)');
  const [vendingPitchLocation, setVendingPitchLocation] = useState('Pavement opposite Civil Hospital, Main Road');
  const [yearsActive, setYearsActive] = useState(6);
  const [wardNumber, setWardNumber] = useState('Ward 18');
  const [zoneName, setZoneName] = useState('Central Zone');
  const [municipalityName, setMunicipalityName] = useState('Municipal Corporation');
  const [contactPhone, setContactPhone] = useState('9810234567');
  const [grievanceSummary, setGrievanceSummary] = useState('Summary eviction and seizure of tea cart with perishable snacks without inventory memo during TVC survey protection');

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const petitionText = useMemo(() => {
    return generateSection20GrievancePetition({
      vendorName,
      vendingCategory,
      vendingPitchLocation,
      yearsActive: Number(yearsActive) || 1,
      wardNumber,
      zoneName,
      municipalityName,
      contactPhone,
      immunityData,
      goodsSeizureData,
      relocationData,
      grievanceSummary,
    });
  }, [
    vendorName,
    vendingCategory,
    vendingPitchLocation,
    yearsActive,
    wardNumber,
    zoneName,
    municipalityName,
    contactPhone,
    immunityData,
    goodsSeizureData,
    relocationData,
    grievanceSummary,
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
    fillTextPrintWindow(printWindow, `Section 20 Street Vendor Statutory Appeal - ${vendorName}`, petitionText, PETITION_PRINT_BODY_STYLE);
    printWindow.focus();
    printWindow.print();
  };

  const handleSaveToVault = async () => {
    setSaving(true);
    setSaveSuccess(null);
    try {
      const saved = await saveVendorRightsRecord({
        vendorName,
        vendingCategory,
        vendingPitchLocation,
        yearsActive: Number(yearsActive) || 1,
        wardNumber,
        zoneName,
        municipalityName,
        contactPhone,
        grievanceSummary,
        immunityAnalysis: immunityData,
        seizureAnalysis: goodsSeizureData,
        relocationAnalysis: relocationData,
      });

      setSaveSuccess(`Appeal saved to vault with seal: ${saved.sha256Seal?.slice(0, 12)}...`);
      if (onRecordSaved) onRecordSaved(saved);
    } catch {
      setSaveSuccess('Error saving appeal to vault');
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
            Section 20 Grievance Redressal Committee Statutory Appeal Drafter
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Auto-formulates formal appeals to the retired District Judge-led Grievance Committee and TVC
          </span>
        </div>
      </div>

      {/* Grid Inputs */}
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
            Vendor Full Name
          </label>
          <input
            type="text"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
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
            Vending Category
          </label>
          <input
            type="text"
            value={vendingCategory}
            onChange={(e) => setVendingCategory(e.target.value)}
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
            Operational Pitch Location
          </label>
          <input
            type="text"
            value={vendingPitchLocation}
            onChange={(e) => setVendingPitchLocation(e.target.value)}
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
            Years Operating at Pitch
          </label>
          <input
            type="number"
            min="1"
            value={yearsActive}
            onChange={(e) => setYearsActive(e.target.value)}
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
            Ward &amp; Municipal Zone
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={wardNumber}
              onChange={(e) => setWardNumber(e.target.value)}
              placeholder="Ward No"
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
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="Zone Name"
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
            Municipality Name
          </label>
          <input
            type="text"
            value={municipalityName}
            onChange={(e) => setMunicipalityName(e.target.value)}
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
            Vendor Contact Phone
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
            Summary of Grievance
          </label>
          <input
            type="text"
            value={grievanceSummary}
            onChange={(e) => setGrievanceSummary(e.target.value)}
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
          {copied ? 'Copied to Clipboard' : 'Copy Full Appeal'}
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

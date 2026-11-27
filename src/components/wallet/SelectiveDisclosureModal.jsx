import { useState, useMemo } from 'react';
import { X, Info, Lock } from 'lucide-react';
import { MOCK_RELYING_PARTIES } from '../../data/walletSeedFixtures';
import { generatePresentation } from '../../services/verifiablePresentationService';
import { createConsentReceipt } from '../../services/consentReceiptService';

export default function SelectiveDisclosureModal({
  credential,
  onClose,
  onGenerated
}) {
  const allAttributes = useMemo(() => Object.keys(credential.claims || {}), [credential]);

  const [selectedRelyingParty, setSelectedRelyingParty] = useState(
    MOCK_RELYING_PARTIES[0]?.id || 'civicbridge:service:general-verification'
  );
  const [selectedAttributes, setSelectedAttributes] = useState(() => {
    // Default to first 2-3 non-sensitive attributes for data minimization demonstration
    return allAttributes.slice(0, Math.min(3, allAttributes.length));
  });
  const [durationSeconds, setDurationSeconds] = useState(1800); // 30 minutes default
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const minimizationPercentage = useMemo(() => {
    if (allAttributes.length === 0) return 0;
    const withheld = allAttributes.length - selectedAttributes.length;
    return Math.round((withheld / allAttributes.length) * 100);
  }, [allAttributes, selectedAttributes]);

  const toggleAttribute = (key) => {
    setSelectedAttributes((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (selectedAttributes.length === 0) {
      setError('Please select at least one attribute to disclose.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const nonce = 'chn_' + Math.random().toString(36).substring(2, 10);
      const { presentation, consentReceiptProposal } = await generatePresentation({
        credential,
        selectedAttributeKeys: selectedAttributes,
        audience: selectedRelyingParty,
        nonce,
        validDurationSeconds: Number(durationSeconds)
      });

      // Create DPDP Consent Receipt
      const receipt = createConsentReceipt({
        presentationId: presentation.presentationId,
        relyingParty: selectedRelyingParty,
        purpose: consentReceiptProposal.purpose,
        disclosedAttributes: selectedAttributes,
        validUntil: presentation.validUntil
      });

      onGenerated(presentation, receipt);
    } catch (err) {
      setError(err.message || 'Failed to generate presentation');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="selective-disclosure-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary)',
          borderRadius: '1rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-light, #e2e8f0)',
          padding: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 id="selective-disclosure-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Selective Disclosure & Presentation Builder
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Source: {credential.title}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Close dialog"
            style={{ padding: '0.35rem', borderRadius: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Step 1: Select Relying Party */}
          <div>
            <label
              htmlFor="relying-party-select"
              style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem' }}
            >
              1. Intended Relying Party / Civic Service (Audience Binding)
            </label>
            <select
              id="relying-party-select"
              value={selectedRelyingParty}
              onChange={(e) => setSelectedRelyingParty(e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.9rem' }}
            >
              {MOCK_RELYING_PARTIES.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.name} ({rp.id})
                </option>
              ))}
              <option value="civicbridge:service:custom-counter">Custom Civic Counter Inspection</option>
            </select>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
              Cryptographically binds the presentation to this service only (prevents relay/replay to other offices).
            </span>
          </div>

          {/* Step 2: Attribute Minimization */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>
                2. Disclose Minimum Required Attributes
              </label>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--success-color, #16a34a)',
                  background: 'rgba(34, 197, 94, 0.1)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '999px'
                }}
              >
                {minimizationPercentage}% Data Withheld
              </span>
            </div>

            <div
              style={{
                background: 'var(--bg-secondary, #f8fafc)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                border: '1px solid var(--border-light, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              {allAttributes.map((attr) => {
                const isChecked = selectedAttributes.includes(attr);
                const val = credential.claims[attr];
                return (
                  <label
                    key={attr}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.35rem',
                      background: isChecked ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAttribute(attr)}
                        style={{ cursor: 'pointer' }}
                      />
                      <strong>{attr}:</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>{String(val)}</span>
                    </span>
                    <span style={{ fontSize: '0.75rem', color: isChecked ? 'var(--primary-color)' : 'var(--text-tertiary)' }}>
                      {isChecked ? 'Disclose' : 'Withheld'}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Step 3: Validity Window */}
          <div>
            <label
              htmlFor="validity-select"
              style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem' }}
            >
              3. Presentation Validity Time-to-Live
            </label>
            <select
              id="validity-select"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.9rem' }}
            >
              <option value="900">15 Minutes (Recommended for counter visit)</option>
              <option value="1800">30 Minutes</option>
              <option value="3600">1 Hour</option>
              <option value="86400">24 Hours (For remote asynchronous review)</option>
            </select>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}
          >
            <Info size={16} color="var(--primary-color)" style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
            <strong>DPDP Act Compliance:</strong> Issuing this presentation generates an auditable Consent Receipt.
            You can revoke this consent at any time from your receipts dashboard.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isGenerating}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isGenerating || selectedAttributes.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Lock size={15} />
              {isGenerating ? 'Generating...' : 'Issue Presentation & Consent Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

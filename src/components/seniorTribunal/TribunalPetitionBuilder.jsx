import { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Copy,
  Check,
  ShieldCheck,
  FileJson,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CASE_TYPES,
  buildTribunalPetition,
  formatPetitionAsPlainText,
} from '../../services/seniorCitizenTribunalService.js';
import {
  savePetition,
  downloadPetitionTextFile,
  downloadPetitionJsonDossier,
} from '../../services/seniorCitizenTribunalStorage.js';

const TribunalPetitionBuilder = ({ initialData, onSaved }) => {
  const [caseType, setCaseType] = useState(
    initialData?.caseType || 'MAINTENANCE_AND_EXPENSES'
  );
  const [petitionerName, setPetitionerName] = useState(
    initialData?.petitionerName || 'Smt. Shanti Devi'
  );
  const [petitionerAge, setPetitionerAge] = useState(
    initialData?.petitionerAge || 69
  );
  const [district, setDistrict] = useState(initialData?.district || 'Jaipur');
  const [state, setState] = useState(initialData?.state || 'Rajasthan');
  const [address, setAddress] = useState(
    initialData?.address || 'House No. 12, Sector 4, Mansarovar, Jaipur'
  );
  const [phone, setPhone] = useState(initialData?.phone || '9876543210');
  const [monthlyClaim, setMonthlyClaim] = useState(
    initialData?.monthlyClaim || 15000
  );
  const [propertyDescription, setPropertyDescription] = useState(
    initialData?.propertyDescription ||
      'Ancestral two-storey residential house situated at Plot 12, Mansarovar, Jaipur'
  );
  const [narrative, setNarrative] = useState(
    initialData?.narrative ||
      'The petitioner transferred her self-acquired residential property to the respondent by a registered gift deed with the understanding that he would provide shelter, food, and medical care. Post transfer, the respondent has physically harassed the petitioner and locked her out.'
  );

  const [respondents, setRespondents] = useState(
    initialData?.respondents || [
      {
        id: 1,
        name: 'Virendra Kumar',
        relationship: 'Elder Son',
        address: 'Plot 12, Mansarovar, Jaipur',
        monthlyIncome: 80000,
        hasInheritedProperty: true,
      },
    ]
  );

  const [generatedPetition, setGeneratedPetition] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleAddRespondent = () => {
    setRespondents((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: `Child ${prev.length + 1}`,
        relationship: 'Child',
        address: `${district}, ${state}`,
        monthlyIncome: 35000,
        hasInheritedProperty: false,
      },
    ]);
  };

  const handleRemoveRespondent = (id) => {
    if (respondents.length <= 1) return;
    setRespondents((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRespondentFieldChange = (id, field, value) => {
    setRespondents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleGenerate = () => {
    const petition = buildTribunalPetition({
      caseType,
      petitionerName,
      petitionerAge,
      district,
      state,
      address,
      phone,
      monthlyClaim,
      propertyDescription,
      narrative,
      respondents,
    });
    setGeneratedPetition(petition);
  };

  const handleSaveToLocker = () => {
    if (!generatedPetition) return;
    savePetition(generatedPetition);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    if (onSaved) onSaved(generatedPetition);
  };

  const handleCopyText = async () => {
    if (!generatedPetition) return;
    const text = formatPetitionAsPlainText(generatedPetition);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    if (!generatedPetition) return;
    downloadPetitionTextFile(generatedPetition);
  };

  const handleDownloadJson = () => {
    if (!generatedPetition) return;
    downloadPetitionJsonDossier(generatedPetition);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-main, #0f172a)',
        border: '1px solid var(--border-main, #334155)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(56, 189, 248, 0.1)',
            color: 'var(--accent-main, #38bdf8)',
          }}
        >
          <FileText size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            SDM Maintenance Tribunal Petition Drafter
          </h3>
          <p
            style={{
              margin: '0.2rem 0 0',
              fontSize: '0.8rem',
              color: 'var(--text-secondary, #94a3b8)',
            }}
          >
            Draft a formal, legally grounded petition for filing before the
            jurisdictional Sub-Divisional Magistrate under Act 56 of 2007.
          </p>
        </div>
      </div>

      {/* Case Type Selector */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '0.4rem',
          }}
        >
          Select Statutory Relief Type:
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '0.6rem',
          }}
        >
          {Object.values(CASE_TYPES).map((type) => {
            const isSelected = caseType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setCaseType(type.id)}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: isSelected
                    ? 'rgba(56, 189, 248, 0.12)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${
                    isSelected ? 'var(--accent-main, #38bdf8)' : 'var(--border-light, #334155)'
                  }`,
                  color: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.2rem',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '0.85rem',
                      color: isSelected
                        ? 'var(--accent-main, #38bdf8)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {type.title}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {type.formCode}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.3',
                  }}
                >
                  {type.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Fields Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
          fontSize: '0.82rem',
        }}
      >
        {/* Petitioner Details */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #334155)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            Petitioner (Parent) Details
          </strong>
          <label>
            <span
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
              }}
            >
              Full Name:
            </span>
            <input
              type="text"
              value={petitionerName}
              onChange={(e) => setPetitionerName(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.35rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'inherit',
              }}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                }}
              >
                Age:
              </span>
              <input
                type="number"
                min="60"
                value={petitionerAge}
                onChange={(e) => setPetitionerAge(Number(e.target.value) || 60)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)',
                  color: 'inherit',
                }}
              />
            </label>
            <label>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                }}
              >
                District:
              </span>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)',
                  color: 'inherit',
                }}
              />
            </label>
          </div>
          <label>
            <span
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
              }}
            >
              Residential Address:
            </span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.35rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'inherit',
              }}
            />
          </label>
          <label>
            <span
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
              }}
            >
              Contact Phone (Optional):
            </span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.35rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'inherit',
              }}
            />
          </label>
        </div>

        {/* Claim & Property Details */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #334155)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            Claim & Property Specifics
          </strong>
          <label>
            <span
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
              }}
            >
              Monthly Maintenance Claim (₹):
            </span>
            <input
              type="number"
              min="0"
              value={monthlyClaim}
              onChange={(e) => setMonthlyClaim(Number(e.target.value) || 0)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.35rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'inherit',
              }}
            />
          </label>
          <label>
            <span
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
              }}
            >
              Property Description (if Section 23 Revocation):
            </span>
            <input
              type="text"
              value={propertyDescription}
              onChange={(e) => setPropertyDescription(e.target.value)}
              placeholder="e.g. Plot No, Street, Ward, Municipal Khata No"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.35rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'inherit',
              }}
            />
          </label>
          <label>
            <span
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
              }}
            >
              State:
            </span>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.35rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'inherit',
              }}
            />
          </label>
        </div>
      </div>

      {/* Grievance Narrative */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '0.35rem',
          }}
        >
          Statement of Facts & Grievance (Averments):
        </label>
        <textarea
          rows={3}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="State the circumstances of neglect, non-payment of maintenance, or refusal of shelter..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.6rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border-light, #334155)',
            background: 'var(--bg-card, #1e293b)',
            color: 'inherit',
            fontSize: '0.8rem',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Children / Respondents Section */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-light, #334155)',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            Respondent Children / Relatives (Summoned Parties)
          </strong>
          <button
            type="button"
            onClick={handleAddRespondent}
            className="btn btn-secondary"
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <Plus size={14} />
            <span>Add Child</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {respondents.map((resp) => (
            <div
              key={resp.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr auto',
                gap: '0.5rem',
                alignItems: 'center',
                padding: '0.4rem 0.6rem',
                borderRadius: '0.375rem',
                background: 'var(--bg-card, #1e293b)',
                fontSize: '0.8rem',
              }}
            >
              <input
                type="text"
                value={resp.name}
                onChange={(e) =>
                  handleRespondentFieldChange(resp.id, 'name', e.target.value)
                }
                placeholder="Name"
                style={{
                  padding: '0.25rem 0.4rem',
                  borderRadius: '0.2rem',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  color: 'inherit',
                }}
              />
              <input
                type="text"
                value={resp.relationship}
                onChange={(e) =>
                  handleRespondentFieldChange(
                    resp.id,
                    'relationship',
                    e.target.value
                  )
                }
                placeholder="Relationship"
                style={{
                  padding: '0.25rem 0.4rem',
                  borderRadius: '0.2rem',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  color: 'inherit',
                }}
              />
              <input
                type="number"
                min="0"
                value={resp.monthlyIncome}
                onChange={(e) =>
                  handleRespondentFieldChange(
                    resp.id,
                    'monthlyIncome',
                    Number(e.target.value) || 0
                  )
                }
                placeholder="Income ₹"
                style={{
                  padding: '0.25rem 0.4rem',
                  borderRadius: '0.2rem',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  color: 'inherit',
                }}
              />
              {respondents.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRespondent(resp.id)}
                  aria-label="Remove respondent"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '0.2rem',
                  }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={handleGenerate}
          className="btn btn-primary"
          style={{
            padding: '0.65rem 1.75rem',
            fontSize: '0.92rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <FileText size={16} />
          <span>Generate Formal Statutory SDM Petition</span>
        </button>
      </div>

      {/* Generated Petition Output */}
      {generatedPetition && (
        <div
          style={{
            borderTop: '1px dashed var(--border-main, #334155)',
            paddingTop: '1.5rem',
          }}
        >
          {/* Action Row */}
          <div
            className="no-print"
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
              }}
            >
              <ShieldCheck size={16} color="#10b981" />
              <span>
                Filing Ref:{' '}
                <strong style={{ color: 'var(--accent-main, #38bdf8)' }}>
                  {generatedPetition.filingReference}
                </strong>
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'monospace',
                }}
              >
                ({generatedPetition.sha256Digest.slice(0, 16)}...)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSaveToLocker}
                className="btn btn-secondary"
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                {saveSuccess ? (
                  <Check size={14} color="#10b981" />
                ) : (
                  <Save size={14} />
                )}
                <span>{saveSuccess ? 'Saved!' : 'Save Locker'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="btn btn-secondary"
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                {copied ? (
                  <Check size={14} color="#10b981" />
                ) : (
                  <Copy size={14} />
                )}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-secondary"
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Printer size={14} />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className="btn btn-secondary"
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Download size={14} />
                <span>Text Slip</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="btn btn-primary"
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <FileJson size={14} />
                <span>Signed Dossier</span>
              </button>
            </div>
          </div>

          {/* Legal Draft View */}
          <pre
            style={{
              padding: '1.25rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-card, #1e293b)',
              border: '1px solid var(--border-light, #334155)',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              lineHeight: '1.45',
              whiteSpace: 'pre-wrap',
              maxHeight: '400px',
              overflowY: 'auto',
              color: 'var(--text-primary)',
            }}
          >
            {formatPetitionAsPlainText(generatedPetition)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TribunalPetitionBuilder;

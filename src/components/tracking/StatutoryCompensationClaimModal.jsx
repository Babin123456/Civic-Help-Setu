import { useState, useId } from 'react';
import {
  X,
  Scale,
  Calendar,
  AlertTriangle,
  Copy,
  CheckCircle,
  Download,
  DollarSign,
  Building,
  User,
  Phone,
  CreditCard,
  FileText
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  calculateStatutoryCompensation,
  generateCompensationPetition
} from '../../services/statutoryCompensationService';

export default function StatutoryCompensationClaimModal({ isOpen, onClose, application }) {
  const { toast } = useToast();
  const headingId = useId();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'petition'
  const [copied, setCopied] = useState(false);

  const [applicantName, setApplicantName] = useState(application?.applicantName || 'Citizen Applicant');
  const [applicantPhone, setApplicantPhone] = useState(application?.phone || '');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [disbursementAccount, setDisbursementAccount] = useState('');

  if (!isOpen || !application) return null;

  const comp = calculateStatutoryCompensation(application);

  const petitionMarkdown = generateCompensationPetition(
    application,
    {
      name: applicantName,
      phone: applicantPhone,
      address: applicantAddress
    },
    {
      bankAccount: disbursementAccount || 'Direct Bank Credit / DBT Linked Account'
    }
  );

  const handleCopyPetition = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(petitionMarkdown);
      }
      setCopied(true);
      toast?.success?.('Statutory compensation petition copied to clipboard.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast?.error?.('Failed to copy petition. Please select and copy manually.');
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([petitionMarkdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Statutory_Compensation_Claim_${application.id || 'Application'}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast?.success?.('Claim petition downloaded successfully.');
    } catch {
      toast?.error?.('Download failed. Please copy the petition text.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-main, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Scale size={22} />
            </div>
            <div>
              <h2 id={headingId} style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Statutory Delay Compensation Claim
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Under {comp.actName} (Ref: {application.id})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="btn btn-secondary"
            style={{ padding: '0.4rem', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-main)',
            background: 'var(--bg-main, #ffffff)',
            padding: '0 1.5rem'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              borderBottom: activeTab === 'overview' ? '2px solid var(--accent-main, #2563eb)' : '2px solid transparent',
              color: activeTab === 'overview' ? 'var(--accent-main, #2563eb)' : 'var(--text-secondary)'
            }}
          >
            Claim Breakdown & Calculator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('petition')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              borderBottom: activeTab === 'petition' ? '2px solid var(--accent-main, #2563eb)' : '2px solid transparent',
              color: activeTab === 'petition' ? 'var(--accent-main, #2563eb)' : 'var(--text-secondary)'
            }}
          >
            Petition Preview (Form 2)
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'grid', gap: '1.25rem' }}>
          {activeTab === 'overview' ? (
            <>
              {/* Entitlement Banner */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  backgroundColor: comp.isEligible ? 'rgba(220, 38, 38, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  border: `1px solid ${comp.isEligible ? '#fca5a5' : '#86efac'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={18} color={comp.isEligible ? '#dc2626' : '#16a34a'} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: comp.isEligible ? '#dc2626' : '#16a34a' }}>
                      {comp.isEligible ? 'Statutory Delay Penalty Payable to Applicant' : 'Application Within Prescribed SLA'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {comp.reason}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                    Net Claim Amount
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: comp.isEligible ? '#dc2626' : '#16a34a' }}>
                    ₹{comp.claimAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div className="stat-card" style={{ padding: '0.85rem', border: '1px solid var(--border-main)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'block' }}>Prescribed SLA</span>
                  <strong style={{ fontSize: '1.05rem' }}>{comp.statutoryDays} working days</strong>
                </div>
                <div className="stat-card" style={{ padding: '0.85rem', border: '1px solid var(--border-main)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'block' }}>Elapsed Days</span>
                  <strong style={{ fontSize: '1.05rem' }}>{comp.businessDaysElapsed} working days</strong>
                </div>
                <div className="stat-card" style={{ padding: '0.85rem', border: '1px solid var(--border-main)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'block' }}>Days Overdue</span>
                  <strong style={{ fontSize: '1.05rem', color: comp.delayedDays > 0 ? '#dc2626' : 'inherit' }}>
                    {comp.delayedDays} days
                  </strong>
                </div>
                <div className="stat-card" style={{ padding: '0.85rem', border: '1px solid var(--border-main)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'block' }}>Daily Allowance</span>
                  <strong style={{ fontSize: '1.05rem' }}>₹{comp.dailyRate}/day</strong>
                </div>
                <div className="stat-card" style={{ padding: '0.85rem', border: '1px solid var(--border-main)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'block' }}>Statutory Ceiling</span>
                  <strong style={{ fontSize: '1.05rem' }}>₹{comp.maxCap.toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {/* Claimant Information Inputs */}
              <div style={{ border: '1px solid var(--border-main)', borderRadius: '12px', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={16} /> Claimant Information for Legal Petition
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Applicant Name
                    </label>
                    <input
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Contact Mobile
                    </label>
                    <input
                      type="text"
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-main)' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Postal Address
                    </label>
                    <input
                      type="text"
                      value={applicantAddress}
                      onChange={(e) => setApplicantAddress(e.target.value)}
                      placeholder="e.g. Ward 4, Civil Station Road, Nagpur"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-main)' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Disbursement Mode (Bank A/C or UPI ID)
                    </label>
                    <input
                      type="text"
                      value={disbursementAccount}
                      onChange={(e) => setDisbursementAccount(e.target.value)}
                      placeholder="e.g. State Bank of India - A/C 39281749281 or user@upi"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-main)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Appellate Jurisdiction Info */}
              <div style={{ backgroundColor: 'var(--bg-card, #f8fafc)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-main)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  <Building size={15} /> First Appellate Authority:
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {comp.firstAppellateAuthority}
                </div>
                <small style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: '0.25rem' }}>
                  Claims must be submitted within {comp.limitationPeriodDays} days from date of statutory SLA expiry.
                </small>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div
                style={{
                  background: 'var(--bg-card, #f8fafc)',
                  border: '1px solid var(--border-main)',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}
              >
                {petitionMarkdown}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            background: 'var(--bg-card, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyPetition}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {copied ? <CheckCircle size={15} color="#16a34a" /> : <Copy size={15} />}
              <span>{copied ? 'Copied' : 'Copy Petition'}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownload}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Download size={15} />
              <span>Download (.md)</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

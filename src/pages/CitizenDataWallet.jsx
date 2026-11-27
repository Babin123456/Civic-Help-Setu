import { useState, useCallback } from 'react';
import {
  FileBadge,
  Plus,
  KeyRound,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
  getWalletCredentials,
  deleteWalletCredential,
  saveWalletCredential,
  isWalletAtRestEncrypted,
  isWalletLocked,
  resetWalletStorage
} from '../services/dataWalletStorageService';
import {
  getConsentReceipts,
  revokeConsentReceipt
} from '../services/consentReceiptService';
import { STATUTORY_WALLET_DISCLAIMER } from '../data/walletContracts';
import { SEED_CREDENTIALS } from '../data/walletSeedFixtures';

import CredentialCard from '../components/wallet/CredentialCard';
import SelectiveDisclosureModal from '../components/wallet/SelectiveDisclosureModal';
import PresentationQrModal from '../components/wallet/PresentationQrModal';
import ConsentReceiptsList from '../components/wallet/ConsentReceiptsList';
import VerifierInspectionModal from '../components/wallet/VerifierInspectionModal';
import CredentialImportModal from '../components/wallet/CredentialImportModal';
import WalletSecurityModal from '../components/wallet/WalletSecurityModal';

export default function CitizenDataWallet() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials' | 'consent' | 'verifier'
  const [credentials, setCredentials] = useState(() => getWalletCredentials());
  const [receipts, setReceipts] = useState(() => getConsentReceipts());

  // Modals state
  const [selectedCredForPresent, setSelectedCredForPresent] = useState(null);
  const [activePresentationPayload, setActivePresentationPayload] = useState(null);
  const [activeReceiptPayload, setActiveReceiptPayload] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [verifierTargetPres, setVerifierTargetPres] = useState(null);

  const loadData = useCallback(() => {
    const creds = getWalletCredentials();
    const r = getConsentReceipts();
    setCredentials(creds);
    setReceipts(r);
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm?.('Are you sure you want to remove this credential from your wallet?') ?? true) {
      await deleteWalletCredential(id);
      loadData();
      toast?.showToast?.('Credential removed from local wallet', 'info');
    }
  };

  const handlePresentationGenerated = (presentation, receipt) => {
    setSelectedCredForPresent(null);
    setActivePresentationPayload(presentation);
    setActiveReceiptPayload(receipt);
    loadData();
    toast?.showToast?.('Verifiable Presentation & Consent Receipt issued', 'success');
  };

  const handleRevokeConsent = (receiptId, justification) => {
    revokeConsentReceipt(receiptId, justification);
    loadData();
    toast?.showToast?.('Consent revoked. Presentation flagged in revocation registry.', 'warning');
  };

  const handleAddCredential = async (cred) => {
    await saveWalletCredential(cred);
    loadData();
    toast?.showToast?.('New credential stored in local wallet', 'success');
  };

  const handleResetSeeds = () => {
    resetWalletStorage();
    for (const c of SEED_CREDENTIALS) {
      saveWalletCredential(c);
    }
    loadData();
    toast?.showToast?.('Restored synthetic demo credentials', 'info');
  };

  const isEncrypted = isWalletAtRestEncrypted();
  const isLocked = isWalletLocked();

  const activeReceiptsCount = receipts.filter((r) => r.status === 'ACTIVE').length;

  return (
    <div className="citizen-data-wallet-page section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header Hero */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <FileBadge size={32} color="var(--primary-color)" />
            <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800 }}>
              Consent-Driven Citizen Data Wallet
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '780px', lineHeight: 1.5 }}>
            Store your verified civic credentials locally on your device with WebCrypto encryption. Generate selective disclosure presentations to share only the minimum required attributes with public service verifiers under the Digital Personal Data Protection (DPDP) Act, 2023.
          </p>
        </div>

        {/* Statutory Disclaimer Banner */}
        <div
          role="note"
          style={{
            padding: '0.85rem 1.15rem',
            borderRadius: '0.75rem',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: 'var(--text-primary)',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            marginBottom: '1.75rem'
          }}
        >
          <AlertTriangle size={18} color="#ca8a04" style={{ flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true" />
          <div>
            <strong>Statutory & Legal Notice:</strong> {STATUTORY_WALLET_DISCLAIMER}
          </div>
        </div>

        {/* Metric / Stat Tiles */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.75rem'
          }}
        >
          <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Stored Credentials</span>
            <strong style={{ fontSize: '1.4rem' }}>{credentials.length}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>Local-first records</span>
          </div>
          <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Active Disclosures</span>
            <strong style={{ fontSize: '1.4rem', color: 'var(--primary-color)' }}>{activeReceiptsCount}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>Consent receipts granted</span>
          </div>
          <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Data Minimization</span>
            <strong style={{ fontSize: '1.4rem', color: 'var(--success-color, #16a34a)' }}>Selective</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>Withheld claims unexposed</span>
          </div>
          <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>At-Rest Encryption</span>
            <strong style={{ fontSize: '1.15rem' }}>{isEncrypted ? (isLocked ? 'Locked' : 'AES-GCM') : 'Standard'}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>Zero cloud escrow</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div
          role="tablist"
          aria-label="Citizen Wallet Views"
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '2px solid var(--border-light, #e2e8f0)',
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}
        >
          <button
            role="tab"
            aria-selected={activeTab === 'credentials'}
            id="tab-credentials"
            aria-controls="panel-credentials"
            onClick={() => setActiveTab('credentials')}
            className={`btn btn-sm ${activeTab === 'credentials' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600, borderRadius: '0.5rem 0.5rem 0 0', padding: '0.6rem 1rem' }}
          >
            My Credentials ({credentials.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'consent'}
            id="tab-consent"
            aria-controls="panel-consent"
            onClick={() => setActiveTab('consent')}
            className={`btn btn-sm ${activeTab === 'consent' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600, borderRadius: '0.5rem 0.5rem 0 0', padding: '0.6rem 1rem' }}
          >
            Consent Receipts & Revocation ({receipts.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'verifier'}
            id="tab-verifier"
            aria-controls="panel-verifier"
            onClick={() => setActiveTab('verifier')}
            className={`btn btn-sm ${activeTab === 'verifier' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600, borderRadius: '0.5rem 0.5rem 0 0', padding: '0.6rem 1rem' }}
          >
            Verifier Inspection Sandbox
          </button>
        </div>

        {/* Tab Content: Credentials */}
        {activeTab === 'credentials' && (
          <div role="tabpanel" id="panel-credentials" aria-labelledby="tab-credentials">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Stored Civic Credentials</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Credentials stored on your device ready for selective presentation
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowSecurityModal(true)}
                  className="btn btn-sm btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <KeyRound size={14} />
                  Wallet Security
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="btn btn-sm btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={14} />
                  Add Credential
                </button>
              </div>
            </div>

            {credentials.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '0.75rem',
                  border: '1px dashed var(--border-light)'
                }}
              >
                <FileBadge size={36} style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
                <h3 style={{ margin: '0 0 0.5rem' }}>Your Wallet is Empty</h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Add a self-declared credential or load synthetic test fixtures to evaluate selective disclosure.
                </p>
                <button type="button" onClick={handleResetSeeds} className="btn btn-sm btn-primary">
                  Load Synthetic Test Credentials
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '1.25rem'
                }}
              >
                {credentials.map((cred) => (
                  <CredentialCard
                    key={cred.id}
                    credential={cred}
                    onPresent={(c) => setSelectedCredForPresent(c)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Consent Receipts */}
        {activeTab === 'consent' && (
          <div role="tabpanel" id="panel-consent" aria-labelledby="tab-consent">
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Consent Receipts & Revocation Ledger
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                DPDP Act Section 6 audit log of past attribute presentations and real-time revocation directives
              </span>
            </div>
            <ConsentReceiptsList receipts={receipts} onRevoke={handleRevokeConsent} />
          </div>
        )}

        {/* Tab Content: Verifier Sandbox */}
        {activeTab === 'verifier' && (
          <div role="tabpanel" id="panel-verifier" aria-labelledby="tab-verifier">
            <VerifierInspectionModal
              initialPresentation={verifierTargetPres}
              onClose={() => setVerifierTargetPres(null)}
            />
          </div>
        )}

        {/* Selective Disclosure Modal */}
        {selectedCredForPresent && (
          <SelectiveDisclosureModal
            credential={selectedCredForPresent}
            onClose={() => setSelectedCredForPresent(null)}
            onGenerated={handlePresentationGenerated}
          />
        )}

        {/* Presentation QR & Token Modal */}
        {activePresentationPayload && (
          <PresentationQrModal
            presentation={activePresentationPayload}
            receipt={activeReceiptPayload}
            onClose={() => setActivePresentationPayload(null)}
            onOpenVerifier={(pres) => {
              setActivePresentationPayload(null);
              setVerifierTargetPres(pres);
              setActiveTab('verifier');
            }}
          />
        )}

        {/* Import Credential Modal */}
        {showImportModal && (
          <CredentialImportModal
            onClose={() => setShowImportModal(false)}
            onAddCredential={handleAddCredential}
            onResetSeeds={handleResetSeeds}
          />
        )}

        {/* Wallet Security Modal */}
        {showSecurityModal && (
          <WalletSecurityModal
            onClose={() => setShowSecurityModal(false)}
            onStorageChanged={loadData}
          />
        )}
      </div>
    </div>
  );
}

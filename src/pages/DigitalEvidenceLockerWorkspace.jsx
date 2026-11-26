/**
 * src/pages/DigitalEvidenceLockerWorkspace.jsx
 * Production-ready Civic Service Digital Evidence Locker Workspace (#1186).
 *
 * Implements:
 * - Citizen-centric client-side encrypted locker
 * - Tabbed interface: Records Explorer, Encrypted Builder, Recovery & Audit
 * - Session lock/unlock status with auto-inactivity lock
 * - Non-AI fallback & human-in-the-loop statutory disclaimers
 * - Seed synthetic non-PII test fixtures with one click
 */

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Plus,
  Layers,
  LifeBuoy,
  RefreshCw,
  FolderLock,
  ShieldAlert,
} from 'lucide-react';
import EvidenceLockerDisclaimer from '../components/evidenceLocker/EvidenceLockerDisclaimer.jsx';
import EvidenceLockerBuilder from '../components/evidenceLocker/EvidenceLockerBuilder.jsx';
import EvidenceLockerList from '../components/evidenceLocker/EvidenceLockerList.jsx';
import EvidenceLockerRecoveryModal from '../components/evidenceLocker/EvidenceLockerRecoveryModal.jsx';
import {
  isLockerSessionUnlocked,
  unlockLockerSession,
  lockLockerSession,
  seedSyntheticFixturesIfEmpty,
} from '../services/civicEvidenceLockerStorageService.js';

export default function DigitalEvidenceLockerWorkspace() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [isUnlocked, setIsUnlocked] = useState(() => isLockerSessionUnlocked());
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    document.title = 'Civic Service Digital Evidence Locker | Civic Help Setu';
  }, []);

  const handleUnlockSession = (e) => {
    e.preventDefault();
    setUnlockError('');
    try {
      unlockLockerSession(unlockPassphrase, () => {
        setIsUnlocked(false);
      });
      setIsUnlocked(true);
      setUnlockPassphrase('');
    } catch (err) {
      setUnlockError(err.message || 'Passphrase must be at least 8 characters.');
    }
  };

  const handleLockSession = () => {
    lockLockerSession();
    setIsUnlocked(false);
  };

  const handleSeedFixtures = async () => {
    setIsSeeding(true);
    try {
      await seedSyntheticFixturesIfEmpty('TestPassphrase123!');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to seed synthetic fixtures:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                Client-Side Encrypted
              </span>
              <span className="text-xs text-neutral-500 font-mono">
                AES-256-GCM / PBKDF2
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 mt-1">
              Civic Service Digital Evidence Locker
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Securely organize sensitive grievance records before deciding whether to share them. Zero server-side key escrow.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSeedFixtures}
              disabled={isSeeding}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
              Load Synthetic Fixtures
            </button>
            <button
              onClick={() => setIsRecoveryModalOpen(true)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Security & Tamper Tests
            </button>
            {isUnlocked ? (
              <button
                onClick={handleLockSession}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                Lock Locker Session
              </button>
            ) : (
              <div className="text-xs font-semibold text-amber-600 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                <Lock className="w-3.5 h-3.5" />
                Session Locked
              </div>
            )}
          </div>
        </div>

        {/* Statutory & Cryptographic Notice Banner */}
        <EvidenceLockerDisclaimer />

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            Locker Records
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Plus className="w-4 h-4" />
            Create Encrypted Record
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'list' && (
          <EvidenceLockerList
            key={refreshTrigger}
            onRefreshRequired={() => setRefreshTrigger((p) => p + 1)}
          />
        )}

        {activeTab === 'create' && (
          <EvidenceLockerBuilder
            onRecordCreated={() => {
              setActiveTab('list');
              setRefreshTrigger((p) => p + 1);
            }}
          />
        )}

        {/* Recovery & Security Modal */}
        <EvidenceLockerRecoveryModal
          isOpen={isRecoveryModalOpen}
          onClose={() => setIsRecoveryModalOpen(false)}
        />
      </div>
    </div>
  );
}

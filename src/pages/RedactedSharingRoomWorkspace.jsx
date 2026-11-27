import { useState, useCallback, useMemo } from 'react';
import {
  Shield,
  Lock,
  Clock,
  Eye,
  Download,
  Ban,
  Copy,
  Check,
  AlertTriangle,
  WifiOff,
  FileText,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  EXPIRY_PRESETS,
  PROVENANCE_LABELS,
  createLocalSharingRoom,
  listLocalSharingRooms,
  revokeLocalSharingRoom,
  listLocalAccessLogs,
} from '../services/redactedSharingRoomService';

const SAMPLE_SHAREABLE_DOCS = [
  {
    fileId: 'doc_ration_ack',
    title: 'Ration Card Application Acknowledgement',
    provenanceType: 'official_record',
    summary: 'Official counter receipt issued at Ward 5 office. Ref: RC/2026/441.',
  },
  {
    fileId: 'doc_address_proof',
    title: 'Redacted Utility Bill Summary',
    provenanceType: 'citizen_entered',
    summary: 'Electricity bill summary for Ward 5 verification.',
  },
  {
    fileId: 'doc_helper_checklist',
    title: 'Advisor Document Checklist Notes',
    provenanceType: 'ai_suggestion',
    summary: 'Suggested supporting documents for counter submission.',
  },
];

export default function RedactedSharingRoomWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const ownerId = user?.id || 'citizen_local';

  const [rooms, setRooms] = useState(() => {
    try {
      return listLocalSharingRooms(ownerId);
    } catch {
      return [];
    }
  });
  const [selectedRoomId, setSelectedRoomId] = useState(() => {
    try {
      return listLocalSharingRooms(ownerId)[0]?.roomId || null;
    } catch {
      return null;
    }
  });
  const [title, setTitle] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [expiryMs, setExpiryMs] = useState(EXPIRY_PRESETS[2].ms);
  const [filePermissions, setFilePermissions] = useState({
    doc_ration_ack: 'view',
    doc_address_proof: 'download',
    doc_helper_checklist: 'denied',
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState(null);
  const [isLoading] = useState(false);

  const refreshRooms = useCallback(() => {
    try {
      const list = listLocalSharingRooms(ownerId);
      setRooms(list);
      if (list.length > 0 && !list.some((r) => r.roomId === selectedRoomId)) {
        setSelectedRoomId(list[0].roomId);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load sharing rooms.');
    }
  }, [ownerId, selectedRoomId]);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.roomId === selectedRoomId) || null,
    [rooms, selectedRoomId]
  );

  const activeLogs = useMemo(() => {
    if (!activeRoom) return [];
    return listLocalAccessLogs(activeRoom.roomId, ownerId);
  }, [activeRoom, ownerId]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const includedFiles = SAMPLE_SHAREABLE_DOCS.filter(
      (d) => filePermissions[d.fileId] && filePermissions[d.fileId] !== 'denied'
    ).map((d) => ({
      ...d,
      permission: filePermissions[d.fileId],
    }));

    if (includedFiles.length === 0) {
      setErrorMsg('Select at least one document with View or Download permission.');
      return;
    }

    try {
      const created = createLocalSharingRoom({
        ownerId,
        title: title.trim() || 'Advisor Document Review Room',
        recipientId: recipientId.trim() || null,
        files: includedFiles,
        expiresInMs: Number(expiryMs),
      });
      setTitle('');
      setRecipientId('');
      refreshRooms();
      setSelectedRoomId(created.roomId);
      setAnnouncement(`Created expiring sharing room "${created.title}".`);
    } catch (err) {
      setErrorMsg(err.message || 'Could not create sharing room.');
    }
  };

  const handleRevoke = (roomId) => {
    try {
      revokeLocalSharingRoom(roomId, ownerId);
      refreshRooms();
      setAnnouncement('Sharing room revoked immediately.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to revoke room.');
    }
  };

  const copyNonIndexableLink = (room) => {
    navigator.clipboard?.writeText(room.nonIndexableUrl);
    setCopiedRoomId(room.roomId);
    setTimeout(() => setCopiedRoomId(null), 2000);
    setAnnouncement('Copied non-indexable sharing room URL.');
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1150px', margin: '0 auto' }}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Header */}
      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Shield size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Secure Redacted Document Sharing Room
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Share selected, PII-redacted documents with helpers or advisors using scoped per-file permissions, automatic expiry, instant revocation, and audited access logs. Links are non-indexable (<code>noindex, nofollow</code>).
        </p>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            marginBottom: '1rem',
            fontSize: '0.88rem',
          }}
        >
          <WifiOff size={16} aria-hidden="true" />
          <span>You are offline. Rooms created locally will require reconnection to share via server-enforced access tokens.</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#b91c1c',
            marginBottom: '1rem',
            fontSize: '0.88rem',
          }}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Create Sharing Room */}
        <section
          aria-label="Create Redacted Sharing Room"
          style={{
            padding: '1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-main, #e2e8f0)',
            background: 'var(--bg-card, #fff)',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={18} aria-hidden="true" />
            New Expiring Share Room
          </h2>
          <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label htmlFor="room-title" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Room Title
              </label>
              <input
                id="room-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ward 5 Ration Card Review"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <div>
              <label htmlFor="room-recipient" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Designated Recipient ID (optional, prevents cross-user access)
              </label>
              <input
                id="room-recipient"
                type="text"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="e.g. advisor_ward5"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <div>
              <label htmlFor="room-expiry" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Access Expiry
              </label>
              <select
                id="room-expiry"
                value={expiryMs}
                onChange={(e) => setExpiryMs(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              >
                {EXPIRY_PRESETS.map((p) => (
                  <option key={p.id} value={p.ms}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Per-File Permissions &amp; Provenance
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {SAMPLE_SHAREABLE_DOCS.map((doc) => (
                  <div
                    key={doc.fileId}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <strong>{doc.title}</strong>
                        <span
                          style={{
                            marginLeft: '0.4rem',
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '999px',
                            background: doc.provenanceType === 'official_record' ? '#e3f2fd' : doc.provenanceType === 'ai_suggestion' ? '#fff8e1' : '#e8f5e9',
                            color: doc.provenanceType === 'official_record' ? '#1565c0' : doc.provenanceType === 'ai_suggestion' ? '#f57f17' : '#2e7d32',
                            fontWeight: 600,
                          }}
                        >
                          {PROVENANCE_LABELS[doc.provenanceType]}
                        </span>
                      </div>
                      <select
                        aria-label={`Permission for ${doc.title}`}
                        value={filePermissions[doc.fileId]}
                        onChange={(e) => setFilePermissions((prev) => ({ ...prev, [doc.fileId]: e.target.value }))}
                        style={{ padding: '0.25rem 0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)' }}
                      >
                        <option value="view">View Only</option>
                        <option value="download">View &amp; Download</option>
                        <option value="denied">Exclude / Deny</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'var(--primary, #2563eb)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Create Scoped Sharing Room
            </button>
          </form>
        </section>

        {/* Right: Active Rooms, Revocation & Audited Access Logs */}
        <section
          aria-label="Active Sharing Rooms and Access Logs"
          style={{
            padding: '1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-main, #e2e8f0)',
            background: 'var(--bg-card, #fff)',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Lock size={18} aria-hidden="true" />
            My Sharing Rooms ({rooms.length})
          </h2>

          {isLoading ? (
            <p role="status">Loading sharing rooms...</p>
          ) : rooms.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <FileText size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No Active Sharing Rooms</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                Create a scoped, expiring room on the left to share redacted documents safely without exposing your vault.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {rooms.map((r) => (
                <div
                  key={r.roomId}
                  onClick={() => setSelectedRoomId(r.roomId)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '0.5rem',
                    border: selectedRoomId === r.roomId ? '2px solid var(--primary, #2563eb)' : '1px solid var(--border-light, #e2e8f0)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>{r.title}</strong>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        background: r.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                        color: r.status === 'ACTIVE' ? '#166534' : '#991b1b',
                      }}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span><Clock size={12} aria-hidden="true" /> Expires: {new Date(r.expiresAt).toLocaleString()}</span>
                    <span>{r.files.length} file(s)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyNonIndexableLink(r); }}
                      style={{ padding: '0.3rem 0.65rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)', background: 'transparent', fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      {copiedRoomId === r.roomId ? <Check size={12} color="green" /> : <Copy size={12} />}
                      Copy Non-Indexable Link
                    </button>
                    {r.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRevoke(r.roomId); }}
                        style={{ padding: '0.3rem 0.65rem', borderRadius: '0.35rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Ban size={12} aria-hidden="true" />
                        Revoke Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeRoom && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                Per-File Scope &amp; Audited Access Log
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.85rem', fontSize: '0.8rem' }}>
                {activeRoom.files.map((f) => (
                  <div key={f.fileId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '0.35rem' }}>
                    <span>{f.title}</span>
                    <span style={{ fontWeight: 600 }}>
                      {f.permission === 'download' ? <><Download size={12} aria-hidden="true" /> View &amp; Download</> : <><Eye size={12} aria-hidden="true" /> View Only</>}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                <strong>Audit Trail ({activeLogs.length} events):</strong>
                {activeLogs.slice(0, 5).map((log) => (
                  <div key={log.id} style={{ marginTop: '0.2rem', fontFamily: 'monospace' }}>
                    [{new Date(log.loggedAt).toLocaleTimeString()}] {log.action} — {log.outcome}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

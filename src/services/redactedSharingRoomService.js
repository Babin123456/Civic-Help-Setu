/**
 * src/services/redactedSharingRoomService.js
 *
 * Client-side service for the Secure Redacted Document Sharing Room (#1426).
 * Provides offline-first local persistence, selective PII redaction prior to sharing,
 * per-file permission management, expiry & revocation checks, replay-safe nonces,
 * non-indexable share URL generation, and provenance classification.
 */

export const SHARING_ROOM_STORAGE_KEY = 'civicbridge_redacted_sharing_rooms_v1';
export const SHARING_LOG_STORAGE_KEY = 'civicbridge_redacted_sharing_logs_v1';

export const EXPIRY_PRESETS = Object.freeze([
  { id: '15m', label: '15 minutes', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24 hours (Recommended)', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
]);

export const PROVENANCE_LABELS = Object.freeze({
  citizen_entered: 'Citizen Entered',
  official_record: 'Official Record',
  ai_suggestion: 'AI Suggestion (Verify)',
});

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi;
const PHONE_RE = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;

export function redactSensitiveText(text = '') {
  if (typeof text !== 'string') return { redactedText: '', redactedFields: [] };
  const redactedFields = [];
  let out = text;
  if (AADHAAR_RE.test(out)) {
    out = out.replace(AADHAAR_RE, '[REDACTED:AADHAAR]');
    redactedFields.push('aadhaar');
  }
  if (PAN_RE.test(out)) {
    out = out.replace(PAN_RE, '[REDACTED:PAN]');
    redactedFields.push('pan');
  }
  if (PHONE_RE.test(out)) {
    out = out.replace(PHONE_RE, '[REDACTED:PHONE]');
    redactedFields.push('phone');
  }
  return { redactedText: out, redactedFields };
}

function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(key, fallback, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function generateNonce() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildNonIndexableShareUrl(roomId, shareToken) {
  return `/redacted-sharing-room?room=${encodeURIComponent(roomId)}&t=${encodeURIComponent(shareToken)}`;
}

export function createLocalSharingRoom({
  ownerId = 'citizen_local',
  title,
  recipientId = null,
  files = [],
  expiresInMs = 24 * 60 * 60 * 1000,
  customStorage = null,
}) {
  if (!title || !title.trim()) throw new Error('Room title is required.');
  if (!Array.isArray(files) || files.length === 0) throw new Error('Select at least one document to share.');

  const rooms = readJson(SHARING_ROOM_STORAGE_KEY, [], customStorage);
  const roomId = `room_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const shareToken = generateNonce();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  const sanitizedFiles = files.map((f) => {
    const { redactedText, redactedFields } = redactSensitiveText(f.summary || '');
    return {
      fileId: f.fileId,
      title: f.title,
      provenanceType: f.provenanceType || 'citizen_entered',
      permission: f.permission || 'view',
      redactedFields: Array.from(new Set([...(f.redactedFields || []), ...redactedFields])),
      redactedSummary: redactedText,
      downloadCount: 0,
      maxDownloads: Number(f.maxDownloads || 5),
    };
  });

  const room = {
    roomId,
    shareToken,
    ownerId,
    recipientId,
    title: title.trim(),
    files: sanitizedFiles,
    status: 'ACTIVE',
    createdAt,
    expiresAt,
    revokedAt: null,
    nonIndexableUrl: buildNonIndexableShareUrl(roomId, shareToken),
  };

  rooms.unshift(room);
  writeJson(SHARING_ROOM_STORAGE_KEY, rooms, customStorage);
  appendLocalAccessLog(
    { roomId, actorId: ownerId, action: 'ROOM_CREATED', outcome: 'ALLOWED', fileId: null },
    customStorage
  );
  return room;
}

export function listLocalSharingRooms(ownerId = 'citizen_local', customStorage = null) {
  const rooms = readJson(SHARING_ROOM_STORAGE_KEY, [], customStorage);
  const now = Date.now();
  return rooms
    .filter((r) => r.ownerId === ownerId)
    .map((r) => {
      const expired = new Date(r.expiresAt).getTime() <= now;
      return {
        ...r,
        status: r.status === 'REVOKED' ? 'REVOKED' : expired ? 'EXPIRED' : 'ACTIVE',
      };
    });
}

export function revokeLocalSharingRoom(roomId, actorId = 'citizen_local', customStorage = null) {
  const rooms = readJson(SHARING_ROOM_STORAGE_KEY, [], customStorage);
  const idx = rooms.findIndex((r) => r.roomId === roomId);
  if (idx === -1) throw new Error('Sharing room not found.');
  if (rooms[idx].ownerId !== actorId) throw new Error('Only the room owner can revoke access.');

  rooms[idx] = {
    ...rooms[idx],
    status: 'REVOKED',
    revokedAt: new Date().toISOString(),
  };
  writeJson(SHARING_ROOM_STORAGE_KEY, rooms, customStorage);
  appendLocalAccessLog(
    { roomId, actorId, action: 'ROOM_REVOKED', outcome: 'ALLOWED', fileId: null },
    customStorage
  );
  return rooms[idx];
}

export function appendLocalAccessLog(entry, customStorage = null) {
  const logs = readJson(SHARING_LOG_STORAGE_KEY, [], customStorage);
  logs.unshift({
    id: `loclog_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    ...entry,
    loggedAt: new Date().toISOString(),
  });
  writeJson(SHARING_LOG_STORAGE_KEY, logs.slice(0, 500), customStorage);
}

export function listLocalAccessLogs(roomId, ownerId = 'citizen_local', customStorage = null) {
  const rooms = readJson(SHARING_ROOM_STORAGE_KEY, [], customStorage);
  const room = rooms.find((r) => r.roomId === roomId);
  if (!room || room.ownerId !== ownerId) return [];
  const logs = readJson(SHARING_LOG_STORAGE_KEY, [], customStorage);
  return logs.filter((l) => l.roomId === roomId);
}

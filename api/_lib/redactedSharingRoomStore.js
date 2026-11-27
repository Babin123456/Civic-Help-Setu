/**
 * api/_lib/redactedSharingRoomStore.js
 *
 * Bounded in-memory store for the Secure Redacted Document Sharing Room (#1426).
 *
 * Invariants:
 *  - Max 500 rooms; oldest evicted when full.
 *  - Max 2,000 access log entries; oldest evicted when full.
 *  - Per-file permissions: 'view' | 'download' | 'denied'.
 *  - Replay protection: tracks consumed one-time access nonces per room.
 *  - Strict owner isolation for revocation and access log retrieval.
 */

import { randomBytes } from 'node:crypto';

const MAX_ROOMS = 500;
const MAX_ACCESS_LOGS = 2000;

export const FILE_PERMISSIONS = Object.freeze({
  VIEW: 'view',
  DOWNLOAD: 'download',
  DENIED: 'denied',
});

export const ROOM_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
});

export class InMemoryRedactedSharingRoomStore {
  constructor() {
    /** @type {Map<string, object>} */
    this._rooms = new Map();
    /** @type {Array<object>} */
    this._accessLogs = [];
  }

  _evictRoomIfFull() {
    if (this._rooms.size >= MAX_ROOMS) {
      let oldestId = null;
      let oldestTs = Infinity;
      for (const [id, r] of this._rooms) {
        const t = new Date(r.createdAt || 0).getTime();
        if (t < oldestTs) {
          oldestTs = t;
          oldestId = id;
        }
      }
      if (oldestId) this._rooms.delete(oldestId);
    }
  }

  _appendLog(entry) {
    if (this._accessLogs.length >= MAX_ACCESS_LOGS) {
      this._accessLogs.shift();
    }
    this._accessLogs.push({
      id: `log_${randomBytes(6).toString('hex')}`,
      ...entry,
      loggedAt: new Date().toISOString(),
    });
  }

  /**
   * Create a new scoped, expiring, revocable sharing room.
   */
  createRoom({
    ownerId,
    title,
    recipientId = null,
    files = [],
    expiresInMs = 24 * 60 * 60 * 1000,
    maxDownloadsPerFile = 5,
    nowMs = Date.now(),
  }) {
    this._evictRoomIfFull();
    const roomId = `room_${randomBytes(8).toString('hex')}`;
    const shareToken = randomBytes(16).toString('hex');
    const createdAt = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + expiresInMs).toISOString();

    const fileMap = {};
    for (const f of files) {
      fileMap[f.fileId] = {
        fileId: f.fileId,
        title: f.title,
        provenanceType: f.provenanceType || 'citizen_entered',
        permission: Object.values(FILE_PERMISSIONS).includes(f.permission)
          ? f.permission
          : FILE_PERMISSIONS.VIEW,
        redactedFields: Array.isArray(f.redactedFields) ? [...f.redactedFields] : [],
        redactedSummary: f.redactedSummary || '',
        contentHash: f.contentHash || null,
        downloadCount: 0,
        maxDownloads: Number(f.maxDownloads || maxDownloadsPerFile),
      };
    }

    const room = {
      roomId,
      shareToken,
      ownerId,
      recipientId,
      title,
      files: fileMap,
      status: ROOM_STATUS.ACTIVE,
      createdAt,
      expiresAt,
      revokedAt: null,
      usedNonces: new Set(),
    };

    this._rooms.set(roomId, room);
    this._appendLog({
      roomId,
      actorId: ownerId,
      action: 'ROOM_CREATED',
      outcome: 'ALLOWED',
      fileId: null,
    });

    return this._sanitizeRoomForOwner(room);
  }

  _sanitizeRoomForOwner(room, nowMs = Date.now()) {
    const expired = new Date(room.expiresAt).getTime() <= nowMs;
    const effectiveStatus =
      room.status === ROOM_STATUS.REVOKED
        ? ROOM_STATUS.REVOKED
        : expired
          ? ROOM_STATUS.EXPIRED
          : ROOM_STATUS.ACTIVE;

    return {
      roomId: room.roomId,
      shareToken: room.shareToken,
      ownerId: room.ownerId,
      recipientId: room.recipientId,
      title: room.title,
      files: Object.values(room.files),
      status: effectiveStatus,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      revokedAt: room.revokedAt,
      nonIndexableUrl: `/redacted-sharing-room?room=${room.roomId}&t=${room.shareToken}`,
    };
  }

  listOwnerRooms(ownerId, nowMs = Date.now()) {
    const list = [];
    for (const room of this._rooms.values()) {
      if (room.ownerId === ownerId) {
        list.push(this._sanitizeRoomForOwner(room, nowMs));
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  revokeRoom(roomId, actorId) {
    const room = this._rooms.get(roomId);
    if (!room) return { ok: false, status: 404, error: 'Sharing room not found' };
    if (room.ownerId !== actorId) {
      this._appendLog({
        roomId,
        actorId,
        action: 'REVOKE_ATTEMPT',
        outcome: 'DENIED_CROSS_USER',
        fileId: null,
      });
      return { ok: false, status: 403, error: 'Only the room owner can revoke this sharing room' };
    }

    room.status = ROOM_STATUS.REVOKED;
    room.revokedAt = new Date().toISOString();
    this._appendLog({
      roomId,
      actorId,
      action: 'ROOM_REVOKED',
      outcome: 'ALLOWED',
      fileId: null,
    });

    return { ok: true, status: 200, room: this._sanitizeRoomForOwner(room) };
  }

  /**
   * Access (view or download) a specific file in a sharing room.
   * Enforces: token match, recipient scoping (if set), revocation, expiry,
   * replay-nonce uniqueness, per-file permissions, and download caps.
   */
  accessFile({
    roomId,
    shareToken,
    fileId,
    actorId,
    action = 'view',
    nonce = null,
    nowMs = Date.now(),
  }) {
    const room = this._rooms.get(roomId);
    if (!room) {
      return { ok: false, status: 404, code: 'ROOM_NOT_FOUND', error: 'Sharing room not found' };
    }

    if (!shareToken || shareToken !== room.shareToken) {
      this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_INVALID_TOKEN' });
      return { ok: false, status: 403, code: 'INVALID_TOKEN', error: 'Invalid share token' };
    }

    // Recipient scoping: if room is bound to a specific recipientId, reject other non-owner users
    if (room.recipientId && actorId !== room.ownerId && actorId !== room.recipientId) {
      this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_CROSS_USER' });
      return { ok: false, status: 403, code: 'CROSS_USER_DENIED', error: 'Access restricted to designated recipient' };
    }

    if (room.status === ROOM_STATUS.REVOKED) {
      this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_REVOKED' });
      return { ok: false, status: 410, code: 'ROOM_REVOKED', error: 'Sharing room has been revoked by owner' };
    }

    if (new Date(room.expiresAt).getTime() <= nowMs) {
      this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_EXPIRED' });
      return { ok: false, status: 410, code: 'ROOM_EXPIRED', error: 'Sharing room access has expired' };
    }

    // Replay protection
    if (nonce) {
      if (room.usedNonces.has(nonce)) {
        this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_REPLAY' });
        return { ok: false, status: 409, code: 'ERR_REPLAY_DETECTED', error: 'Request nonce already consumed (replay blocked)' };
      }
      room.usedNonces.add(nonce);
    }

    const file = room.files[fileId];
    if (!file) {
      this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_FILE_NOT_FOUND' });
      return { ok: false, status: 404, code: 'FILE_NOT_FOUND', error: 'Document not in this sharing room' };
    }

    if (file.permission === FILE_PERMISSIONS.DENIED) {
      this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_PERMISSION' });
      return { ok: false, status: 403, code: 'PERMISSION_DENIED', error: 'Access to this file is denied' };
    }

    if (action === 'download' && file.permission !== FILE_PERMISSIONS.DOWNLOAD) {
      this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_DOWNLOAD_SCOPE' });
      return { ok: false, status: 403, code: 'DOWNLOAD_NOT_PERMITTED', error: 'This file is view-only; downloads are disabled' };
    }

    if (action === 'download') {
      if (file.downloadCount >= file.maxDownloads) {
        this._appendLog({ roomId, actorId, action, fileId, outcome: 'DENIED_DOWNLOAD_LIMIT' });
        return { ok: false, status: 429, code: 'DOWNLOAD_LIMIT_REACHED', error: 'Maximum download limit reached for this file' };
      }
      file.downloadCount += 1;
    }

    this._appendLog({ roomId, actorId, action: action === 'download' ? 'FILE_DOWNLOADED' : 'FILE_VIEWED', fileId, outcome: 'ALLOWED' });

    return {
      ok: true,
      status: 200,
      file: {
        fileId: file.fileId,
        title: file.title,
        provenanceType: file.provenanceType,
        permission: file.permission,
        redactedFields: file.redactedFields,
        redactedSummary: file.redactedSummary,
        contentHash: file.contentHash,
        downloadsRemaining: Math.max(0, file.maxDownloads - file.downloadCount),
      },
    };
  }

  getAccessLog(roomId, actorId) {
    const room = this._rooms.get(roomId);
    if (!room) return { ok: false, status: 404, error: 'Sharing room not found' };
    if (room.ownerId !== actorId) {
      return { ok: false, status: 403, error: 'Only the room owner can view access logs' };
    }
    const items = this._accessLogs.filter((l) => l.roomId === roomId).reverse();
    return { ok: true, status: 200, items, total: items.length };
  }

  clear() {
    this._rooms.clear();
    this._accessLogs.length = 0;
  }
}

let _productionStore = null;

export function getProductionRedactedSharingRoomStore() {
  if (!_productionStore) {
    _productionStore = new InMemoryRedactedSharingRoomStore();
  }
  return _productionStore;
}

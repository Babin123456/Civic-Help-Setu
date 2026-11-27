/**
 * tests/redacted-sharing-room.test.js
 *
 * Integration, authorization, replay, expiry, revocation, and privacy tests
 * for the Secure Redacted Document Sharing Room (#1426).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRedactedSharingRoomStore, FILE_PERMISSIONS } from '../api/_lib/redactedSharingRoomStore.js';
import redactedSharingRoomHandler from '../api/_lib/handlers/redacted-sharing-room.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end(raw) {
      try {
        this.body = JSON.parse(raw);
      } catch {
        this.body = raw;
      }
      return this;
    },
  };
  return res;
}

describe('redactedSharingRoom API & Store (#1426)', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryRedactedSharingRoomStore();
  });

  it('rejects unauthenticated requests with 401 and sets non-indexable X-Robots-Tag header', async () => {
    const req = { method: 'GET', url: '/api/redacted-sharing-room', headers: {} };
    const res = createMockRes();
    await redactedSharingRoomHandler(req, res, { storeOverride: store });

    expect(res.statusCode).toBe(401);
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow, noarchive');
    expect(res.headers['Cache-Control']).toContain('no-store');
  });

  it('rejects unredacted Aadhaar/PAN PII on room creation (400)', async () => {
    const req = {
      method: 'POST',
      url: '/api/redacted-sharing-room',
      headers: { 'x-forwarded-for': '10.1.0.1' },
      body: {
        title: 'Unsafe Room',
        files: [
          {
            fileId: 'f1',
            title: 'Unredacted Slip',
            permission: 'view',
            redactedSummary: 'Aadhaar 1234 5678 9012',
          },
        ],
      },
    };
    const res = createMockRes();
    await redactedSharingRoomHandler(req, res, {
      authUserOverride: { userId: 'owner-1', role: 'citizen' },
      storeOverride: store,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.details[0]).toMatch(/unredacted PII/i);
  });

  it('enforces per-file permissions: view-only blocks download (403) while download file succeeds (200)', async () => {
    const room = store.createRoom({
      ownerId: 'owner-1',
      recipientId: 'advisor-1',
      title: 'Advisor Share',
      files: [
        { fileId: 'f-view', title: 'Receipt', permission: FILE_PERMISSIONS.VIEW },
        { fileId: 'f-dl', title: 'Checklist', permission: FILE_PERMISSIONS.DOWNLOAD },
        { fileId: 'f-deny', title: 'Private', permission: FILE_PERMISSIONS.DENIED },
      ],
    });

    // View-only file: view allowed, download denied
    const viewOk = store.accessFile({
      roomId: room.roomId,
      shareToken: room.shareToken,
      fileId: 'f-view',
      actorId: 'advisor-1',
      action: 'view',
      nonce: 'n-1',
    });
    expect(viewOk.status).toBe(200);

    const dlBlocked = store.accessFile({
      roomId: room.roomId,
      shareToken: room.shareToken,
      fileId: 'f-view',
      actorId: 'advisor-1',
      action: 'download',
      nonce: 'n-2',
    });
    expect(dlBlocked.status).toBe(403);
    expect(dlBlocked.code).toBe('DOWNLOAD_NOT_PERMITTED');

    // Download file: download allowed
    const dlOk = store.accessFile({
      roomId: room.roomId,
      shareToken: room.shareToken,
      fileId: 'f-dl',
      actorId: 'advisor-1',
      action: 'download',
      nonce: 'n-3',
    });
    expect(dlOk.status).toBe(200);

    // Denied file: view denied
    const denyBlocked = store.accessFile({
      roomId: room.roomId,
      shareToken: room.shareToken,
      fileId: 'f-deny',
      actorId: 'advisor-1',
      action: 'view',
      nonce: 'n-4',
    });
    expect(denyBlocked.status).toBe(403);
  });

  it('blocks replay attacks when the same nonce is reused (409 ERR_REPLAY_DETECTED)', () => {
    const room = store.createRoom({
      ownerId: 'owner-2',
      title: 'Replay Test',
      files: [{ fileId: 'f1', title: 'Doc', permission: FILE_PERMISSIONS.DOWNLOAD }],
    });

    const first = store.accessFile({
      roomId: room.roomId,
      shareToken: room.shareToken,
      fileId: 'f1',
      actorId: 'viewer-1',
      action: 'download',
      nonce: 'unique-nonce-99',
    });
    expect(first.status).toBe(200);

    const replay = store.accessFile({
      roomId: room.roomId,
      shareToken: room.shareToken,
      fileId: 'f1',
      actorId: 'viewer-1',
      action: 'download',
      nonce: 'unique-nonce-99',
    });
    expect(replay.status).toBe(409);
    expect(replay.code).toBe('ERR_REPLAY_DETECTED');
  });

  it('blocks cross-user access to designated rooms, revocation, and access logs (403)', () => {
    const room = store.createRoom({
      ownerId: 'owner-3',
      recipientId: 'advisor-approved',
      title: 'Scoped Room',
      files: [{ fileId: 'f1', title: 'Doc', permission: FILE_PERMISSIONS.VIEW }],
    });

    // Unrelated third user cannot access even with token
    const crossAccess = store.accessFile({
      roomId: room.roomId,
      shareToken: room.shareToken,
      fileId: 'f1',
      actorId: 'intruder-user',
      action: 'view',
    });
    expect(crossAccess.status).toBe(403);
    expect(crossAccess.code).toBe('CROSS_USER_DENIED');

    // Non-owner cannot revoke
    const crossRevoke = store.revokeRoom(room.roomId, 'intruder-user');
    expect(crossRevoke.status).toBe(403);

    // Non-owner cannot read access logs
    const crossLogs = store.getAccessLog(room.roomId, 'intruder-user');
    expect(crossLogs.status).toBe(403);

    // Owner CAN read access logs and sees DENIED_CROSS_USER recorded
    const ownerLogs = store.getAccessLog(room.roomId, 'owner-3');
    expect(ownerLogs.status).toBe(200);
    expect(ownerLogs.items.some((l) => l.outcome === 'DENIED_CROSS_USER')).toBe(true);
  });

  it('refuses access after expiry or immediate revocation (410)', () => {
    const expiredRoom = store.createRoom({
      ownerId: 'owner-4',
      title: 'Expiring Room',
      files: [{ fileId: 'f1', title: 'Doc', permission: FILE_PERMISSIONS.VIEW }],
      expiresInMs: 1000,
      nowMs: 10000,
    });

    const afterExpiry = store.accessFile({
      roomId: expiredRoom.roomId,
      shareToken: expiredRoom.shareToken,
      fileId: 'f1',
      actorId: 'viewer-1',
      nowMs: 12000,
    });
    expect(afterExpiry.status).toBe(410);
    expect(afterExpiry.code).toBe('ROOM_EXPIRED');

    const activeRoom = store.createRoom({
      ownerId: 'owner-4',
      title: 'Revocable Room',
      files: [{ fileId: 'f1', title: 'Doc', permission: FILE_PERMISSIONS.VIEW }],
    });
    store.revokeRoom(activeRoom.roomId, 'owner-4');

    const afterRevoke = store.accessFile({
      roomId: activeRoom.roomId,
      shareToken: activeRoom.shareToken,
      fileId: 'f1',
      actorId: 'viewer-1',
    });
    expect(afterRevoke.status).toBe(410);
    expect(afterRevoke.code).toBe('ROOM_REVOKED');
  });
});

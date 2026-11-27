/**
 * src/services/redactedSharingRoomService.test.js
 *
 * Unit tests for Redacted Document Sharing Room client service (#1426).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  redactSensitiveText,
  buildNonIndexableShareUrl,
  createLocalSharingRoom,
  listLocalSharingRooms,
  revokeLocalSharingRoom,
  listLocalAccessLogs,
} from './redactedSharingRoomService.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('redactedSharingRoomService (#1426)', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('redacts Aadhaar, PAN, and phone numbers from summaries before sharing', () => {
    const { redactedText, redactedFields } = redactSensitiveText(
      'Applicant Aadhaar 1234 5678 9012, PAN ABCDE1234F, Call 9876543210'
    );
    expect(redactedText).toContain('[REDACTED:AADHAAR]');
    expect(redactedText).toContain('[REDACTED:PAN]');
    expect(redactedText).toContain('[REDACTED:PHONE]');
    expect(redactedFields).toEqual(['aadhaar', 'pan', 'phone']);
  });

  it('creates a scoped room with per-file permissions and non-indexable URL', () => {
    const room = createLocalSharingRoom({
      ownerId: 'citizen-1',
      title: 'Ration Card Help',
      files: [
        { fileId: 'f1', title: 'Ack Slip', permission: 'view', summary: 'Counter ref 1234 5678 9012' },
        { fileId: 'f2', title: 'Bill', permission: 'download', summary: 'Ward 5 bill' },
      ],
      customStorage: storage,
    });

    expect(room.status).toBe('ACTIVE');
    expect(room.files[0].redactedSummary).toContain('[REDACTED:AADHAAR]');
    expect(room.nonIndexableUrl).toBe(buildNonIndexableShareUrl(room.roomId, room.shareToken));

    const rooms = listLocalSharingRooms('citizen-1', storage);
    expect(rooms).toHaveLength(1);
    const logs = listLocalAccessLogs(room.roomId, 'citizen-1', storage);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('ROOM_CREATED');
  });

  it('enforces owner-only revocation and updates room status immediately', () => {
    const room = createLocalSharingRoom({
      ownerId: 'citizen-1',
      title: 'Tax Help',
      files: [{ fileId: 'f1', title: 'Receipt', permission: 'view' }],
      customStorage: storage,
    });

    expect(() => revokeLocalSharingRoom(room.roomId, 'attacker-2', storage)).toThrow(/owner/i);
    const revoked = revokeLocalSharingRoom(room.roomId, 'citizen-1', storage);
    expect(revoked.status).toBe('REVOKED');
    expect(revoked.revokedAt).toBeTruthy();
  });

  it('marks expired rooms as EXPIRED when listing', () => {
    createLocalSharingRoom({
      ownerId: 'citizen-1',
      title: 'Expired Room',
      files: [{ fileId: 'f1', title: 'Doc', permission: 'view' }],
      expiresInMs: -1000,
      customStorage: storage,
    });

    const rooms = listLocalSharingRooms('citizen-1', storage);
    expect(rooms[0].status).toBe('EXPIRED');
  });
});

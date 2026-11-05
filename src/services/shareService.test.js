import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSendServiceShareEmail = vi.fn();
vi.mock('../services/emailService', () => ({
  sendServiceShareEmail: (...args) => mockSendServiceShareEmail(...args),
}));

const mockGetServiceById = vi.fn();
const mockGetAllServices = vi.fn(() => []);
vi.mock('../services/serviceCatalog', () => ({
  getServiceById: (...args) => mockGetServiceById(...args),
  getAllServices: (...args) => mockGetAllServices(...args),
}));

import {
  validateRecipient,
  validateNote,
  resolveShareableServices,
  buildSharePayload,
  sendServiceShare,
  SHARE_NOTE_MAX_LENGTH,
  MAX_SERVICES_PER_SHARE,
} from './shareService';

const mockServices = [
  {
    id: 'birth-certificate',
    name: 'Birth Certificate',
    shortDescription: 'Official record of a person\'s birth.',
    category: 'Certificates',
    department: 'Municipal Administration',
    officialSources: [{ name: 'Portal', url: 'https://services.india.gov.in', verified: true }],
    lastVerified: '2023-10-01',
    archived: false,
  },
  {
    id: 'aadhaar-card',
    name: 'Aadhaar Card Enrollment',
    shortDescription: '12-digit unique identity number.',
    category: 'Identity',
    department: 'UIDAI',
    officialSources: [{ name: 'UIDAI', url: 'https://uidai.gov.in', verified: true }],
    lastVerified: '2023-11-05',
    archived: false,
  },
  {
    id: 'archived-service',
    name: 'Archived Service',
    shortDescription: 'This service is archived.',
    category: 'Certificates',
    department: 'Municipal Administration',
    officialSources: [],
    lastVerified: '2022-01-01',
    archived: true,
  },
];

describe('shareService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllServices.mockReturnValue(mockServices);
    mockSendServiceShareEmail.mockResolvedValue({ sent: true, messageId: 'msg_123' });
  });

  describe('validateRecipient', () => {
    it('accepts a valid email', () => {
      expect(validateRecipient('user@example.com')).toBe('user@example.com');
      expect(validateRecipient('User.Name+tag@Example.COM')).toBe('user.name+tag@example.com');
    });

    it('rejects invalid emails', () => {
      expect(validateRecipient('')).toBeNull();
      expect(validateRecipient('not-an-email')).toBeNull();
      expect(validateRecipient('missing@domain')).toBeNull();
      expect(validateRecipient(123)).toBeNull();
      expect(validateRecipient(null)).toBeNull();
    });

    it('trims whitespace', () => {
      expect(validateRecipient('  user@example.com  ')).toBe('user@example.com');
    });
  });

  describe('validateNote', () => {
    it('accepts a note within the limit', () => {
      expect(validateNote('A short note.')).toBe('A short note.');
      expect(validateNote('')).toBe('');
    });

    it('trims the note', () => {
      expect(validateNote('  spaced note  ')).toBe('spaced note');
    });

    it('rejects a note over the limit', () => {
      const longNote = 'a'.repeat(SHARE_NOTE_MAX_LENGTH + 1);
      expect(validateNote(longNote)).toBeNull();
    });

    it('accepts a note exactly at the limit', () => {
      const maxNote = 'a'.repeat(SHARE_NOTE_MAX_LENGTH);
      expect(validateNote(maxNote)).toBe(maxNote);
    });

    it('handles non-string input', () => {
      expect(validateNote(123)).toBe('');
      expect(validateNote(null)).toBe('');
    });
  });

  describe('resolveShareableServices', () => {
    it('returns shareable records for valid services', () => {
      const result = resolveShareableServices(['birth-certificate', 'aadhaar-card']);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'birth-certificate',
        name: 'Birth Certificate',
        description: 'Official record of a person\'s birth.',
        officialLink: 'https://services.india.gov.in/',
        verifiedAt: '2023-10-01',
      });
      expect(result[1]).toMatchObject({
        id: 'aadhaar-card',
        name: 'Aadhaar Card Enrollment',
        officialLink: 'https://uidai.gov.in/',
        verifiedAt: '2023-11-05',
      });
    });

    it('excludes archived services', () => {
      const result = resolveShareableServices(['birth-certificate', 'archived-service']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('birth-certificate');
    });

    it('skips unknown service IDs', () => {
      const result = resolveShareableServices(['birth-certificate', 'non-existent-id']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('birth-certificate');
    });

    it('returns empty for empty input', () => {
      expect(resolveShareableServices([])).toEqual([]);
      expect(resolveShareableServices()).toEqual([]);
    });

    it('deduplicates IDs', () => {
      const result = resolveShareableServices(['birth-certificate', 'birth-certificate']);
      expect(result).toHaveLength(1);
    });

    it('enforces max services per share', () => {
      const manyIds = Array.from({ length: MAX_SERVICES_PER_SHARE + 1 }, (_, i) => `svc-${i}`);
      expect(resolveShareableServices(manyIds)).toEqual([]);
    });

    it('sanitizes service text fields', () => {
      const dirtyServices = [
        {
          ...mockServices[0],
          name: 'Birth <script>alert("xss")</script> Certificate',
          shortDescription: 'Official record <img src=x onerror=1>',
        },
      ];
      mockGetAllServices.mockReturnValue(dirtyServices);
      const result = resolveShareableServices(['birth-certificate']);
      expect(result[0].name).not.toContain('<script>');
      expect(result[0].description).not.toContain('<img');
    });

    it('validates official links', () => {
      const servicesWithBadLink = [
        {
          ...mockServices[0],
          officialSources: [{ name: 'Portal', url: 'javascript:alert(1)', verified: true }],
        },
      ];
      mockGetAllServices.mockReturnValue(servicesWithBadLink);
      const result = resolveShareableServices(['birth-certificate']);
      expect(result[0].officialLink).toBe('');
    });
  });

  describe('buildSharePayload', () => {
    it('builds a valid payload for multiple services', () => {
      const result = buildSharePayload({
        to: 'recipient@example.com',
        serviceIds: ['birth-certificate', 'aadhaar-card'],
        note: 'Please check these services.',
      });

      expect(result.ok).toBe(true);
      expect(result.to).toBe('recipient@example.com');
      expect(result.subject).toBe('Civic services shared with you');
      expect(result.services).toHaveLength(2);
      expect(result.note).toBe('Please check these services.');
      expect(result.senderEmail).toBe('');
    });

    it('rejects invalid recipient', () => {
      const result = buildSharePayload({
        to: 'not-an-email',
        serviceIds: ['birth-certificate'],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_recipient');
    });

    it('rejects no services', () => {
      const result = buildSharePayload({
        to: 'recipient@example.com',
        serviceIds: [],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('no_services');
    });

    it('rejects note too long', () => {
      const result = buildSharePayload({
        to: 'recipient@example.com',
        serviceIds: ['birth-certificate'],
        note: 'a'.repeat(SHARE_NOTE_MAX_LENGTH + 1),
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('note_too_long');
    });

    it('sanitizes the note', () => {
      const result = buildSharePayload({
        to: 'recipient@example.com',
        serviceIds: ['birth-certificate'],
        note: 'Note with <script>alert(1)</script> tag',
      });
      expect(result.ok).toBe(true);
      expect(result.note).not.toContain('<script>');
    });

    it('includes optional sender email', () => {
      const result = buildSharePayload({
        to: 'recipient@example.com',
        serviceIds: ['birth-certificate'],
        senderEmail: 'sender@example.com',
      });
      expect(result.ok).toBe(true);
      expect(result.senderEmail).toBe('sender@example.com');
    });
  });

  describe('sendServiceShare', () => {
    it('sends share email successfully for multiple services', async () => {
      const result = await sendServiceShare({
        to: 'recipient@example.com',
        serviceIds: ['birth-certificate', 'aadhaar-card'],
        note: 'Check these out.',
      });

      expect(result.ok).toBe(true);
      expect(result.sent).toBe(true);
      expect(mockSendServiceShareEmail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendServiceShareEmail.mock.calls[0];
      expect(callArgs[0]).toBe('recipient@example.com');
      expect(callArgs[1].services).toHaveLength(2);
      expect(callArgs[1].note).toBe('Check these out.');
    });

    it('returns error for invalid recipient', async () => {
      const result = await sendServiceShare({
        to: 'invalid-email',
        serviceIds: ['birth-certificate'],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_recipient');
      expect(mockSendServiceShareEmail).not.toHaveBeenCalled();
    });

    it('returns error when email send fails', async () => {
      mockSendServiceShareEmail.mockResolvedValue({ sent: false, reason: 'send_failed' });
      const result = await sendServiceShare({
        to: 'recipient@example.com',
        serviceIds: ['birth-certificate'],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('send_failed');
    });

    it('excludes sender profile data from the email payload', async () => {
      await sendServiceShare({
        to: 'recipient@example.com',
        serviceIds: ['birth-certificate'],
        note: 'Hello',
        senderEmail: 'sender@example.com',
        userId: 'user_123',
      });

      const data = mockSendServiceShareEmail.mock.calls[0][1];
      // Only email-related fields should be present, no profile/history data
      expect(data.userId).toBeUndefined();
      expect(data.savedServices).toBeUndefined();
      expect(data.profile).toBeUndefined();
      expect(data.senderEmail).toBe('sender@example.com');
      expect(data.services).toBeDefined();
      expect(data.note).toBe('Hello');
    });

    it('handles network errors', async () => {
      mockSendServiceShareEmail.mockRejectedValue(new Error('Network down'));
      const result = await sendServiceShare({
        to: 'recipient@example.com',
        serviceIds: ['birth-certificate'],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('network_error');
    });
  });

  describe('constants', () => {
    it('exports SHARE_NOTE_MAX_LENGTH', () => {
      expect(SHARE_NOTE_MAX_LENGTH).toBe(500);
    });

    it('exports MAX_SERVICES_PER_SHARE', () => {
      expect(MAX_SERVICES_PER_SHARE).toBe(10);
    });
  });
});

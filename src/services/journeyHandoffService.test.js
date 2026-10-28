import { describe, it, expect, beforeEach } from 'vitest';
import {
  HANDOFF_STATUSES,
  generateSecureToken,
  getAllHandoffs,
  saveAllHandoffs,
  createJourneyHandoff,
  getHandoffByToken,
  getSharedChecklistView,
  toggleSharedTask,
  revokeJourneyHandoff,
  getUserHandoffs,
  deleteJourneyHandoff,
} from './journeyHandoffService';

const makeStorage = (initialData = {}) => {
  const map = new Map(Object.entries(initialData));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
};

describe('journeyHandoffService', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeStorage();
  });

  describe('Token Generation & Uniqueness', () => {
    it('generates high-entropy unguessable tokens starting with jh_', () => {
      const t1 = generateSecureToken();
      const t2 = generateSecureToken();
      expect(t1.startsWith('jh_')).toBe(true);
      expect(t2.startsWith('jh_')).toBe(true);
      expect(t1).not.toBe(t2);
      expect(t1.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Creation and Selective Task Delegation', () => {
    it('creates a handoff containing only the user-selected non-sensitive tasks', () => {
      const selectedTasks = [
        { id: 't1', title: 'Bring 4 Passport Photos', category: 'photos' },
        { id: 't2', title: 'Print Doctor Form 1A', category: 'printout' },
      ];

      const handoff = createJourneyHandoff(
        { id: 'user_101', email: 'citizen@example.org' },
        {
          serviceId: 'driving-licence',
          serviceName: 'Driving Licence',
          title: 'Preparation for Father',
          recipientLabel: 'Elder Care Volunteer',
          tasks: selectedTasks,
          hoursValid: 72, // 3 days
        },
        mockStorage
      );

      expect(handoff.id).toBeDefined();
      expect(handoff.token.startsWith('jh_')).toBe(true);
      expect(handoff.ownerUserId).toBe('user_101');
      expect(handoff.tasks.length).toBe(2);
      expect(handoff.tasks[0].title).toBe('Bring 4 Passport Photos');
      expect(handoff.revoked).toBe(false);
      expect(new Date(handoff.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects creation without authentication or with empty tasks', () => {
      expect(() => {
        createJourneyHandoff(null, { serviceId: 'dl', serviceName: 'DL', tasks: [{ title: 'Task' }] }, mockStorage);
      }).toThrow(/Authentication required/);

      expect(() => {
        createJourneyHandoff({ id: 'user_1' }, { serviceId: 'dl', serviceName: 'DL', tasks: [] }, mockStorage);
      }).toThrow(/At least one preparation task must be selected/);
    });
  });

  describe('Token Expiry Enforcement', () => {
    it('returns ACTIVE for unexpired tokens', () => {
      const handoff = createJourneyHandoff(
        { id: 'user_owner' },
        {
          serviceId: 'ration-card',
          serviceName: 'Ration Card',
          tasks: [{ id: '1', title: 'Check ration shop address' }],
          hoursValid: 24,
        },
        mockStorage
      );

      const check = getHandoffByToken(handoff.token, mockStorage);
      expect(check.status).toBe(HANDOFF_STATUSES.ACTIVE);
      expect(check.handoff.title).toBe(handoff.title);
    });

    it('returns EXPIRED when current time exceeds expiration timestamp', () => {
      const all = [
        {
          id: 'h_old',
          token: 'jh_expired_token_123',
          ownerUserId: 'user_owner',
          serviceId: 'ration-card',
          serviceName: 'Ration Card',
          title: 'Old Ration Card Prep',
          tasks: [{ id: '1', title: 'Expired task' }],
          expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(), // expired 1 hour ago
          revoked: false,
        },
      ];
      saveAllHandoffs(all, mockStorage);

      const check = getHandoffByToken('jh_expired_token_123', mockStorage);
      expect(check.status).toBe(HANDOFF_STATUSES.EXPIRED);

      const sharedView = getSharedChecklistView('jh_expired_token_123', mockStorage);
      expect(sharedView.status).toBe(HANDOFF_STATUSES.EXPIRED);
      expect(sharedView.tasks.length).toBe(0);
    });
  });

  describe('Revocation Enforcement', () => {
    it('allows owner to revoke active handoff and terminates helper access immediately', () => {
      const handoff = createJourneyHandoff(
        { id: 'user_sarah' },
        {
          serviceId: 'passport',
          serviceName: 'Passport Renewal',
          tasks: [{ id: 'p1', title: 'Photo copies' }],
          hoursValid: 48,
        },
        mockStorage
      );

      // Verify active before revocation
      expect(getHandoffByToken(handoff.token, mockStorage).status).toBe(HANDOFF_STATUSES.ACTIVE);

      // Revoke by owner
      revokeJourneyHandoff(handoff.id, { id: 'user_sarah' }, 'No longer needed', mockStorage);

      // Verify revoked immediately
      const check = getHandoffByToken(handoff.token, mockStorage);
      expect(check.status).toBe(HANDOFF_STATUSES.REVOKED);
      expect(check.handoff.revokedReason).toBe('No longer needed');

      const sharedView = getSharedChecklistView(handoff.token, mockStorage);
      expect(sharedView.status).toBe(HANDOFF_STATUSES.REVOKED);
      expect(sharedView.tasks.length).toBe(0);
    });

    it('rejects revocation attempt by a different user', () => {
      const handoff = createJourneyHandoff(
        { id: 'user_owner' },
        {
          serviceId: 'passport',
          serviceName: 'Passport',
          tasks: [{ id: 'p1', title: 'Task' }],
        },
        mockStorage
      );

      expect(() => {
        revokeJourneyHandoff(handoff.id, { id: 'user_malicious' }, 'Hacking attempt', mockStorage);
      }).toThrow(/Access denied: You do not own this handoff/);
    });
  });

  describe('Strict Data Isolation Guarantee', () => {
    it('never exposes owner profile, email, vault files, or saved service history in shared view', () => {
      const handoff = createJourneyHandoff(
        { id: 'secret_user_id_999', email: 'confidential.citizen@example.org' },
        {
          serviceId: 'driving-licence',
          serviceName: 'Driving Licence',
          title: 'DL Counter Visit Checklist',
          recipientLabel: 'Sister',
          tasks: [
            { id: 't1', title: 'Bring hardcopy medical certificate Form 1A' },
            { id: 't2', title: 'Confirm appointment token number slot' },
          ],
        },
        mockStorage
      );

      const sharedView = getSharedChecklistView(handoff.token, mockStorage);

      expect(sharedView.status).toBe(HANDOFF_STATUSES.ACTIVE);
      expect(sharedView.title).toBe('DL Counter Visit Checklist');
      expect(sharedView.serviceName).toBe('Driving Licence');
      expect(sharedView.tasks.length).toBe(2);

      // Ensure absolutely no owner identity leaks
      const serialized = JSON.stringify(sharedView);
      expect(serialized).not.toContain('secret_user_id_999');
      expect(serialized).not.toContain('confidential.citizen@example.org');
      expect(sharedView.ownerUserId).toBeUndefined();
      expect(sharedView.email).toBeUndefined();
      expect(sharedView.savedServices).toBeUndefined();
      expect(sharedView.vaultFiles).toBeUndefined();
    });
  });

  describe('Helper Contribution & Task Toggling', () => {
    it('allows helper to toggle task completion state on an active handoff', () => {
      const handoff = createJourneyHandoff(
        { id: 'user_mom' },
        {
          serviceId: 'pension',
          serviceName: 'Pension Scheme',
          tasks: [
            { id: 'task_bank', title: 'Visit SBI branch for passbook attestation', completed: false },
          ],
        },
        mockStorage
      );

      const updatedTasks = toggleSharedTask(handoff.token, 'task_bank', mockStorage);
      expect(updatedTasks[0].completed).toBe(true);

      const viewAfter = getSharedChecklistView(handoff.token, mockStorage);
      expect(viewAfter.tasks[0].completed).toBe(true);
    });

    it('prevents modifying tasks on an expired or revoked handoff', () => {
      const all = [
        {
          id: 'h_revoked',
          token: 'jh_revoked_123',
          ownerUserId: 'user_1',
          tasks: [{ id: 't1', title: 'T1', completed: false }],
          revoked: true,
          expiresAt: new Date(Date.now() + 100000).toISOString(),
        },
      ];
      saveAllHandoffs(all, mockStorage);

      expect(() => {
        toggleSharedTask('jh_revoked_123', 't1', mockStorage);
      }).toThrow(/Cannot modify checklist: Link is revoked/);
    });
  });

  describe('Owner Management and Deletion', () => {
    it('returns only handoffs created by the requesting user with accurate statuses', () => {
      createJourneyHandoff(
        { id: 'user_dan' },
        { serviceId: 's1', serviceName: 'Service 1', tasks: [{ id: '1', title: 'T1' }] },
        mockStorage
      );
      createJourneyHandoff(
        { id: 'user_eve' },
        { serviceId: 's2', serviceName: 'Service 2', tasks: [{ id: '2', title: 'T2' }] },
        mockStorage
      );

      const dansHandoffs = getUserHandoffs({ id: 'user_dan' }, mockStorage);
      expect(dansHandoffs.length).toBe(1);
      expect(dansHandoffs[0].serviceId).toBe('s1');
      expect(dansHandoffs[0].status).toBe(HANDOFF_STATUSES.ACTIVE);
    });

    it('deletes handoff record cleanly', () => {
      const handoff = createJourneyHandoff(
        { id: 'user_del' },
        { serviceId: 's_del', serviceName: 'Service Del', tasks: [{ id: '1', title: 'T1' }] },
        mockStorage
      );

      expect(getUserHandoffs({ id: 'user_del' }, mockStorage).length).toBe(1);

      deleteJourneyHandoff(handoff.id, { id: 'user_del' }, mockStorage);
      expect(getUserHandoffs({ id: 'user_del' }, mockStorage).length).toBe(0);
    });
  });
});

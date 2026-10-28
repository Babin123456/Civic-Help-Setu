/**
 * Civic Journey Handoff & Shared Checklist Service
 * 
 * Allows citizens to delegate selected, non-sensitive preparation tasks
 * to trusted helpers (family members, caregivers, community volunteers).
 * 
 * Privacy & Security Guarantees:
 * - Selective disclosure: Citizen chooses exact checklist items included
 * - Unguessable high-entropy tokens
 * - Automated expiration (24h, 3d, 7d, 14d)
 * - Immediate owner revocation
 * - Strict isolation: Profile details, account credentials, saved service history,
 *   and encrypted vault files are NEVER exposed in shared views
 * - Read-only helper view unless explicit check-off is performed
 */

const STORAGE_KEY = 'civicbridge_journey_handoffs_v1';

export const HANDOFF_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  NOT_FOUND: 'NOT_FOUND',
};

export const EXPIRATION_PRESETS = [
  { id: '24h', label: '24 Hours', hours: 24 },
  { id: '3d', label: '3 Days', hours: 72 },
  { id: '7d', label: '7 Days (Recommended)', hours: 168 },
  { id: '14d', label: '14 Days', hours: 336 },
];

/**
 * Safe local storage resolver
 */
const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

/**
 * Generates an unguessable high-entropy cryptographic token
 */
export const generateSecureToken = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `jh_${hex}`;
  }
  // Fallback high-entropy generation
  const rand1 = Math.random().toString(36).substring(2);
  const rand2 = Math.random().toString(36).substring(2);
  const rand3 = Math.random().toString(36).substring(2);
  return `jh_${Date.now().toString(36)}_${rand1}${rand2}${rand3}`;
};

/**
 * Reads all handoff records from storage
 */
export const getAllHandoffs = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Saves all handoff records to storage
 */
export const saveAllHandoffs = (handoffs, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(handoffs));
    return true;
  } catch {
    return false;
  }
};

/**
 * Creates a new limited-scope journey handoff
 */
export const createJourneyHandoff = (ownerUser, handoffData, customStorage) => {
  if (!ownerUser || (!ownerUser.id && !ownerUser.userId)) {
    throw new Error('Authentication required: Only the journey owner can create a shared handoff.');
  }

  const ownerId = (ownerUser.id || ownerUser.userId).trim();

  if (!handoffData || typeof handoffData !== 'object') {
    throw new Error('Handoff data is required.');
  }

  if (!handoffData.serviceId || !handoffData.serviceName) {
    throw new Error('Service identification is required for checklist handoff.');
  }

  if (!Array.isArray(handoffData.tasks) || handoffData.tasks.length === 0) {
    throw new Error('At least one preparation task must be selected for handoff.');
  }

  // Filter tasks to ensure non-sensitive fields only
  const sanitizedTasks = handoffData.tasks.map((task, idx) => ({
    id: task.id || `task_${idx + 1}`,
    title: String(task.title || task.text || 'Preparation task').trim(),
    description: task.description ? String(task.description).trim() : '',
    category: task.category || 'document_prep',
    completed: Boolean(task.completed),
  }));

  const hoursValid = Number(handoffData.hoursValid) || 168; // default 7 days
  const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000).toISOString();
  const token = generateSecureToken();

  const newHandoff = {
    id: `handoff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    token,
    ownerUserId: ownerId,
    serviceId: handoffData.serviceId,
    serviceName: handoffData.serviceName,
    title: (handoffData.title || `Checklist for ${handoffData.serviceName}`).trim(),
    recipientLabel: (handoffData.recipientLabel || 'Trusted Helper').trim(),
    tasks: sanitizedTasks,
    expiresAt,
    revoked: false,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date().toISOString(),
  };

  const all = getAllHandoffs(customStorage);
  all.unshift(newHandoff);
  saveAllHandoffs(all, customStorage);

  return newHandoff;
};

/**
 * Retrieves a handoff by token and verifies its status (Active, Expired, Revoked)
 */
export const getHandoffByToken = (token, customStorage) => {
  if (!token || typeof token !== 'string') {
    return { status: HANDOFF_STATUSES.NOT_FOUND, handoff: null };
  }

  const all = getAllHandoffs(customStorage);
  const found = all.find((h) => h.token === token.trim());

  if (!found) {
    return { status: HANDOFF_STATUSES.NOT_FOUND, handoff: null };
  }

  if (found.revoked) {
    return {
      status: HANDOFF_STATUSES.REVOKED,
      handoff: {
        title: found.title,
        serviceName: found.serviceName,
        revokedAt: found.revokedAt,
        revokedReason: found.revokedReason || 'Revoked by checklist owner.',
      },
    };
  }

  const now = new Date();
  const exp = new Date(found.expiresAt);
  if (now > exp) {
    return {
      status: HANDOFF_STATUSES.EXPIRED,
      handoff: {
        title: found.title,
        serviceName: found.serviceName,
        expiresAt: found.expiresAt,
      },
    };
  }

  return { status: HANDOFF_STATUSES.ACTIVE, handoff: found };
};

/**
 * Returns a sanitized view for helper users that strictly excludes all owner profile details
 */
export const getSharedChecklistView = (token, customStorage) => {
  const check = getHandoffByToken(token, customStorage);

  if (check.status !== HANDOFF_STATUSES.ACTIVE) {
    return {
      status: check.status,
      serviceName: check.handoff?.serviceName || null,
      title: check.handoff?.title || null,
      revokedAt: check.handoff?.revokedAt || null,
      expiresAt: check.handoff?.expiresAt || null,
      tasks: [],
      securityNotice: 'This link is no longer accessible because it was revoked or has expired.',
    };
  }

  const item = check.handoff;

  // Ensure absolutely no owner details or account metadata are exposed
  return {
    status: HANDOFF_STATUSES.ACTIVE,
    token: item.token,
    title: item.title,
    serviceName: item.serviceName,
    recipientLabel: item.recipientLabel,
    tasks: item.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      completed: t.completed,
    })),
    expiresAt: item.expiresAt,
    createdAt: item.createdAt,
    securityNotice:
      'This shared checklist is limited to selected non-sensitive preparation tasks. Account details, documents, and case records are not accessible.',
  };
};

/**
 * Toggles a task completion in a shared checklist (read-only helper contribution)
 */
export const toggleSharedTask = (token, taskId, customStorage) => {
  const check = getHandoffByToken(token, customStorage);
  if (check.status !== HANDOFF_STATUSES.ACTIVE) {
    throw new Error(`Cannot modify checklist: Link is ${check.status.toLowerCase()}.`);
  }

  const all = getAllHandoffs(customStorage);
  const index = all.findIndex((h) => h.token === token.trim());
  if (index === -1) throw new Error('Handoff not found.');

  const tasks = all[index].tasks.map((t) => {
    if (t.id === taskId) {
      return { ...t, completed: !t.completed };
    }
    return t;
  });

  all[index].tasks = tasks;
  saveAllHandoffs(all, customStorage);
  return tasks;
};

/**
 * Revokes an active handoff
 */
export const revokeJourneyHandoff = (handoffId, ownerUser, reason = '', customStorage) => {
  if (!ownerUser || (!ownerUser.id && !ownerUser.userId)) {
    throw new Error('Authentication required: Only the journey owner can revoke access.');
  }

  const ownerId = (ownerUser.id || ownerUser.userId).trim();
  const all = getAllHandoffs(customStorage);
  const index = all.findIndex((h) => h.id === handoffId);

  if (index === -1) {
    throw new Error('Handoff not found.');
  }

  if (all[index].ownerUserId !== ownerId) {
    throw new Error('Access denied: You do not own this handoff.');
  }

  all[index].revoked = true;
  all[index].revokedAt = new Date().toISOString();
  all[index].revokedReason = reason || 'Revoked by journey owner.';

  saveAllHandoffs(all, customStorage);
  return all[index];
};

/**
 * Returns all handoffs created by the active user
 */
export const getUserHandoffs = (ownerUser, customStorage) => {
  if (!ownerUser || (!ownerUser.id && !ownerUser.userId)) {
    return [];
  }

  const ownerId = (ownerUser.id || ownerUser.userId).trim();
  const all = getAllHandoffs(customStorage);

  const now = new Date();

  return all
    .filter((h) => h.ownerUserId === ownerId)
    .map((h) => {
      const isExpired = now > new Date(h.expiresAt);
      const isRevoked = Boolean(h.revoked);
      let status = HANDOFF_STATUSES.ACTIVE;
      if (isRevoked) status = HANDOFF_STATUSES.REVOKED;
      else if (isExpired) status = HANDOFF_STATUSES.EXPIRED;

      return {
        ...h,
        status,
        isExpired,
        isRevoked,
      };
    });
};

/**
 * Deletes a handoff record completely
 */
export const deleteJourneyHandoff = (handoffId, ownerUser, customStorage) => {
  if (!ownerUser || (!ownerUser.id && !ownerUser.userId)) {
    throw new Error('Authentication required.');
  }

  const ownerId = (ownerUser.id || ownerUser.userId).trim();
  const all = getAllHandoffs(customStorage);
  const filtered = all.filter((h) => !(h.id === handoffId && h.ownerUserId === ownerId));

  saveAllHandoffs(filtered, customStorage);
  return true;
};

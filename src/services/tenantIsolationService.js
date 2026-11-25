/**
 * src/services/tenantIsolationService.js
 * Multi-Authority Civic Administration Workspace Isolation Engine (#779).
 *
 * Implements strict tenant-scoped data isolation, role-based access control,
 * anti-IDOR boundary guards, tamper-evident SHA-256 audit hash chains,
 * controlled cross-tenant catalogue publication with PII redaction, and
 * bounded explainable local recommendations.
 */

import { sha256Hex } from './privacyIntegrityService.js';
import { logDiagnostic } from '../utils/diagnostics.js';

// ---------------------------------------------------------------------------
// Storage Keys & Schemas
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = {
  TENANTS: 'civicbridge_tenants_v1',
  MEMBERSHIPS: 'civicbridge_tenant_memberships_v1',
  ROLES: 'civicbridge_tenant_roles_v1',
  SETTINGS: 'civicbridge_tenant_settings_v1',
  AUDIT_EVENTS: 'civicbridge_tenant_audit_events_v1',
  DATASETS: 'civicbridge_tenant_datasets_v1',
  SHARED_CATALOGUE: 'civicbridge_shared_catalogue_v1',
  ACTIVE_CONTEXT: 'civicbridge_active_tenant_context_v1',
  MIGRATION_BACKUP: 'civicbridge_tenant_migration_backup_v1',
};

export const SCHEMA_VERSION = 1;
export const GENESIS_AUDIT_HASH = '0'.repeat(64);

// ---------------------------------------------------------------------------
// Error Handling & Standard Error Codes
// ---------------------------------------------------------------------------
export const TENANT_ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN_TENANT_ACCESS: 'FORBIDDEN_TENANT_ACCESS',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PII_DETECTED: 'PII_DETECTED',
  TAMPERED_AUDIT_DETECTED: 'TAMPERED_AUDIT_DETECTED',
};

export class TenantIsolationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TenantIsolationError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Granular Role & Permission Definitions
// ---------------------------------------------------------------------------
export const TENANT_ROLES = {
  ADMIN: 'tenant_admin',
  OPERATOR: 'tenant_operator',
  REVIEWER: 'tenant_reviewer',
  AUDITOR: 'tenant_auditor',
};

export const ROLE_PERMISSIONS = {
  [TENANT_ROLES.ADMIN]: [
    'tenant:read',
    'tenant:manage',
    'staff:read',
    'staff:manage',
    'dataset:read',
    'dataset:write',
    'dataset:delete',
    'settings:read',
    'settings:manage',
    'catalogue:submit',
    'catalogue:approve',
    'catalogue:retract',
    'recommendations:view',
    'recommendations:action',
    'audit:read',
    'audit:verify',
  ],
  [TENANT_ROLES.OPERATOR]: [
    'tenant:read',
    'staff:read',
    'dataset:read',
    'dataset:write',
    'settings:read',
    'catalogue:submit',
    'recommendations:view',
    'audit:read',
  ],
  [TENANT_ROLES.REVIEWER]: [
    'tenant:read',
    'staff:read',
    'dataset:read',
    'settings:read',
    'catalogue:submit',
    'catalogue:approve',
    'catalogue:retract',
    'recommendations:view',
    'recommendations:action',
    'audit:read',
  ],
  [TENANT_ROLES.AUDITOR]: [
    'tenant:read',
    'staff:read',
    'dataset:read',
    'settings:read',
    'audit:read',
    'audit:verify',
  ],
};

// ---------------------------------------------------------------------------
// Seed Data (Standard Test & Production Authorities)
// ---------------------------------------------------------------------------
export const SEED_TENANTS = [
  {
    id: 'tenant-bmc',
    slug: 'bmc-mumbai',
    name: 'Brihanmumbai Municipal Corporation',
    jurisdictionType: 'municipal_corporation',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    jurisdictionCode: 'MH-MC-001',
    status: 'active',
    tier: 'metropolitan',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    createdBy: 'system_bootstrap',
  },
  {
    id: 'tenant-bbmp',
    slug: 'bbmp-bengaluru',
    name: 'Bruhat Bengaluru Mahanagara Palike',
    jurisdictionType: 'municipal_corporation',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    jurisdictionCode: 'KA-MC-002',
    status: 'active',
    tier: 'metropolitan',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-01-12T00:00:00.000Z',
    updatedAt: '2026-01-12T00:00:00.000Z',
    createdBy: 'system_bootstrap',
  },
  {
    id: 'tenant-pmc',
    slug: 'pmc-pune',
    name: 'Pune Municipal Corporation',
    jurisdictionType: 'municipal_corporation',
    state: 'Maharashtra',
    district: 'Pune',
    jurisdictionCode: 'MH-MC-003',
    status: 'active',
    tier: 'tier1',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    createdBy: 'system_bootstrap',
  },
];

export const SEED_MEMBERSHIPS = [
  {
    id: 'mem-bmc-admin-01',
    tenantId: 'tenant-bmc',
    userId: 'default_admin',
    userEmail: 'admin@bmc.gov.in',
    userName: 'Rajesh Patil',
    role: TENANT_ROLES.ADMIN,
    status: 'active',
    jurisdictionScope: { wards: ['Ward A', 'Ward G-North', 'Ward K-West'], zones: ['Zone 1', 'Zone 2'] },
    assignedBy: 'system_bootstrap',
    assignedAt: '2026-01-10T00:00:00.000Z',
    schemaVersion: SCHEMA_VERSION,
  },
  {
    id: 'mem-bmc-op-02',
    tenantId: 'tenant-bmc',
    userId: 'bmc_operator_1',
    userEmail: 'operator1@bmc.gov.in',
    userName: 'Suresh Deshmukh',
    role: TENANT_ROLES.OPERATOR,
    status: 'active',
    jurisdictionScope: { wards: ['Ward A'], zones: ['Zone 1'] },
    assignedBy: 'default_admin',
    assignedAt: '2026-01-11T00:00:00.000Z',
    schemaVersion: SCHEMA_VERSION,
  },
  {
    id: 'mem-bbmp-op-03',
    tenantId: 'tenant-bbmp',
    userId: 'default_admin',
    userEmail: 'admin@bmc.gov.in', // Same user, different role & authority!
    userName: 'Rajesh Patil',
    role: TENANT_ROLES.OPERATOR,
    status: 'active',
    jurisdictionScope: { wards: ['Ward 150 - Bellandur'], zones: ['Mahadevapura'] },
    assignedBy: 'system_bootstrap',
    assignedAt: '2026-01-12T00:00:00.000Z',
    schemaVersion: SCHEMA_VERSION,
  },
  {
    id: 'mem-pmc-admin-04',
    tenantId: 'tenant-pmc',
    userId: 'pmc_commissioner',
    userEmail: 'commissioner@punecorporation.org',
    userName: 'Vikram Joshi',
    role: TENANT_ROLES.ADMIN,
    status: 'active',
    jurisdictionScope: { wards: ['Ward 5 - Kothrud'], zones: ['Zone 3'] },
    assignedBy: 'system_bootstrap',
    assignedAt: '2026-01-15T00:00:00.000Z',
    schemaVersion: SCHEMA_VERSION,
  },
];

export const SEED_SETTINGS = [
  {
    id: 'set-bmc',
    tenantId: 'tenant-bmc',
    boundaryWards: ['Ward A', 'Ward B', 'Ward G-North', 'Ward K-West'],
    statutorySlaOverrides: { water_leakage: 3, road_pothole: 7, tree_pruning: 5, birth_cert: 15 },
    publicationApprovalsRequired: true,
    contactHelpline: '1916 (BMC Civic Disaster Cell)',
    emergencyNotice: 'Monsoon preparedness drain audit underway across South Mumbai Wards.',
    retentionDays: 365,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'set-bbmp',
    tenantId: 'tenant-bbmp',
    boundaryWards: ['Ward 150 - Bellandur', 'Ward 151 - Koramangala', 'Ward 174 - HSR Layout'],
    statutorySlaOverrides: { water_leakage: 2, road_pothole: 5, tree_pruning: 4, birth_cert: 14 },
    publicationApprovalsRequired: false,
    contactHelpline: '1533 (BBMP Control Room)',
    emergencyNotice: null,
    retentionDays: 180,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'set-pmc',
    tenantId: 'tenant-pmc',
    boundaryWards: ['Ward 5 - Kothrud', 'Ward 12 - Shivajinagar', 'Ward 24 - Hadapsar'],
    statutorySlaOverrides: { water_leakage: 4, road_pothole: 8, tree_pruning: 7, birth_cert: 21 },
    publicationApprovalsRequired: true,
    contactHelpline: '1800-1030-222 (PMC Citizen Care)',
    emergencyNotice: null,
    retentionDays: 365,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: '2026-01-15T00:00:00.000Z',
  },
];

export const SEED_DATASETS = [
  {
    id: 'ds-bmc-01',
    tenantId: 'tenant-bmc',
    title: 'Ward G-North Main Conduit Leakage Rectification',
    category: 'water_services',
    wardCode: 'Ward G-North',
    priority: 'urgent',
    status: 'in_progress',
    assignedOfficer: 'Er. A. Kadam',
    slaTargetDate: '2026-11-20T18:00:00.000Z',
    privateNotes: 'Requires coordination with Western Railway engineering team for culvert access.',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-12T14:30:00.000Z',
  },
  {
    id: 'ds-bmc-02',
    tenantId: 'tenant-bmc',
    title: 'Marine Drive Heritage Walkway Paver Block Restoration',
    category: 'infrastructure',
    wardCode: 'Ward A',
    priority: 'routine',
    status: 'assigned',
    assignedOfficer: 'Er. V. Nair',
    slaTargetDate: '2026-11-25T18:00:00.000Z',
    privateNotes: 'Check heritage committee clearance guidelines before asphalt leveling.',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-11-11T11:00:00.000Z',
    updatedAt: '2026-11-11T11:00:00.000Z',
  },
  {
    id: 'ds-bbmp-01',
    tenantId: 'tenant-bbmp',
    title: 'Bellandur Lake Wetland Silt Gate Replacement',
    category: 'lake_conservation',
    wardCode: 'Ward 150 - Bellandur',
    priority: 'emergency',
    status: 'new',
    assignedOfficer: 'Er. S. Murthy',
    slaTargetDate: '2026-11-18T18:00:00.000Z',
    privateNotes: 'Inflow level elevated; bypass gate 3 until pump 2 is operational.',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-11-14T09:00:00.000Z',
    updatedAt: '2026-11-14T09:00:00.000Z',
  },
  {
    id: 'ds-pmc-01',
    tenantId: 'tenant-pmc',
    title: 'Kothrud DP Road Footpath Clearance & Tree Trimming',
    category: 'tree_pruning',
    wardCode: 'Ward 5 - Kothrud',
    priority: 'routine',
    status: 'resolved',
    assignedOfficer: 'M. Shinde',
    slaTargetDate: '2026-11-12T18:00:00.000Z',
    privateNotes: 'Overhead MSEB transmission line clearance completed safely.',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-11-05T08:00:00.000Z',
    updatedAt: '2026-11-12T16:00:00.000Z',
  },
];

export const SEED_SHARED_CATALOGUE = [
  {
    id: 'cat-pub-01',
    originTenantId: 'tenant-bmc',
    originRecordId: 'ds-bmc-02',
    title: 'Heritage Zone Public Pavement Repair Statutory Checklist',
    category: 'infrastructure',
    summary: 'Standardized municipal guidelines for restorative works within designated heritage precincts.',
    jurisdictionLevel: 'state',
    publicationStatus: 'published',
    publicData: {
      standardSlaDays: 14,
      requiredClearances: ['Heritage Conservation Committee', 'Traffic Police NOC'],
      citizenRemedyNotice: 'File Form 4A with Ward Assistant Engineer if works exceed statutory window.',
    },
    redactionManifest: {
      redactedFields: ['privateNotes', 'assignedOfficer'],
      sanitizedAt: '2026-11-12T10:00:00.000Z',
    },
    approvedBy: 'default_admin',
    approvedAt: '2026-11-12T10:00:00.000Z',
    publishedAt: '2026-11-12T10:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// In-Memory & Storage Helpers
// ---------------------------------------------------------------------------
const memoryStore = new Map();

const getLocalStorage = () => {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const getStorage = (key, fallback = []) => {
  const storage = getLocalStorage();
  if (!storage) {
    if (!memoryStore.has(key)) {
      memoryStore.set(key, JSON.stringify(fallback));
      return fallback;
    }
    try {
      return JSON.parse(memoryStore.get(key));
    } catch {
      return fallback;
    }
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      storage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch (err) {
    logDiagnostic(`Error reading ${key} from storage:`, err);
    return fallback;
  }
};

const setStorage = (key, data) => {
  const storage = getLocalStorage();
  const serialized = JSON.stringify(data);
  if (!storage) {
    memoryStore.set(key, serialized);
    return;
  }
  try {
    storage.setItem(key, serialized);
  } catch (err) {
    logDiagnostic(`Error writing ${key} to storage:`, err);
  }
};

export const getRawStorage = (key, fallback = []) => getStorage(key, fallback);
export const setRawStorage = (key, data) => setStorage(key, data);

export const initializeTenantStorage = (forceReset = false) => {
  const storage = getLocalStorage();
  if (forceReset) {
    memoryStore.clear();
  }
  if (forceReset || (storage && !storage.getItem(STORAGE_KEYS.TENANTS))) {
    setStorage(STORAGE_KEYS.TENANTS, SEED_TENANTS);
    setStorage(STORAGE_KEYS.MEMBERSHIPS, SEED_MEMBERSHIPS);
    setStorage(STORAGE_KEYS.SETTINGS, SEED_SETTINGS);
    setStorage(STORAGE_KEYS.DATASETS, SEED_DATASETS);
    setStorage(STORAGE_KEYS.SHARED_CATALOGUE, SEED_SHARED_CATALOGUE);
    
    // Initialize Genesis Audit Log
    const genesisEvent = createGenesisAuditEvent('tenant-bmc');
    setStorage(STORAGE_KEYS.AUDIT_EVENTS, [genesisEvent]);
  }
};

// ---------------------------------------------------------------------------
// Security & Context Guards (Anti-IDOR & Permission Assertions)
// ---------------------------------------------------------------------------
export const resolveActorMembership = (actor, tenantId) => {
  if (!actor || !actor.id) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.UNAUTHENTICATED,
      'Authentication required to access authority workspaces.'
    );
  }

  const memberships = getStorage(STORAGE_KEYS.MEMBERSHIPS, SEED_MEMBERSHIPS);
  const match = memberships.find(
    (m) => m.userId === actor.id && m.tenantId === tenantId && m.status === 'active'
  );

  return match || null;
};

export const assertTenantScope = (actor, tenantId, requiredPermission = null) => {
  if (!tenantId) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.VALIDATION_FAILED,
      'Tenant identifier must be explicitly supplied for all authority operations.'
    );
  }

  // Ensure tenant exists
  const tenants = getStorage(STORAGE_KEYS.TENANTS, SEED_TENANTS);
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.TENANT_NOT_FOUND,
      `Authority workspace '${tenantId}' does not exist.`
    );
  }

  if (tenant.status === 'suspended') {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.FORBIDDEN_TENANT_ACCESS,
      `Authority workspace '${tenant.name}' is temporarily suspended.`
    );
  }

  // Verify membership
  const membership = resolveActorMembership(actor, tenantId);
  if (!membership) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.FORBIDDEN_TENANT_ACCESS,
      `Access denied: Actor '${actor.id}' is not an authorized member of authority '${tenant.name}'.`
    );
  }

  // Verify permission
  if (requiredPermission) {
    const granted = ROLE_PERMISSIONS[membership.role] || [];
    if (!granted.includes(requiredPermission)) {
      throw new TenantIsolationError(
        TENANT_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `Role '${membership.role}' lacks required permission '${requiredPermission}' in authority '${tenant.name}'.`
      );
    }
  }

  return { tenant, membership };
};

// ---------------------------------------------------------------------------
// Tamper-Evident SHA-256 Audit Trail Implementation
// ---------------------------------------------------------------------------
const createGenesisAuditEvent = (tenantId) => {
  const timestamp = '2026-01-10T00:00:00.000Z';
  const payloadToHash = `${tenantId}|system_bootstrap|GENESIS|system|${timestamp}|${GENESIS_AUDIT_HASH}`;
  const entryHash = sha256Hex(payloadToHash);

  return {
    id: `audit-${tenantId}-genesis`,
    tenantId,
    actorId: 'system_bootstrap',
    actorRole: 'system',
    action: 'GENESIS',
    targetResource: 'tenant_workspace',
    targetId: tenantId,
    details: { message: 'Authority workspace genesis initialized' },
    reason: 'Initial bootstrapping',
    previousHash: GENESIS_AUDIT_HASH,
    entryHash,
    timestamp,
  };
};

export const logTenantAuditEvent = (actor, tenantId, event) => {
  const allEvents = getStorage(STORAGE_KEYS.AUDIT_EVENTS, []);
  
  // Filter for this tenant to locate previous entry
  const tenantEvents = allEvents.filter((e) => e.tenantId === tenantId);
  const lastEntry = tenantEvents[tenantEvents.length - 1];
  const previousHash = lastEntry ? lastEntry.entryHash : GENESIS_AUDIT_HASH;

  const timestamp = new Date().toISOString();
  const id = `audit-${tenantId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const actorId = actor?.id || 'system';
  const actorRole = event.actorRole || 'system';
  const action = event.action;
  const targetResource = event.targetResource || 'dataset';
  const targetId = event.targetId || 'unknown';
  const details = event.details || {};
  const reason = event.reason || 'Operational administrative update';

  const stringifiedDetails = JSON.stringify(details);
  const hashSeed = `${tenantId}|${actorId}|${action}|${targetId}|${timestamp}|${previousHash}|${stringifiedDetails}`;
  const entryHash = sha256Hex(hashSeed);

  const newEntry = {
    id,
    tenantId,
    actorId,
    actorRole,
    action,
    targetResource,
    targetId,
    details,
    reason,
    previousHash,
    entryHash,
    timestamp,
  };

  allEvents.push(newEntry);
  setStorage(STORAGE_KEYS.AUDIT_EVENTS, allEvents);
  return newEntry;
};

export const getTenantAuditTrail = (actor, tenantId) => {
  assertTenantScope(actor, tenantId, 'audit:read');
  const allEvents = getStorage(STORAGE_KEYS.AUDIT_EVENTS, []);
  return allEvents.filter((e) => e.tenantId === tenantId).reverse();
};

export const verifyAuditChainIntegrity = (tenantId) => {
  const allEvents = getStorage(STORAGE_KEYS.AUDIT_EVENTS, []);
  const chain = allEvents.filter((e) => e.tenantId === tenantId);

  if (chain.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  for (let i = 0; i < chain.length; i += 1) {
    const entry = chain[i];
    const expectedPrev = i === 0 ? GENESIS_AUDIT_HASH : chain[i - 1].entryHash;

    if (entry.previousHash !== expectedPrev) {
      return {
        valid: false,
        totalEntries: chain.length,
        tamperedIndex: i,
        tamperedId: entry.id,
        reason: 'Broken previousHash reference',
      };
    }

    // Recompute current entry hash
    let recomputed;
    if (entry.action === 'GENESIS') {
      recomputed = sha256Hex(
        `${tenantId}|${entry.actorId}|GENESIS|system|${entry.timestamp}|${GENESIS_AUDIT_HASH}`
      );
    } else {
      const stringifiedDetails = JSON.stringify(entry.details || {});
      const hashSeed = `${tenantId}|${entry.actorId}|${entry.action}|${entry.targetId}|${entry.timestamp}|${entry.previousHash}|${stringifiedDetails}`;
      recomputed = sha256Hex(hashSeed);
    }

    if (entry.entryHash !== recomputed) {
      return {
        valid: false,
        totalEntries: chain.length,
        tamperedIndex: i,
        tamperedId: entry.id,
        reason: 'Tampered entryHash signature',
      };
    }
  }

  return { valid: true, totalEntries: chain.length, tamperedIndex: null };
};

// ---------------------------------------------------------------------------
// Tenant Workspaces & Context Management
// ---------------------------------------------------------------------------
export const listAccessibleTenants = (actor) => {
  if (!actor || !actor.id) return [];
  const tenants = getStorage(STORAGE_KEYS.TENANTS, SEED_TENANTS);
  const memberships = getStorage(STORAGE_KEYS.MEMBERSHIPS, SEED_MEMBERSHIPS);

  const userMemberships = memberships.filter(
    (m) => m.userId === actor.id && m.status === 'active'
  );

  return tenants
    .filter((t) => userMemberships.some((m) => m.tenantId === t.id))
    .map((t) => {
      const membership = userMemberships.find((m) => m.tenantId === t.id);
      return {
        ...t,
        activeRole: membership.role,
        jurisdictionScope: membership.jurisdictionScope,
      };
    });
};

export const getTenantDetails = (actor, tenantId) => {
  const { tenant, membership } = assertTenantScope(actor, tenantId, 'tenant:read');
  return {
    ...tenant,
    activeRole: membership.role,
    jurisdictionScope: membership.jurisdictionScope,
  };
};

export const getActiveTenantContext = () => {
  const storage = getLocalStorage();
  if (!storage) return memoryStore.get(STORAGE_KEYS.ACTIVE_CONTEXT) || 'tenant-bmc';
  return storage.getItem(STORAGE_KEYS.ACTIVE_CONTEXT) || 'tenant-bmc';
};

export const setActiveTenantContext = (tenantId) => {
  const storage = getLocalStorage();
  if (!storage) {
    memoryStore.set(STORAGE_KEYS.ACTIVE_CONTEXT, tenantId);
    return;
  }
  storage.setItem(STORAGE_KEYS.ACTIVE_CONTEXT, tenantId);
};

// ---------------------------------------------------------------------------
// Staff & Access Control (Memberships)
// ---------------------------------------------------------------------------
export const listTenantMembers = (actor, tenantId) => {
  assertTenantScope(actor, tenantId, 'staff:read');
  const memberships = getStorage(STORAGE_KEYS.MEMBERSHIPS, SEED_MEMBERSHIPS);
  return memberships.filter((m) => m.tenantId === tenantId);
};

export const addTenantMember = (actor, tenantId, memberData) => {
  assertTenantScope(actor, tenantId, 'staff:manage');

  if (!memberData.userEmail || !memberData.userName || !memberData.role) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.VALIDATION_FAILED,
      'Staff email, full name, and role are required.'
    );
  }

  const allowedRoles = Object.values(TENANT_ROLES);
  if (!allowedRoles.includes(memberData.role)) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.VALIDATION_FAILED,
      `Invalid role '${memberData.role}'. Must be one of: ${allowedRoles.join(', ')}`
    );
  }

  const memberships = getStorage(STORAGE_KEYS.MEMBERSHIPS, SEED_MEMBERSHIPS);
  const existing = memberships.find(
    (m) => m.tenantId === tenantId && m.userEmail.toLowerCase() === memberData.userEmail.toLowerCase()
  );

  if (existing && existing.status === 'active') {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.VALIDATION_FAILED,
      `Staff member '${memberData.userEmail}' already has an active assignment in this authority.`
    );
  }

  const newMember = {
    id: `mem-${tenantId}-${Date.now()}`,
    tenantId,
    userId: memberData.userId || `user-${Date.now()}`,
    userEmail: memberData.userEmail.toLowerCase().trim(),
    userName: memberData.userName.trim(),
    role: memberData.role,
    status: 'active',
    jurisdictionScope: memberData.jurisdictionScope || { wards: [], zones: [] },
    assignedBy: actor.id,
    assignedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };

  memberships.push(newMember);
  setStorage(STORAGE_KEYS.MEMBERSHIPS, memberships);

  logTenantAuditEvent(actor, tenantId, {
    action: 'STAFF_MEMBER_ADDED',
    actorRole: 'tenant_admin',
    targetResource: 'tenant_membership',
    targetId: newMember.id,
    details: { userEmail: newMember.userEmail, role: newMember.role },
    reason: memberData.reason || 'Staff onboarding to municipal authority workspace',
  });

  return newMember;
};

export const updateMemberRole = (actor, tenantId, memberId, newRole, reason) => {
  assertTenantScope(actor, tenantId, 'staff:manage');

  const allowedRoles = Object.values(TENANT_ROLES);
  if (!allowedRoles.includes(newRole)) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.VALIDATION_FAILED,
      `Invalid target role '${newRole}'.`
    );
  }

  const memberships = getStorage(STORAGE_KEYS.MEMBERSHIPS, SEED_MEMBERSHIPS);
  const index = memberships.findIndex((m) => m.id === memberId && m.tenantId === tenantId);

  if (index === -1) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.RECORD_NOT_FOUND,
      'Staff membership record not found in this authority.'
    );
  }

  const prevRole = memberships[index].role;
  memberships[index].role = newRole;
  memberships[index].updatedAt = new Date().toISOString();
  setStorage(STORAGE_KEYS.MEMBERSHIPS, memberships);

  logTenantAuditEvent(actor, tenantId, {
    action: 'STAFF_ROLE_MODIFIED',
    actorRole: 'tenant_admin',
    targetResource: 'tenant_membership',
    targetId: memberId,
    details: { memberId, prevRole, newRole },
    reason: reason || 'Reassignment of authority duties',
  });

  return memberships[index];
};

export const revokeTenantMember = (actor, tenantId, memberId, reason) => {
  assertTenantScope(actor, tenantId, 'staff:manage');

  const memberships = getStorage(STORAGE_KEYS.MEMBERSHIPS, SEED_MEMBERSHIPS);
  const index = memberships.findIndex((m) => m.id === memberId && m.tenantId === tenantId);

  if (index === -1) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.RECORD_NOT_FOUND,
      'Staff membership record not found in this authority.'
    );
  }

  memberships[index].status = 'revoked';
  memberships[index].revokedAt = new Date().toISOString();
  setStorage(STORAGE_KEYS.MEMBERSHIPS, memberships);

  logTenantAuditEvent(actor, tenantId, {
    action: 'STAFF_MEMBERSHIP_REVOKED',
    actorRole: 'tenant_admin',
    targetResource: 'tenant_membership',
    targetId: memberId,
    details: { memberId, userEmail: memberships[index].userEmail },
    reason: reason || 'Staff departure or reassignment',
  });

  return true;
};

// ---------------------------------------------------------------------------
// Tenant Settings
// ---------------------------------------------------------------------------
export const getTenantSettings = (actor, tenantId) => {
  assertTenantScope(actor, tenantId, 'settings:read');
  const settingsList = getStorage(STORAGE_KEYS.SETTINGS, SEED_SETTINGS);
  const settings = settingsList.find((s) => s.tenantId === tenantId);

  if (!settings) {
    const fallback = {
      id: `set-${tenantId}`,
      tenantId,
      boundaryWards: [],
      statutorySlaOverrides: {},
      publicationApprovalsRequired: true,
      contactHelpline: '1800-000-000',
      emergencyNotice: null,
      retentionDays: 180,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    };
    return fallback;
  }
  return settings;
};

export const updateTenantSettings = (actor, tenantId, updates, reason) => {
  assertTenantScope(actor, tenantId, 'settings:manage');

  const settingsList = getStorage(STORAGE_KEYS.SETTINGS, SEED_SETTINGS);
  let index = settingsList.findIndex((s) => s.tenantId === tenantId);

  if (index === -1) {
    settingsList.push({
      id: `set-${tenantId}`,
      tenantId,
      boundaryWards: [],
      statutorySlaOverrides: {},
      publicationApprovalsRequired: true,
      contactHelpline: '1800-000-000',
      emergencyNotice: null,
      retentionDays: 180,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    });
    index = settingsList.length - 1;
  }

  const prevSettings = { ...settingsList[index] };
  settingsList[index] = {
    ...settingsList[index],
    ...updates,
    tenantId, // Prevent modifying tenant ownership
    updatedAt: new Date().toISOString(),
  };

  setStorage(STORAGE_KEYS.SETTINGS, settingsList);

  logTenantAuditEvent(actor, tenantId, {
    action: 'TENANT_SETTINGS_UPDATED',
    actorRole: 'tenant_admin',
    targetResource: 'tenant_settings',
    targetId: settingsList[index].id,
    details: { changedKeys: Object.keys(updates), previous: prevSettings },
    reason: reason || 'Configuration baseline adjustment',
  });

  return settingsList[index];
};

// ---------------------------------------------------------------------------
// Authority Datasets (Isolated Operational Records)
// ---------------------------------------------------------------------------
export const listTenantDataset = (actor, tenantId, filters = {}) => {
  assertTenantScope(actor, tenantId, 'dataset:read');
  const allDatasets = getStorage(STORAGE_KEYS.DATASETS, SEED_DATASETS);
  
  // STRICT TENANT BOUNDARY: Only return records matching tenantId
  let records = allDatasets.filter((d) => d.tenantId === tenantId);

  if (filters.category && filters.category !== 'all') {
    records = records.filter((r) => r.category === filters.category);
  }
  if (filters.status && filters.status !== 'all') {
    records = records.filter((r) => r.status === filters.status);
  }
  if (filters.ward && filters.ward !== 'all') {
    records = records.filter((r) => r.wardCode === filters.ward);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    records = records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.wardCode.toLowerCase().includes(q)
    );
  }

  const total = records.length;
  let paginatedRecords = records;
  if (filters.page || filters.limit) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const start = (page - 1) * limit;
    paginatedRecords = records.slice(start, start + limit);
    paginatedRecords.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: start + limit < total,
    };
  } else {
    paginatedRecords.pagination = {
      page: 1,
      limit: total,
      total,
      totalPages: 1,
      hasMore: false,
    };
  }

  return paginatedRecords;
};

export const getTenantDatasetIndex = (actor, tenantId) => {
  const records = listTenantDataset(actor, tenantId);
  const byCategory = {};
  const byStatus = {};
  const byWard = {};

  records.forEach((r) => {
    byCategory[r.category] = (byCategory[r.category] || []).concat(r.id);
    byStatus[r.status] = (byStatus[r.status] || []).concat(r.id);
    byWard[r.wardCode] = (byWard[r.wardCode] || []).concat(r.id);
  });

  return { byCategory, byStatus, byWard, total: records.length };
};

export const executeTenantTransaction = (actor, tenantId, transactionFn) => {
  assertTenantScope(actor, tenantId, 'dataset:write');
  const snapshot = {
    datasets: getStorage(STORAGE_KEYS.DATASETS),
    settings: getStorage(STORAGE_KEYS.SETTINGS),
    memberships: getStorage(STORAGE_KEYS.MEMBERSHIPS),
  };

  try {
    const result = transactionFn();
    return result;
  } catch (err) {
    // Atomic rollback
    setStorage(STORAGE_KEYS.DATASETS, snapshot.datasets);
    setStorage(STORAGE_KEYS.SETTINGS, snapshot.settings);
    setStorage(STORAGE_KEYS.MEMBERSHIPS, snapshot.memberships);
    throw err;
  }
};

export const getTenantDatasetRecord = (actor, tenantId, recordId) => {
  assertTenantScope(actor, tenantId, 'dataset:read');
  const allDatasets = getStorage(STORAGE_KEYS.DATASETS, SEED_DATASETS);

  // ANTI-IDOR GUARANTEE: Must match BOTH tenantId AND recordId
  const record = allDatasets.find((d) => d.id === recordId && d.tenantId === tenantId);

  if (!record) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.RECORD_NOT_FOUND,
      `Operational record '${recordId}' does not exist in authority '${tenantId}'.`
    );
  }

  return record;
};

export const createTenantDatasetRecord = (actor, tenantId, recordData) => {
  assertTenantScope(actor, tenantId, 'dataset:write');

  if (!recordData.title || !recordData.category || !recordData.wardCode) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.VALIDATION_FAILED,
      'Title, category, and wardCode are required for authority records.'
    );
  }

  const allDatasets = getStorage(STORAGE_KEYS.DATASETS, SEED_DATASETS);

  // Idempotency: if idempotencyKey supplied, return existing match to prevent double-writes
  if (recordData.idempotencyKey) {
    const existing = allDatasets.find(
      (d) => d.tenantId === tenantId && d.idempotencyKey === recordData.idempotencyKey
    );
    if (existing) {
      return existing;
    }
  }

  const newRecord = {
    id: `ds-${tenantId}-${Date.now()}`,
    tenantId, // Strict binding
    idempotencyKey: recordData.idempotencyKey || null,
    title: recordData.title.trim(),
    category: recordData.category.trim(),
    wardCode: recordData.wardCode.trim(),
    priority: recordData.priority || 'routine',
    status: recordData.status || 'new',
    assignedOfficer: recordData.assignedOfficer ? recordData.assignedOfficer.trim() : 'Unassigned',
    slaTargetDate: recordData.slaTargetDate || new Date(Date.now() + 7 * 86400000).toISOString(),
    privateNotes: recordData.privateNotes ? recordData.privateNotes.trim() : '',
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  allDatasets.push(newRecord);
  setStorage(STORAGE_KEYS.DATASETS, allDatasets);

  logTenantAuditEvent(actor, tenantId, {
    action: 'DATASET_RECORD_CREATED',
    actorRole: 'tenant_operator',
    targetResource: 'tenant_dataset',
    targetId: newRecord.id,
    details: { title: newRecord.title, category: newRecord.category, ward: newRecord.wardCode },
    reason: 'New civic operational record registration',
  });

  return newRecord;
};

export const updateTenantDatasetRecord = (actor, tenantId, recordId, updates) => {
  assertTenantScope(actor, tenantId, 'dataset:write');
  const allDatasets = getStorage(STORAGE_KEYS.DATASETS, SEED_DATASETS);
  const index = allDatasets.findIndex((d) => d.id === recordId && d.tenantId === tenantId);

  if (index === -1) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.RECORD_NOT_FOUND,
      `Operational record '${recordId}' does not exist in authority '${tenantId}'.`
    );
  }

  // Prevent modifying the tenantId foreign key
  const sanitizedUpdates = { ...updates };
  delete sanitizedUpdates.tenantId;
  delete sanitizedUpdates.id;

  allDatasets[index] = {
    ...allDatasets[index],
    ...sanitizedUpdates,
    updatedAt: new Date().toISOString(),
  };

  setStorage(STORAGE_KEYS.DATASETS, allDatasets);

  logTenantAuditEvent(actor, tenantId, {
    action: 'DATASET_RECORD_UPDATED',
    actorRole: 'tenant_operator',
    targetResource: 'tenant_dataset',
    targetId: recordId,
    details: { updatedFields: Object.keys(sanitizedUpdates) },
    reason: 'Operational dataset progress update',
  });

  return allDatasets[index];
};

export const deleteTenantDatasetRecord = (actor, tenantId, recordId, reason) => {
  assertTenantScope(actor, tenantId, 'dataset:delete');
  const allDatasets = getStorage(STORAGE_KEYS.DATASETS, SEED_DATASETS);
  const index = allDatasets.findIndex((d) => d.id === recordId && d.tenantId === tenantId);

  if (index === -1) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.RECORD_NOT_FOUND,
      `Operational record '${recordId}' does not exist in authority '${tenantId}'.`
    );
  }

  const removed = allDatasets.splice(index, 1)[0];
  setStorage(STORAGE_KEYS.DATASETS, allDatasets);

  logTenantAuditEvent(actor, tenantId, {
    action: 'DATASET_RECORD_DELETED',
    actorRole: 'tenant_admin',
    targetResource: 'tenant_dataset',
    targetId: recordId,
    details: { title: removed.title },
    reason: reason || 'Administrative record deletion',
  });

  return true;
};

// ---------------------------------------------------------------------------
// Cross-Tenant Public Catalogue Publication Pipeline
// (With Strict PII & Private Notes Redaction)
// ---------------------------------------------------------------------------
const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;

export const sanitizePayloadForPublicCatalogue = (sourceRecord) => {
  const textBlob = `${sourceRecord.title} ${sourceRecord.privateNotes || ''}`;
  if (AADHAAR_REGEX.test(textBlob) || PAN_REGEX.test(textBlob) || PHONE_REGEX.test(textBlob)) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.PII_DETECTED,
      'Source record contains sensitive citizen or staff PII (Aadhaar, PAN, or personal phone number). Redaction failed.'
    );
  }

  // Explicit field allowlist for public consumption
  const publicData = {
    title: sourceRecord.title,
    category: sourceRecord.category,
    wardCode: sourceRecord.wardCode,
    standardSlaDays: sourceRecord.priority === 'urgent' ? 3 : 7,
    proceduralGuidance: `Standard municipal procedure for ${sourceRecord.title} under public citizen charter.`,
    citizenRemedyNotice: 'If unresolved within prescribed SLA, file statutory appeal with Municipal Appellate Officer.',
  };

  const redactedManifest = {
    redactedFields: ['privateNotes', 'assignedOfficer', 'slaTargetDate'],
    sanitizedAt: new Date().toISOString(),
    sanitizationEngine: 'CivicHelpSetu-RedactionPipeline-v1.0',
  };

  return { publicData, redactedManifest };
};

export const submitRecordForPublication = (actor, tenantId, recordId) => {
  assertTenantScope(actor, tenantId, 'catalogue:submit');
  const record = getTenantDatasetRecord(actor, tenantId, recordId);
  const catalogueList = getStorage(STORAGE_KEYS.SHARED_CATALOGUE, SEED_SHARED_CATALOGUE);

  // Check if already published or submitted
  const existing = catalogueList.find(
    (c) => c.originTenantId === tenantId && c.originRecordId === recordId
  );
  if (existing && existing.publicationStatus !== 'retracted') {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.INVALID_TRANSITION,
      `Record '${recordId}' is already in catalogue with status '${existing.publicationStatus}'.`
    );
  }

  const { publicData, redactedManifest } = sanitizePayloadForPublicCatalogue(record);

  const publicationEntry = {
    id: `cat-${tenantId}-${Date.now()}`,
    originTenantId: tenantId,
    originRecordId: recordId,
    title: record.title,
    category: record.category,
    summary: `Public procedural guide published from authority '${tenantId}'.`,
    jurisdictionLevel: 'state',
    publicationStatus: 'pending_approval',
    publicData,
    redactionManifest: redactedManifest,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
  };

  catalogueList.push(publicationEntry);
  setStorage(STORAGE_KEYS.SHARED_CATALOGUE, catalogueList);

  logTenantAuditEvent(actor, tenantId, {
    action: 'CATALOGUE_RECORD_SUBMITTED',
    actorRole: 'tenant_operator',
    targetResource: 'shared_catalogue',
    targetId: publicationEntry.id,
    details: { catalogueId: publicationEntry.id, originRecordId: recordId },
    reason: 'Submission of internal procedure to public cross-tenant catalogue',
  });

  return publicationEntry;
};

export const approveRecordPublication = (actor, tenantId, catalogueId) => {
  assertTenantScope(actor, tenantId, 'catalogue:approve');
  const catalogueList = getStorage(STORAGE_KEYS.SHARED_CATALOGUE, SEED_SHARED_CATALOGUE);
  const index = catalogueList.findIndex(
    (c) => c.id === catalogueId && c.originTenantId === tenantId
  );

  if (index === -1) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.RECORD_NOT_FOUND,
      `Catalogue entry '${catalogueId}' does not belong to authority '${tenantId}'.`
    );
  }

  if (catalogueList[index].publicationStatus !== 'pending_approval') {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.INVALID_TRANSITION,
      `Only records in 'pending_approval' can be approved (current: '${catalogueList[index].publicationStatus}').`
    );
  }

  catalogueList[index].publicationStatus = 'published';
  catalogueList[index].approvedBy = actor.id;
  catalogueList[index].approvedAt = new Date().toISOString();
  catalogueList[index].publishedAt = new Date().toISOString();

  setStorage(STORAGE_KEYS.SHARED_CATALOGUE, catalogueList);

  logTenantAuditEvent(actor, tenantId, {
    action: 'CATALOGUE_RECORD_PUBLISHED',
    actorRole: 'tenant_reviewer',
    targetResource: 'shared_catalogue',
    targetId: catalogueId,
    details: { catalogueId, approvedBy: actor.id },
    reason: 'Public disclosure sign-off under municipal open-catalogue mandate',
  });

  return catalogueList[index];
};

export const retractRecordPublication = (actor, tenantId, catalogueId, reason) => {
  assertTenantScope(actor, tenantId, 'catalogue:retract');
  const catalogueList = getStorage(STORAGE_KEYS.SHARED_CATALOGUE, SEED_SHARED_CATALOGUE);
  const index = catalogueList.findIndex(
    (c) => c.id === catalogueId && c.originTenantId === tenantId
  );

  if (index === -1) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.RECORD_NOT_FOUND,
      `Catalogue entry '${catalogueId}' does not belong to authority '${tenantId}'.`
    );
  }

  catalogueList[index].publicationStatus = 'retracted';
  catalogueList[index].retractedBy = actor.id;
  catalogueList[index].retractedAt = new Date().toISOString();
  catalogueList[index].retractionReason = reason || 'Procedural obsolescence or revision';

  setStorage(STORAGE_KEYS.SHARED_CATALOGUE, catalogueList);

  logTenantAuditEvent(actor, tenantId, {
    action: 'CATALOGUE_RECORD_RETRACTED',
    actorRole: 'tenant_reviewer',
    targetResource: 'shared_catalogue',
    targetId: catalogueId,
    details: { catalogueId, reason },
    reason: reason || 'Retracted from public view',
  });

  return catalogueList[index];
};

export const listSharedPublicCatalogue = (filters = {}) => {
  const catalogueList = getStorage(STORAGE_KEYS.SHARED_CATALOGUE, SEED_SHARED_CATALOGUE);
  // Public view: ONLY records with status 'published'
  let published = catalogueList.filter((c) => c.publicationStatus === 'published');

  if (filters.category && filters.category !== 'all') {
    published = published.filter((c) => c.category === filters.category);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    published = published.filter(
      (c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }

  return published;
};

// ---------------------------------------------------------------------------
// Bounded Explainable AI & Local Heuristics
// ---------------------------------------------------------------------------
export const evaluateTenantRecommendations = (actor, tenantId) => {
  assertTenantScope(actor, tenantId, 'recommendations:view');
  const records = listTenantDataset(actor, tenantId);
  const settings = getTenantSettings(actor, tenantId);

  const recommendations = [];
  const now = Date.now();

  records.forEach((record) => {
    // 1. SLA Breach Alert Heuristic (incorporates authority SLA setting)
    const statutoryCap = settings.statutorySlaOverrides?.[record.category] || 7;
    if (record.status !== 'resolved' && record.status !== 'archived') {
      const targetTime = new Date(record.slaTargetDate).getTime();
      const hoursRemaining = (targetTime - now) / (1000 * 3600);

      if (hoursRemaining < 72) {
        recommendations.push({
          id: `rec-sla-${record.id}`,
          tenantId,
          recommendationType: 'SLA_BREACH_RISK',
          targetEntityId: record.id,
          targetTitle: record.title,
          confidenceScore: hoursRemaining < 24 ? 0.95 : 0.82,
          rulesetVersion: 'civic-sla-heuristics-v1.2',
          featureWindow: {
            start: record.createdAt,
            end: new Date().toISOString(),
            recordCountAnalyzed: 1,
          },
          executionTimestamp: new Date().toISOString(),
          reasoning: {
            explanationSummary: `Record '${record.title}' in ${record.wardCode} is within ${Math.max(0, Math.round(hoursRemaining))} hours of statutory SLA deadline (${statutoryCap} days statutory cap).`,
            influencingFactors: [
              { field: 'slaTargetDate', value: record.slaTargetDate, weight: 0.50 },
              { field: 'statutorySlaDays', value: statutoryCap, weight: 0.25 },
              { field: 'priority', value: record.priority, weight: 0.15 },
              { field: 'status', value: record.status, weight: 0.10 },
            ],
          },
          suggestedAction: {
            actionKey: 'ESCALATE_PRIORITY',
            label: 'Escalate to Urgent Priority & Reassign',
            payload: { priority: 'urgent' },
          },
          status: 'pending_review',
        });
      }
    }

    // 2. High-Impact Public Sharing Candidate Heuristic
    if (record.status === 'resolved' && record.category === 'infrastructure') {
      recommendations.push({
        id: `rec-share-${record.id}`,
        tenantId,
        recommendationType: 'CATALOGUE_STANDARDIZATION',
        targetEntityId: record.id,
        targetTitle: record.title,
        confidenceScore: 0.88,
        rulesetVersion: 'civic-catalogue-advisor-v1.0',
        featureWindow: {
          start: record.createdAt,
          end: record.updatedAt,
          recordCountAnalyzed: 1,
        },
        executionTimestamp: new Date().toISOString(),
        reasoning: {
          explanationSummary: `Resolved infrastructure task '${record.title}' meets open-catalogue criteria for cross-authority procedural standardization.`,
          influencingFactors: [
            { field: 'status', value: 'resolved', weight: 0.50 },
            { field: 'category', value: 'infrastructure', weight: 0.35 },
            { field: 'wardCode', value: record.wardCode, weight: 0.15 },
          ],
        },
        suggestedAction: {
          actionKey: 'SUBMIT_TO_CATALOGUE',
          label: 'Submit Standardized Procedural Checklist to Public Catalogue',
          payload: { recordId: record.id },
        },
        status: 'pending_review',
      });
    }
  });

  return recommendations;
};

export const resolveRecommendation = (
  actor,
  tenantId,
  recommendationId,
  decision,
  overridePayload = null,
  reason = 'Administrative recommendation review'
) => {
  assertTenantScope(actor, tenantId, 'recommendations:action');

  if (!['accepted', 'edited', 'rejected'].includes(decision)) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.VALIDATION_FAILED,
      `Decision must be 'accepted', 'edited', or 'rejected'. Received '${decision}'.`
    );
  }

  logTenantAuditEvent(actor, tenantId, {
    action: `RECOMMENDATION_${decision.toUpperCase()}`,
    actorRole: 'tenant_reviewer',
    targetResource: 'ai_recommendation',
    targetId: recommendationId,
    details: { recommendationId, decision, overridePayload },
    reason,
  });

  return true;
};

// ---------------------------------------------------------------------------
// Schema Migrations & Disaster Recovery
// ---------------------------------------------------------------------------
export const runTenantDataMigration = (actor, targetVersion) => {
  if (targetVersion !== 2) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.VALIDATION_FAILED,
      `Unsupported target migration schema version '${targetVersion}'.`
    );
  }

  // Backup existing data before applying migration
  const backup = {
    tenants: getStorage(STORAGE_KEYS.TENANTS),
    datasets: getStorage(STORAGE_KEYS.DATASETS),
    settings: getStorage(STORAGE_KEYS.SETTINGS),
    timestamp: new Date().toISOString(),
  };
  setStorage(STORAGE_KEYS.MIGRATION_BACKUP, backup);

  // Apply schema evolution: add migrationMarker to datasets and update schemaVersion
  const datasets = getStorage(STORAGE_KEYS.DATASETS);
  const upgradedDatasets = datasets.map((d) => ({
    ...d,
    schemaVersion: 2,
    migratedAt: new Date().toISOString(),
  }));
  setStorage(STORAGE_KEYS.DATASETS, upgradedDatasets);

  const tenants = getStorage(STORAGE_KEYS.TENANTS);
  const upgradedTenants = tenants.map((t) => ({
    ...t,
    schemaVersion: 2,
  }));
  setStorage(STORAGE_KEYS.TENANTS, upgradedTenants);

  return { success: true, targetVersion, recordsUpgraded: upgradedDatasets.length };
};

export const rollbackTenantDataMigration = (actor) => {
  const backup = getStorage(STORAGE_KEYS.MIGRATION_BACKUP, null);
  if (!backup) {
    throw new TenantIsolationError(
      TENANT_ERROR_CODES.RECORD_NOT_FOUND,
      'No migration backup snapshot found for rollback.'
    );
  }

  setStorage(STORAGE_KEYS.TENANTS, backup.tenants);
  setStorage(STORAGE_KEYS.DATASETS, backup.datasets);
  setStorage(STORAGE_KEYS.SETTINGS, backup.settings);
  setStorage(STORAGE_KEYS.MIGRATION_BACKUP, null);

  if (actor) {
    logTenantAuditEvent(actor, 'tenant-bmc', {
      action: 'TENANT_SCHEMA_MIGRATION_ROLLEDBACK',
      actorRole: 'tenant_admin',
      targetResource: 'tenant_schema',
      targetId: 'v1',
      details: { rolledBackTo: backup.timestamp },
      reason: 'Schema migration rollback executed',
    });
  }

  return { success: true, rolledBackToTimestamp: backup.timestamp };
};

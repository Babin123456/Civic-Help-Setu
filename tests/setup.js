// Test setup file - runs before all tests
import { vi } from 'vitest';

// Mock Firebase Admin
vi.mock('../src/_lib/firebaseAdmin.js', () => ({
  db: {},
  getFirebaseAdminApp: vi.fn().mockResolvedValue({}),
  getFirestoreAdmin: vi.fn().mockResolvedValue({}),
  resetFirebaseAdminCacheForTests: vi.fn(),
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
  getCountFromServer: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
}));

// Mock accessControl
vi.mock('../src/services/accessControl.js', () => ({
  getCurrentActor: vi.fn(() => null),
  resolveActorJurisdictions: vi.fn(() => []),
  setCurrentActor: vi.fn(),
  roleOf: vi.fn((actor) => (actor?.role === 'admin' ? 'admin' : 'citizen')),
}));

// Global test utilities
global.testUtils = {
  createMockActor: (overrides = {}) => ({
    id: 'test-user',
    role: 'operator',
    tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
    jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'],
    ...overrides,
  }),
  createMockDocument: (overrides = {}) => ({
    id: 'doc-123',
    tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
    name: 'Test Document',
    ...overrides,
  }),
};
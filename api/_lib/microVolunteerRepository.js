/**
 * Server-side repository for the Civic Micro-Volunteer Task Board (#759).
 *
 * The browser board persists to localStorage. Server deployments inject this
 * repository so the API boundary uses the same validated service functions and
 * the same atomic bundle semantics without touching a citizen's browser.
 *
 * `createMicroVolunteerMemoryRepository` is the default and is used by tests.
 * A durable adapter can implement the same `storage` contract (getItem, setItem,
 * removeItem) around Firestore or a managed database; the service layer does not
 * need to change.
 */

import { createMemoryStorage } from '../../src/services/microVolunteerMigrations.js';

export const createMicroVolunteerMemoryRepository = ({ storage = createMemoryStorage() } = {}) => {
  const adapter = storage;
  return {
    kind: 'memory',
    storage: adapter,
    clear: () => {
      if (typeof adapter.clear === 'function') adapter.clear();
    },
    /** Runs `work` with the repository storage and returns its result. */
    withStorage: (work) => work(adapter),
  };
};

/**
 * Durable adapter contract. A caller supplies an object with async
 * `getItem`, `setItem` and `removeItem`; the returned adapter is synchronous
 * from the service's point of view because each API request loads and saves one
 * bundle. A production implementation should wrap this in a per-jurisdiction
 * transaction so two simultaneous claims cannot both read the same capacity.
 */
export const createMicroVolunteerStorageAdapter = ({ read, write, remove }) => {
  if (typeof read !== 'function' || typeof write !== 'function') {
    throw new TypeError('A durable micro-volunteer adapter needs read and write functions.');
  }
  let cached = null;
  return {
    getItem: () => cached,
    setItem: (_key, value) => {
      cached = value;
      write(value);
    },
    removeItem: () => {
      cached = null;
      if (typeof remove === 'function') remove();
    },
    /** Called by the handler before a request so the bundle is fresh. */
    prime: async (key) => {
      cached = await read(key);
      return cached;
    },
  };
};

export const defaultMicroVolunteerRepository = createMicroVolunteerMemoryRepository();

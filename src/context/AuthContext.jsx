/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { resolveRole } from '../services/roleService';
import { setCurrentActor } from '../services/accessControl';

const AuthContext = createContext(null);
const DEMO_STORAGE_KEY = 'civicbridge_demo_user';

/**
 * Inner provider for when a valid Clerk publishable key is present.
 */
const ClerkAuthProvider = ({ children }) => {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();

  const activeUser = useMemo(() => {
    if (!isSignedIn || !clerkUser) return null;

    const email = clerkUser.primaryEmailAddress?.emailAddress || '';
    const name =
      clerkUser.fullName ||
      (clerkUser.firstName
        ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim()
        : null) ||
      clerkUser.username ||
      email.split('@')[0] ||
      'Citizen';

    const role = resolveRole(clerkUser.publicMetadata);

    return {
      id: clerkUser.id,
      username: name,
      fullName: clerkUser.fullName || name,
      firstName: clerkUser.firstName || name,
      email,
      imageUrl: clerkUser.imageUrl,
      role,
      isClerk: true,
      raw: clerkUser,
    };
  }, [isSignedIn, clerkUser]);

  // The data layer reads who is signed in from here (see services/accessControl.js). It is set
  // while rendering, not in an effect, because child effects (the admin page loading its data) run
  // before a parent effect would.
  setCurrentActor(activeUser);

  const logout = useCallback(async () => {
    if (clerk) {
      await clerk.signOut();
    }
    localStorage.removeItem(DEMO_STORAGE_KEY);
  }, [clerk]);

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        loading: !isLoaded,
        logout,
        signInAsDemo: null,
        isClerkConfigured: true,
        isDemoMode: false,
        isClerkLoaded: isLoaded,
        clerk,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Fallback provider when Clerk is not configured or in local development mode.
 * Provides full guest/demo authentication so protected routes can be exercised.
 */
const LocalFallbackAuthProvider = ({ children }) => {
  const [demoUser, setDemoUser] = useState(() => {
    try {
      const stored = localStorage.getItem(DEMO_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (demoUser) {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoUser));
    } else {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
  }, [demoUser]);

  setCurrentActor(demoUser);

  const signInAsDemo = useCallback((options = {}) => {
    const role = options.role === 'admin' ? 'admin' : 'citizen';
    const fallbackUser = {
      id: options.id || `demo-${Date.now()}`,
      username: options.username || (role === 'admin' ? 'Demo Admin' : 'Demo Citizen'),
      fullName: options.fullName || (role === 'admin' ? 'Demo Administrator' : 'Demo Citizen User'),
      firstName: options.firstName || (role === 'admin' ? 'Demo' : 'Citizen'),
      email: options.email || (role === 'admin' ? 'admin@civicbridge.demo' : 'citizen@civicbridge.demo'),
      imageUrl: options.imageUrl || '',
      role,
      isClerk: false,
      isDemo: true,
      raw: null,
    };
    setDemoUser(fallbackUser);
    return fallbackUser;
  }, []);

  const logout = useCallback(async () => {
    setDemoUser(null);
    localStorage.removeItem(DEMO_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: demoUser,
        loading: false,
        logout,
        signInAsDemo,
        isClerkConfigured: false,
        isDemoMode: true,
        isClerkLoaded: true,
        clerk: null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider = ({ children }) => {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const isKeyConfigured = Boolean(
    publishableKey &&
      typeof publishableKey === 'string' &&
      (publishableKey.startsWith('pk_test_') || publishableKey.startsWith('pk_live_'))
  );

  if (!isKeyConfigured) {
    return <LocalFallbackAuthProvider>{children}</LocalFallbackAuthProvider>;
  }

  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};

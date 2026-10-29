import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App.jsx';
import { applySavedPreferences } from './utils/preferencesStorage';

// Apply saved theme and accessibility settings before first paint
applySavedPreferences();

const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isClerkKeyValid = Boolean(
  rawKey &&
  typeof rawKey === 'string' &&
  (rawKey.startsWith('pk_test_') || rawKey.startsWith('pk_live_'))
);

// Clerk's own usage telemetry is switched off (telemetry={false}); see docs/DIAGNOSTICS.md.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isClerkKeyValid ? (
      <ClerkProvider publishableKey={rawKey} afterSignOutUrl="/" telemetry={false}>
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
);
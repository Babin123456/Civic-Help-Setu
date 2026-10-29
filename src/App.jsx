import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { ThemeProvider } from './context/ThemeContext';
import { NetworkProvider } from './context/NetworkContext';
import { ConfirmationDialogProvider } from './context/ConfirmationDialogContext';

import SkipToContent from './components/common/SkipToContent';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ToastContainer from './components/ToastContainer';
import AccessibilityToolbar from './components/AccessibilityToolbar';
import ProtectedRoute from './components/ProtectedRoute';
import OfflineBanner from './components/common/OfflineBanner';
import BackToTop from './components/common/BackToTop';
import RouteErrorFallback from './components/common/RouteErrorFallback';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';

import Home from './pages/Home';
import Login from './pages/Login';
import SignUpPage from './pages/SignUp';
import SSOCallback from './pages/SSOCallback';
import Assistant from './pages/Assistant';
import { ServiceCardSkeletonGrid } from './components/ServiceCardSkeleton';
import ServiceDetails from './pages/ServiceDetails';
import Eligibility from './pages/Eligibility';
import NearbyOffices from './pages/NearbyOffices';
import Track from './pages/Track';
import Saved from './pages/Saved';
import Vault from './pages/Vault';
import Profile from './pages/Profile';
import OpenSource from './pages/OpenSource';
import Privacy from './pages/Privacy';
import Admin from './pages/Admin';
import SharedChecklistView from './pages/SharedChecklistView';
import NotFound from './pages/NotFound';

const Services = lazy(() => import('./pages/Services'));

const ServicesFallback = () => (
  <div className="section">
    <div className="container">
      <ServiceCardSkeletonGrid />
    </div>
  </div>
);

function AppRoot() {
  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <ToastProvider>
          <AuthProvider>
            <LanguageProvider>
              <NetworkProvider>
                <ConfirmationDialogProvider>
                  <>
                    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                    <OfflineBanner />
                    <SkipToContent />
                    <Navbar />
                  <main id="main-content" style={{ flex: 1 }} tabIndex="-1">
                    <RouteErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/login/*" element={<Login />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup/*" element={<SignUpPage />} />
                      <Route path="/signup" element={<SignUpPage />} />
                      <Route path="/sso-callback" element={<SSOCallback />} />
                      <Route path="/signup/sso-callback" element={<SSOCallback />} />
                      <Route path="/assistant" element={<Assistant />} />
                      <Route path="/services" element={<Suspense fallback={<ServicesFallback />}><Services /></Suspense>} />
                      <Route path="/services/:id" element={<ServiceDetails />} />
                      <Route path="/eligibility" element={<Eligibility />} />
                      <Route path="/nearby" element={<NearbyOffices />} />
                      <Route path="/nearby-offices" element={<NearbyOffices />} />
                      <Route path="/track" element={<Track />} />
                      <Route path="/shared-checklist/:token" element={<SharedChecklistView />} />

                      <Route path="/saved" element={
                        <ProtectedRoute>
                          <Saved />
                        </ProtectedRoute>
                      } />

                      <Route path="/vault" element={
                        <ProtectedRoute>
                          <Vault />
                        </ProtectedRoute>
                      } />

                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      } />

                      <Route path="/open-source" element={<OpenSource />} />
                      <Route path="/privacy" element={<Privacy />} />

                      <Route path="/admin" element={
                        <ProtectedRoute requiredRole="admin">
                          <Admin />
                        </ProtectedRoute>
                      } />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </RouteErrorBoundary>
                  </main>
                  <Footer />
                  <BackToTop />
                  <ToastContainer />
                  <AccessibilityToolbar />
                </div>
              </>
            </ConfirmationDialogProvider>
          </NetworkProvider>
        </LanguageProvider>
          </AuthProvider>
        </ToastProvider>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}

// A data router is required for useBlocker (unsaved-changes warning).
// A single splat route keeps all existing <Routes> behaviour unchanged.
const router = createBrowserRouter([{ path: '*', element: <AppRoot />, errorElement: <RouteErrorFallback /> }]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;

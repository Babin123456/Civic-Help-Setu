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
import Acronyms from './pages/Acronyms';
import Eligibility from './pages/Eligibility';
import NearbyOffices from './pages/NearbyOffices';
import Track from './pages/Track';
import Saved from './pages/Saved';
import Vault from './pages/Vault';
import Profile from './pages/Profile';
import OpenSource from './pages/OpenSource';
import Privacy from './pages/Privacy';
import Admin from './pages/Admin';
import TenantAdministrationWorkspace from './pages/TenantAdministrationWorkspace';
import SharedChecklistView from './pages/SharedChecklistView';
import SharedDirectoryView from './pages/SharedDirectoryView';
import PublicApplicationStatusView from './pages/PublicApplicationStatusView';
import SharedProfileView from './pages/SharedProfileView';
import NotFound from './pages/NotFound';
import VerifyEmail from './pages/VerifyEmail';
import AadhaarGuidePage from './pages/AadhaarGuidePage';
import SmallBusinessLicencePage from './pages/SmallBusinessLicencePage';
import FireSafetyGuidePage from './pages/FireSafetyGuidePage';
import TreePermissionGuidePage from './pages/TreePermissionGuidePage';
import CivicWorksBoard from './pages/CivicWorksBoard';
import TreeHealthInventory from './pages/TreeHealthInventory';
import CrematoriumDirectory from './pages/CrematoriumDirectory';
import FairPriceShopBoard from './pages/FairPriceShopBoard';
import TenderReadinessWorkspace from './pages/TenderReadinessWorkspace';
import CommunityFacilityDirectory from './pages/CommunityFacilityDirectory';
import RoadSafetyDashboard from './pages/RoadSafetyDashboard';
import LibraryDirectory from './pages/LibraryDirectory';
import WaterTankerTracker from './pages/WaterTankerTracker';
import AddressChangePlanner from './pages/AddressChangePlanner';
import RentalTransitionWorkspace from './pages/RentalTransitionWorkspace';
import CitizenDraftSyncWorkspace from './pages/CitizenDraftSyncWorkspace';
import SyntheticDatasetWorkspace from './pages/SyntheticDatasetWorkspace';
import CounterDemandForecastingWorkspace from './pages/CounterDemandForecastingWorkspace';
import WardBudgetWorkspace from './pages/WardBudgetWorkspace';
import LineageExplorerWorkspace from './pages/LineageExplorerWorkspace';
import CivicSurveyWorkspace from './pages/CivicSurveyWorkspace';
import PublicToiletDirectory from './pages/PublicToiletDirectory';
import AccessibleRouteBarrierWorkspace from './pages/AccessibleRouteBarrierWorkspace';
import StreetlightOutageWorkspace from './pages/StreetlightOutageWorkspace';
import GhgInventoryWorkspace from './pages/GhgInventoryWorkspace';
import WaterQualityRegister from './pages/WaterQualityRegister';
import PublicProjectsWorkspace from './pages/PublicProjectsWorkspace';
import WardIssueHeatmapWorkspace from './pages/WardIssueHeatmapWorkspace';
import ContinuityPlannerWorkspace from './pages/ContinuityPlannerWorkspace';
import SeniorCitizenTribunalWorkspace from './pages/SeniorCitizenTribunalWorkspace';
import ReraDisputeWorkspace from './pages/ReraDisputeWorkspace';
import StrayAnimalAbcWorkspace from './pages/StrayAnimalAbcWorkspace';
import NoisePollutionWorkspace from './pages/NoisePollutionWorkspace';
import SolidWasteAuditWorkspace from './pages/SolidWasteAuditWorkspace';
import OpenContractingWorkspace from './pages/OpenContractingWorkspace';
import ClinicalEstablishmentWorkspace from './pages/ClinicalEstablishmentWorkspace';
import ElectricityConsumerWorkspace from './pages/ElectricityConsumerWorkspace';
import CatalogueVisualQaWorkspace from './pages/CatalogueVisualQaWorkspace';
import StreetVendorWorkspace from './pages/StreetVendorWorkspace';
import DarkPatternsWorkspace from './pages/DarkPatternsWorkspace';
import AccessibilityAuditWorkspace from './pages/AccessibilityAuditWorkspace';

import RteAdmissionWorkspace from './pages/RteAdmissionWorkspace';

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
                    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', overflowX: 'clip' }}>
                    <OfflineBanner />
                    <SkipToContent />
                    <Navbar />
                  <main id="main-content" style={{ flex: 1, minWidth: 0, width: '100%' }} tabIndex="-1">
                    <RouteErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/login/*" element={<Login />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup/*" element={<SignUpPage />} />
                      <Route path="/signup" element={<SignUpPage />} />
                      <Route path="/sso-callback" element={<SSOCallback />} />
                      <Route path="/signup/sso-callback" element={<SSOCallback />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      <Route path="/assistant" element={<Assistant />} />
                      <Route path="/services" element={<Suspense fallback={<ServicesFallback />}><Services /></Suspense>} />
                      <Route path="/services/aadhaar-guide" element={<AadhaarGuidePage />} />
                      <Route path="/aadhaar-guide" element={<AadhaarGuidePage />} />
                      <Route path="/services/business-licence-checklist" element={<SmallBusinessLicencePage />} />
                      <Route path="/business-licence-checklist" element={<SmallBusinessLicencePage />} />
                      <Route path="/services/fire-noc-guide" element={<FireSafetyGuidePage />} />
                      <Route path="/fire-noc-guide" element={<FireSafetyGuidePage />} />
                      <Route path="/services/tree-permission-guide" element={<TreePermissionGuidePage />} />
                      <Route path="/tree-permission-guide" element={<TreePermissionGuidePage />} />
                      <Route path="/services/ward-issue-heatmap" element={<WardIssueHeatmapWorkspace />} />
                      <Route path="/ward-issue-heatmap" element={<WardIssueHeatmapWorkspace />} />
                      <Route path="/civic-issue-heatmap" element={<WardIssueHeatmapWorkspace />} />
                      <Route path="/services/catalogue-visual-qa" element={<CatalogueVisualQaWorkspace />} />
                      <Route path="/catalogue-visual-qa" element={<CatalogueVisualQaWorkspace />} />
                      <Route path="/visual-qa" element={<CatalogueVisualQaWorkspace />} />
                      <Route path="/services/ward-budget-proposal" element={<WardBudgetWorkspace />} />
                      <Route path="/ward-budget" element={<WardBudgetWorkspace />} />
                      <Route path="/ward-budget/:id" element={<WardBudgetWorkspace />} />
                      <Route path="/services/:id" element={<ServiceDetails />} />
                      <Route path="/acronyms" element={<Acronyms />} />
                      <Route path="/eligibility" element={<Eligibility />} />
                      <Route path="/nearby" element={<NearbyOffices />} />
                      <Route path="/nearby-offices" element={<NearbyOffices />} />
                      <Route path="/crematorium-directory" element={<CrematoriumDirectory />} />
                      <Route path="/crematoriums" element={<CrematoriumDirectory />} />
                      <Route path="/pds-shops" element={<FairPriceShopBoard />} />
                      <Route path="/fair-price-shops" element={<FairPriceShopBoard />} />
                      <Route path="/tenders" element={<TenderReadinessWorkspace />} />
                      <Route path="/tender-readiness" element={<TenderReadinessWorkspace />} />
                      <Route path="/open-contracting" element={<OpenContractingWorkspace />} />
                      <Route path="/procurement-analytics" element={<OpenContractingWorkspace />} />
                      <Route path="/open-contracting/:id" element={<OpenContractingWorkspace />} />
                      <Route path="/community-facilities" element={<CommunityFacilityDirectory />} />
                      <Route path="/facility-directory" element={<CommunityFacilityDirectory />} />
                      <Route path="/water-tanker" element={<WaterTankerTracker />} />
                      <Route path="/water-tankers" element={<WaterTankerTracker />} />
                      <Route path="/services/water-quality-register" element={<WaterQualityRegister />} />
                      <Route path="/water-quality" element={<WaterQualityRegister />} />
                      <Route path="/water-quality-register" element={<WaterQualityRegister />} />
                      <Route path="/rental-checklist" element={<RentalTransitionWorkspace />} />
                      <Route path="/rental-transition" element={<RentalTransitionWorkspace />} />
                      <Route path="/rental-records" element={<RentalTransitionWorkspace />} />
                      <Route path="/library-directory" element={<LibraryDirectory />} />
                      <Route path="/libraries" element={<LibraryDirectory />} />
                      <Route path="/address-change-planner" element={<AddressChangePlanner />} />
                      <Route path="/address-change" element={<AddressChangePlanner />} />
                      <Route path="/move-planner" element={<AddressChangePlanner />} />
                      <Route path="/citizen-drafts" element={<CitizenDraftSyncWorkspace />} />
                      <Route path="/draft-sync" element={<CitizenDraftSyncWorkspace />} />
                      <Route path="/synthetic-datasets" element={<SyntheticDatasetWorkspace />} />
                      <Route path="/dataset-generator" element={<SyntheticDatasetWorkspace />} />
                      <Route path="/provenance" element={<LineageExplorerWorkspace />} />
                      <Route path="/provenance/:id" element={<LineageExplorerWorkspace />} />
                      <Route path="/lineage-explorer" element={<LineageExplorerWorkspace />} />
                      <Route path="/counter-demand" element={<CounterDemandForecastingWorkspace />} />
                      <Route path="/counter-demand-forecasting" element={<CounterDemandForecastingWorkspace />} />
                      <Route path="/queue-staffing" element={<CounterDemandForecastingWorkspace />} />
                      <Route path="/surveys" element={<CivicSurveyWorkspace />} />
                      <Route path="/survey-builder" element={<CivicSurveyWorkspace />} />
                      <Route path="/civic-surveys" element={<CivicSurveyWorkspace />} />
                      <Route path="/public-toilets" element={<PublicToiletDirectory />} />
                      <Route path="/toilet-directory" element={<PublicToiletDirectory />} />
                      <Route path="/toilets" element={<PublicToiletDirectory />} />
                      <Route path="/pedestrian-barrier-map" element={<AccessibleRouteBarrierWorkspace />} />
                      <Route path="/accessible-routes" element={<AccessibleRouteBarrierWorkspace />} />
                      <Route path="/pedestrian-routes" element={<AccessibleRouteBarrierWorkspace />} />
                      <Route path="/continuity-planner" element={<ContinuityPlannerWorkspace />} />
                      <Route path="/continuity-planner/:id" element={<ContinuityPlannerWorkspace />} />
                      <Route path="/incident-drills" element={<ContinuityPlannerWorkspace />} />
                      <Route path="/senior-citizen-tribunal" element={<SeniorCitizenTribunalWorkspace />} />
                      <Route path="/senior-tribunal" element={<SeniorCitizenTribunalWorkspace />} />
                      <Route path="/rera-dispute-workspace" element={<ReraDisputeWorkspace />} />
                      <Route path="/rera-homebuyer-rights" element={<ReraDisputeWorkspace />} />
                      <Route path="/stray-animal-workspace" element={<StrayAnimalAbcWorkspace />} />
                      <Route path="/rabies-pep-tracker" element={<StrayAnimalAbcWorkspace />} />
                      <Route path="/animal-birth-control" element={<StrayAnimalAbcWorkspace />} />
                      <Route path="/noise-pollution-workspace" element={<NoisePollutionWorkspace />} />
                      <Route path="/decibel-logger" element={<NoisePollutionWorkspace />} />
                      <Route path="/noise-curfew-auditor" element={<NoisePollutionWorkspace />} />
                      <Route path="/solid-waste-workspace" element={<SolidWasteAuditWorkspace />} />
                      <Route path="/bulk-waste-audit" element={<SolidWasteAuditWorkspace />} />
                      <Route path="/ngt-compensation" element={<SolidWasteAuditWorkspace />} />
                      <Route path="/clinical-establishment-workspace" element={<ClinicalEstablishmentWorkspace />} />
                      <Route path="/patient-rights-charter" element={<ClinicalEstablishmentWorkspace />} />
                      <Route path="/hospital-billing-audit" element={<ClinicalEstablishmentWorkspace />} />
                      <Route path="/electricity-consumer-workspace" element={<ElectricityConsumerWorkspace />} />
                      <Route path="/discom-outage-audit" element={<ElectricityConsumerWorkspace />} />
                      <Route path="/cgrf-compensation-drafter" element={<ElectricityConsumerWorkspace />} />
                      <Route path="/accessibility-audit-workspace" element={<AccessibilityAuditWorkspace />} />
                      <Route path="/dark-patterns-workspace" element={<DarkPatternsWorkspace />} />
                      <Route path="/drip-pricing-audit" element={<DarkPatternsWorkspace />} />
                      <Route path="/ccpa-redressal" element={<DarkPatternsWorkspace />} />
                      <Route path="/street-vendor-workspace" element={<StreetVendorWorkspace />} />
                      <Route path="/vendor-eviction-immunity" element={<StreetVendorWorkspace />} />
                      <Route path="/goods-seizure-reconciler" element={<StreetVendorWorkspace />} />
                      <Route path="/rte-quota-workspace" element={<RteAdmissionWorkspace />} />
                      <Route path="/rte-admission-audit" element={<RteAdmissionWorkspace />} />
                      <Route path="/rte-screening-redressal" element={<RteAdmissionWorkspace />} />
                      <Route path="/track" element={<Track />} />
                      <Route path="/civic-works" element={<CivicWorksBoard />} />
                      <Route path="/public-projects" element={<PublicProjectsWorkspace />} />
                      <Route path="/projects" element={<PublicProjectsWorkspace />} />
                      <Route path="/public-projects/:id" element={<PublicProjectsWorkspace />} />
                      <Route path="/road-safety" element={<RoadSafetyDashboard />} />
                      <Route path="/blackspots" element={<RoadSafetyDashboard />} />
                      <Route path="/tree-health" element={<TreeHealthInventory />} />
                      <Route path="/tree-inventory" element={<TreeHealthInventory />} />
                      <Route path="/streetlights" element={<StreetlightOutageWorkspace />} />
                      <Route path="/streetlight-outages" element={<StreetlightOutageWorkspace />} />
                      <Route path="/services/streetlight-outages" element={<StreetlightOutageWorkspace />} />
                      <Route path="/ghg-inventory" element={<GhgInventoryWorkspace />} />
                      <Route path="/emissions-inventory" element={<GhgInventoryWorkspace />} />
                      <Route path="/services/ghg-inventory" element={<GhgInventoryWorkspace />} />
                      <Route path="/shared-checklist/:token" element={<SharedChecklistView />} />
                      <Route path="/shared-directory/:token" element={<SharedDirectoryView />} />
                      <Route path="/app-status/:token" element={<PublicApplicationStatusView />} />
                      <Route path="/shared-profile/:token" element={<SharedProfileView />} />

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

                      <Route path="/admin/imports" element={
                        <ProtectedRoute requiredRole="admin">
                          <Admin />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/import" element={
                        <ProtectedRoute requiredRole="admin">
                          <Admin />
                        </ProtectedRoute>
                      } />

                      <Route path="/tenants" element={<TenantAdministrationWorkspace />} />
                      <Route path="/tenants/:tenantId" element={<TenantAdministrationWorkspace />} />
                      <Route path="/tenant-workspace" element={<TenantAdministrationWorkspace />} />

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

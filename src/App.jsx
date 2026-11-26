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
import WardBudgetWorkspace from './pages/WardBudgetWorkspace';
import CivicSurveyWorkspace from './pages/CivicSurveyWorkspace';
import FederatedQueryExplorer from './pages/FederatedQueryExplorer';
import WardAnalyticsDashboard from './pages/WardAnalyticsDashboard';


import DataCleanRoomWorkspace from './pages/DataCleanRoomWorkspace';


import ShelterStatusBoard from './pages/ShelterStatusBoard';

const ResourceExchangePage = lazy(() => import('./components/resource-exchange/ResourceExchangePage'));
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const SignUpPage = lazy(() => import('./pages/SignUp'));
const SSOCallback = lazy(() => import('./pages/SSOCallback'));
const Assistant = lazy(() => import('./pages/Assistant'));
const CounterJourney = lazy(() => import('./pages/CounterJourney'));
const NationalCivicDocumentHub = lazy(() => import('./pages/NationalCivicDocumentHub'));
const UpFloodRoutePlanner = lazy(() => import('./components/flood/UpFloodRoutePlanner'));
const TextRouteDirectory = lazy(() => import('./components/flood/TextRouteDirectory'));
const UpFloodResponseBoard = lazy(() => import('./pages/UpFloodResponseBoard'));
const WaterBillVisualizerPage = lazy(() => import('./pages/WaterBillVisualizerPage'));
const ServiceDetails = lazy(() => import('./pages/ServiceDetails'));
const Acronyms = lazy(() => import('./pages/Acronyms'));
const Eligibility = lazy(() => import('./pages/Eligibility'));
const NearbyOffices = lazy(() => import('./pages/NearbyOffices'));
const Track = lazy(() => import('./pages/Track'));
const Saved = lazy(() => import('./pages/Saved'));
const Vault = lazy(() => import('./pages/Vault'));
const Profile = lazy(() => import('./pages/Profile'));
const OpenSource = lazy(() => import('./pages/OpenSource'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Admin = lazy(() => import('./pages/Admin'));
const TenantAdministrationWorkspace = lazy(() => import('./pages/TenantAdministrationWorkspace'));
const SharedChecklistView = lazy(() => import('./pages/SharedChecklistView'));
const SharedDirectoryView = lazy(() => import('./pages/SharedDirectoryView'));
const PublicApplicationStatusView = lazy(() => import('./pages/PublicApplicationStatusView'));
const SharedProfileView = lazy(() => import('./pages/SharedProfileView'));
const NotFound = lazy(() => import('./pages/NotFound'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const AadhaarGuidePage = lazy(() => import('./pages/AadhaarGuidePage'));
const PropertyTaxNoDuesGuidePage = lazy(() => import('./pages/PropertyTaxNoDuesGuidePage'));
const SmallBusinessLicencePage = lazy(() => import('./pages/SmallBusinessLicencePage'));
const FireSafetyGuidePage = lazy(() => import('./pages/FireSafetyGuidePage'));
const TreePermissionGuidePage = lazy(() => import('./pages/TreePermissionGuidePage'));
const TransgenderCertificateWelfarePage = lazy(() => import('./pages/TransgenderCertificateWelfarePage'));
const CivicWorksBoard = lazy(() => import('./pages/CivicWorksBoard'));
const MicroVolunteerTaskBoard = lazy(() => import('./pages/MicroVolunteerTaskBoard'));
const TreeHealthInventory = lazy(() => import('./pages/TreeHealthInventory'));
const CrematoriumDirectory = lazy(() => import('./pages/CrematoriumDirectory'));
const FairPriceShopBoard = lazy(() => import('./pages/FairPriceShopBoard'));
const TenderReadinessWorkspace = lazy(() => import('./pages/TenderReadinessWorkspace'));
const CommunityFacilityDirectory = lazy(() => import('./pages/CommunityFacilityDirectory'));
const RoadSafetyDashboard = lazy(() => import('./pages/RoadSafetyDashboard'));
const UpSchoolZoneSafetyAudit = lazy(() => import('./pages/UpSchoolZoneSafetyAudit'));
const LibraryDirectory = lazy(() => import('./pages/LibraryDirectory'));
const TransitConcessionsDirectory = lazy(() => import('./pages/TransitConcessionsDirectory'));
const WaterTankerTracker = lazy(() => import('./pages/WaterTankerTracker'));
const AddressChangePlanner = lazy(() => import('./pages/AddressChangePlanner'));
const FormFieldExplainerAssistant = lazy(() => import('./pages/FormFieldExplainerAssistant'));
const RentalTransitionWorkspace = lazy(() => import('./pages/RentalTransitionWorkspace'));
const CitizenDraftSyncWorkspace = lazy(() => import('./pages/CitizenDraftSyncWorkspace'));
const CivicDataApi = lazy(() => import('./pages/CivicDataApi'));
const SyntheticDatasetWorkspace = lazy(() => import('./pages/SyntheticDatasetWorkspace'));
const CounterDemandForecastingWorkspace = lazy(() => import('./pages/CounterDemandForecastingWorkspace'));
const GrievanceSlaForecastingWorkspace = lazy(() => import('./pages/GrievanceSlaForecastingWorkspace'));
const WardBudgetWorkspace = lazy(() => import('./pages/WardBudgetWorkspace'));
const LineageExplorerWorkspace = lazy(() => import('./pages/LineageExplorerWorkspace'));
const CivicSurveyWorkspace = lazy(() => import('./pages/CivicSurveyWorkspace'));
const UpJanSunwaiWorkspace = lazy(() => import('./pages/UpJanSunwaiWorkspace'));
const UpHeatwaveReliefMap = lazy(() => import('./pages/UpHeatwaveReliefMap'));
const ComparisonWorkspace = lazy(() => import('./pages/ComparisonWorkspace'));
const OfficeComparisonDetail = lazy(() => import('./pages/OfficeComparisonDetail'));
const PublicToiletDirectory = lazy(() => import('./pages/PublicToiletDirectory'));
const AccessibleRouteBarrierWorkspace = lazy(() => import('./pages/AccessibleRouteBarrierWorkspace'));
const StreetlightOutageWorkspace = lazy(() => import('./pages/StreetlightOutageWorkspace'));
const ReliefOperationsWorkspace = lazy(() => import('./pages/ReliefOperationsWorkspace'));
const GhgInventoryWorkspace = lazy(() => import('./pages/GhgInventoryWorkspace'));
const WaterQualityRegister = lazy(() => import('./pages/WaterQualityRegister'));
const PublicProjectsWorkspace = lazy(() => import('./pages/PublicProjectsWorkspace'));
const WardIssueHeatmapWorkspace = lazy(() => import('./pages/WardIssueHeatmapWorkspace'));
const ContinuityPlannerWorkspace = lazy(() => import('./pages/ContinuityPlannerWorkspace'));
const SeniorCitizenTribunalWorkspace = lazy(() => import('./pages/SeniorCitizenTribunalWorkspace'));
const ReraDisputeWorkspace = lazy(() => import('./pages/ReraDisputeWorkspace'));
const StrayAnimalAbcWorkspace = lazy(() => import('./pages/StrayAnimalAbcWorkspace'));
const NoisePollutionWorkspace = lazy(() => import('./pages/NoisePollutionWorkspace'));
const SolidWasteAuditWorkspace = lazy(() => import('./pages/SolidWasteAuditWorkspace'));
const RoutePlanningWorkspace = lazy(() => import('./pages/RoutePlanningWorkspace'));
const OpenContractingWorkspace = lazy(() => import('./pages/OpenContractingWorkspace'));
const ClinicalEstablishmentWorkspace = lazy(() => import('./pages/ClinicalEstablishmentWorkspace'));
const ElectricityConsumerWorkspace = lazy(() => import('./pages/ElectricityConsumerWorkspace'));
const CatalogueVisualQaWorkspace = lazy(() => import('./pages/CatalogueVisualQaWorkspace'));
const StreetVendorWorkspace = lazy(() => import('./pages/StreetVendorWorkspace'));
const DarkPatternsWorkspace = lazy(() => import('./pages/DarkPatternsWorkspace'));
const AccessibilityAuditWorkspace = lazy(() => import('./pages/AccessibilityAuditWorkspace'));
const AccessibilityComplaintTrackerWorkspace = lazy(() => import('./pages/AccessibilityComplaintTrackerWorkspace'));
const LegalSourceReviewWorkspace = lazy(() => import('./pages/LegalSourceReviewWorkspace'));
const RteAdmissionWorkspace = lazy(() => import('./pages/RteAdmissionWorkspace'));
const EvidenceDossierWorkspace = lazy(() => import('./pages/EvidenceDossierWorkspace'));
const ChangeFeedPage = lazy(() => import('./pages/ChangeFeedPage'));
const FeeEvidenceAssistant = lazy(() => import('./pages/FeeEvidenceAssistant'));
const JurisdictionHandoffWorkspace = lazy(() => import('./pages/JurisdictionHandoffWorkspace'));
const AgentSandboxWorkspace = lazy(() => import('./pages/AgentSandboxWorkspace'));
const KnowledgeGraphQueryWorkspace = lazy(() => import('./pages/KnowledgeGraphQueryWorkspace'));
const PolicySimulationWorkspace = lazy(() => import('./pages/PolicySimulationWorkspace'));
const ChaosResilienceWorkspace = lazy(() => import('./pages/ChaosResilienceWorkspace'));
const ComplaintQualityCoachWorkspace = lazy(() => import('./pages/ComplaintQualityCoachWorkspace'));
const ServiceChangeSandboxWorkspace = lazy(() => import('./pages/ServiceChangeSandboxWorkspace'));
const DigitalEvidenceLockerWorkspace = lazy(() => import('./pages/DigitalEvidenceLockerWorkspace'));
const CaseCollaborationWorkspace = lazy(() => import('./components/caseCollaboration/CaseCollaborationWorkspace'));
const JourneyBenchmarkPage = lazy(() => import('./pages/JourneyBenchmarkPage'));
const Services = lazy(() => import('./pages/Services'));
const AbuseDashboardPage = lazy(() => import('./components/abuse-control-plane/AbuseDashboard'));
const CostCarbonGovernorWorkspacePage = lazy(() => import('./pages/CostCarbonGovernorWorkspace'));
const PolicyEngineWorkspacePage = lazy(() => import('./pages/PolicyEngineWorkspace'));
const FreshnessPredictionWorkspacePage = lazy(() => import('./pages/FreshnessPredictionWorkspace'));

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
                      <Route path="/services/ward-budget-proposal" element={<WardBudgetWorkspace />} />
                      <Route path="/ward-budget" element={<WardBudgetWorkspace />} />
                      <Route path="/ward-budget/:id" element={<WardBudgetWorkspace />} />
                      <Route path="/ward-analytics" element={<WardAnalyticsDashboard />} />
                      <Route path="/analytics/ward-issues" element={<WardAnalyticsDashboard />} />
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
                      <Route path="/community-facilities" element={<CommunityFacilityDirectory />} />
                      <Route path="/facility-directory" element={<CommunityFacilityDirectory />} />
                      <Route path="/water-tanker" element={<WaterTankerTracker />} />
                      <Route path="/water-tankers" element={<WaterTankerTracker />} />
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
                      <Route path="/surveys" element={<CivicSurveyWorkspace />} />
                      <Route path="/survey-builder" element={<CivicSurveyWorkspace />} />
                      <Route path="/civic-surveys" element={<CivicSurveyWorkspace />} />
                      <Route path="/federated-data" element={<FederatedQueryExplorer />} />
                      <Route path="/federated-civic-data" element={<FederatedQueryExplorer />} />
                      <Route path="/track" element={<Track />} />
                      <Route path="/civic-works" element={<CivicWorksBoard />} />
                      <Route path="/road-safety" element={<RoadSafetyDashboard />} />
                      <Route path="/blackspots" element={<RoadSafetyDashboard />} />
                      <Route path="/tree-health" element={<TreeHealthInventory />} />
                      <Route path="/tree-inventory" element={<TreeHealthInventory />} />
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


                    <main id="main-content" style={{ flex: 1, minWidth: 0, width: '100%' }} tabIndex="-1">
                      <RouteErrorBoundary>
                        <Suspense fallback={<div className="section" role="status" aria-live="polite"><div className="container">Loading page…</div></div>}>
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

                            <Route path="/national-civic-document-hub" element={<NationalCivicDocumentHub />} />
                            <Route path="/national-civic-document-hub/" element={<NationalCivicDocumentHub />} />

                            <Route path="/services/property-tax-no-dues" element={<PropertyTaxNoDuesGuidePage />} />
                            <Route path="/property-tax-no-dues" element={<PropertyTaxNoDuesGuidePage />} />

                            <Route path="/services/business-licence-checklist" element={<SmallBusinessLicencePage />} />
                            <Route path="/business-licence-checklist" element={<SmallBusinessLicencePage />} />
                            <Route path="/services/fire-noc-guide" element={<FireSafetyGuidePage />} />
                            <Route path="/fire-noc-guide" element={<FireSafetyGuidePage />} />
                            <Route path="/services/transgender-certificate-welcome" element={<TransgenderCertificateWelfarePage />} />
                            <Route path="/transgender-certificate-welcome" element={<TransgenderCertificateWelfarePage />} />
                            <Route path="/services/transgender-certificate-welfare" element={<TransgenderCertificateWelfarePage />} />
                            <Route path="/transgender-certificate-welfare" element={<TransgenderCertificateWelfarePage />} />
                            <Route path="/services/tree-permission-guide" element={<TreePermissionGuidePage />} />
                            <Route path="/tree-permission-guide" element={<TreePermissionGuidePage />} />
                            <Route path="/services/ward-issue-heatmap" element={<WardIssueHeatmapWorkspace />} />
                            <Route path="/ward-issue-heatmap" element={<WardIssueHeatmapWorkspace />} />
                            <Route path="/civic-issue-heatmap" element={<WardIssueHeatmapWorkspace />} />
                            <Route path="/services/catalogue-visual-qa" element={<CatalogueVisualQaWorkspace />} />
                            <Route path="/catalogue-visual-qa" element={<CatalogueVisualQaWorkspace />} />
                            <Route path="/visual-qa" element={<CatalogueVisualQaWorkspace />} />
                            <Route path="/services/jurisdiction-handoff" element={<JurisdictionHandoffWorkspace />} />
                            <Route path="/jurisdiction-handoff" element={<JurisdictionHandoffWorkspace />} />
                            <Route path="/services/:id/jurisdiction-map" element={<JurisdictionHandoffWorkspace />} />
                            <Route path="/jurisdiction-map" element={<JurisdictionHandoffWorkspace />} />

                            {/* Secure agent sandbox for untrusted civic document processing */}
                            <Route path="/agent-sandbox" element={<AgentSandboxWorkspace />} />

                            {/* Public service journey benchmark and open evaluation dataset */}
                            <Route path="/journey-benchmark" element={<JourneyBenchmarkPage />} />
                            <Route path="/benchmark" element={<JourneyBenchmarkPage />} />
                            <Route path="/knowledge-graph" element={<KnowledgeGraphQueryWorkspace />} />
                            <Route path="/knowledge-graph-query" element={<KnowledgeGraphQueryWorkspace />} />
                            <Route path="/services/change-feed" element={<ChangeFeedPage />} />
                            <Route path="/change-feed" element={<ChangeFeedPage />} />
                            <Route path="/services/ward-budget-proposal" element={<WardBudgetWorkspace />} />
                            <Route path="/ward-budget" element={<WardBudgetWorkspace />} />
                            <Route path="/ward-budget/:id" element={<WardBudgetWorkspace />} />
                            <Route path="/services/:id" element={<ServiceDetails />} />
                            <Route path="/acronyms" element={<Acronyms />} />
                            <Route path="/eligibility" element={<Eligibility />} />
                            <Route path="/nearby" element={<NearbyOffices />} />
                            <Route path="/nearby-offices" element={<NearbyOffices />} />
                            <Route path="/comparison" element={<ComparisonWorkspace />} />
                            <Route path="/office/:officeId" element={<OfficeComparisonDetail />} />
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
                            <Route path="/neighbourhood-resource-exchange" element={<ResourceExchangePage />} />
                            <Route path="/water-tanker" element={<WaterTankerTracker />} />
                            <Route path="/water-tankers" element={<WaterTankerTracker />} />

                            <Route path="/flood-planner" element={<UpFloodRoutePlanner />} />
                            <Route path="/flood-directory" element={<TextRouteDirectory />} />
                            <Route path="/flood-board" element={<UpFloodResponseBoard />} />
                            <Route path="/up-floods" element={<UpFloodResponseBoard />} />
                            <Route path="/waterlogging" element={<UpFloodResponseBoard />} />

                            {/* Counter journey simulator — public catalogue, evaluable for any citizen */}
                            <Route path="/counter-journey" element={<CounterJourney />} />

                            {/* Focus on one service's counter journey */}
                            <Route path="/services/:serviceId/counter-journey" element={<CounterJourney />} />

                            {/* Agent-based civic policy scenario simulator */}
                            <Route path="/policy-simulation" element={<PolicySimulationWorkspace />} />
                            <Route path="/services/:serviceId/policy-simulation" element={<PolicySimulationWorkspace />} />
                            <Route path="/chaos-engineering" element={<ChaosResilienceWorkspace />} />
                            <Route path="/resilience" element={<ChaosResilienceWorkspace />} />

                            {/* Agentic Civic Complaint Quality and Completeness Coach (#1190) */}
                            <Route path="/complaint-coach" element={<ComplaintQualityCoachWorkspace />} />
                            <Route path="/services/:serviceId/complaint-coach" element={<ComplaintQualityCoachWorkspace />} />
                            {/* Civic case collaboration space with granular, revocable sharing */}
                            <Route path="/case-collaboration" element={<CaseCollaborationWorkspace />} />
                            {/* Civic service change sandbox with shadow traffic evaluation */}
                            <Route path="/service-change-sandbox" element={<ServiceChangeSandboxWorkspace />} />

                            <Route path="/water-bill-visualizer" element={<WaterBillVisualizerPage />} />

                            <Route path="/services/water-quality-register" element={<WaterQualityRegister />} />
                            <Route path="/water-quality" element={<WaterQualityRegister />} />
                            <Route path="/water-quality-register" element={<WaterQualityRegister />} />

                            <Route path="/rental-checklist" element={<RentalTransitionWorkspace />} />
                            <Route path="/rental-transition" element={<RentalTransitionWorkspace />} />
                            <Route path="/rental-records" element={<RentalTransitionWorkspace />} />
                            <Route path="/library-directory" element={<LibraryDirectory />} />
                            <Route path="/transit-concessions" element={<TransitConcessionsDirectory />} />
                            <Route path="/services/transit-concessions" element={<TransitConcessionsDirectory />} />
                            <Route path="/libraries" element={<LibraryDirectory />} />
                            <Route path="/address-change-planner" element={<AddressChangePlanner />} />
                            <Route path="/address-change" element={<AddressChangePlanner />} />
                            <Route path="/move-planner" element={<AddressChangePlanner />} />
                            <Route path="/form-field-explainer" element={<FormFieldExplainerAssistant />} />
                            <Route path="/up-form-explainer" element={<FormFieldExplainerAssistant />} />
                            <Route path="/form-explainer" element={<FormFieldExplainerAssistant />} />
                            <Route path="/citizen-drafts" element={<CitizenDraftSyncWorkspace />} />
                            <Route path="/draft-sync" element={<CitizenDraftSyncWorkspace />} />

                            <Route path="/civic-data-api" element={<CivicDataApi />} />
                            <Route path="/developer-api" element={<CivicDataApi />} />

                            <Route path="/synthetic-datasets" element={<SyntheticDatasetWorkspace />} />
                            <Route path="/dataset-generator" element={<SyntheticDatasetWorkspace />} />
                            <Route path="/provenance" element={<LineageExplorerWorkspace />} />
                            <Route path="/provenance/:id" element={<LineageExplorerWorkspace />} />
                            <Route path="/lineage-explorer" element={<LineageExplorerWorkspace />} />
                            <Route path="/counter-demand" element={<CounterDemandForecastingWorkspace />} />
                            <Route path="/counter-demand-forecasting" element={<CounterDemandForecastingWorkspace />} />
                            <Route path="/queue-staffing" element={<CounterDemandForecastingWorkspace />} />
                            <Route path="/grievance-sla" element={<GrievanceSlaForecastingWorkspace />} />
                            <Route path="/grievance-sla-forecasting" element={<GrievanceSlaForecastingWorkspace />} />
                            <Route path="/bottleneck-analytics" element={<GrievanceSlaForecastingWorkspace />} />
                            <Route path="/surveys" element={<CivicSurveyWorkspace />} />
                            <Route path="/survey-builder" element={<CivicSurveyWorkspace />} />
                            <Route path="/civic-surveys" element={<CivicSurveyWorkspace />} />
                            <Route path="/up-jan-sunwai" element={<UpJanSunwaiWorkspace />} />
                            <Route path="/jan-sunwai" element={<UpJanSunwaiWorkspace />} />
                            <Route path="/jan-sunwai-workspace" element={<UpJanSunwaiWorkspace />} />
                            <Route path="/public-hearings" element={<UpJanSunwaiWorkspace />} />
                            <Route path="/up-heatwave-relief" element={<UpHeatwaveReliefMap />} />
                            <Route path="/heatwave-relief" element={<UpHeatwaveReliefMap />} />
                            <Route path="/cooling-relief" element={<UpHeatwaveReliefMap />} />
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
                            <Route path="/route-planning" element={<RoutePlanningWorkspace />} />
                            <Route path="/planning" element={<RoutePlanningWorkspace />} />
                            <Route path="/clinical-establishment-workspace" element={<ClinicalEstablishmentWorkspace />} />
                            <Route path="/patient-rights-charter" element={<ClinicalEstablishmentWorkspace />} />
                            <Route path="/hospital-billing-audit" element={<ClinicalEstablishmentWorkspace />} />
                            <Route path="/electricity-consumer-workspace" element={<ElectricityConsumerWorkspace />} />
                            <Route path="/discom-outage-audit" element={<ElectricityConsumerWorkspace />} />
                            <Route path="/cgrf-compensation-drafter" element={<ElectricityConsumerWorkspace />} />
                            <Route path="/accessibility-audit-workspace" element={<AccessibilityAuditWorkspace />} />
                            <Route path="/accessibility-tracker" element={<AccessibilityComplaintTrackerWorkspace />} />
                            <Route path="/accessibility-complaint-tracker" element={<AccessibilityComplaintTrackerWorkspace />} />
                            <Route path="/accessibility-escalation" element={<AccessibilityComplaintTrackerWorkspace />} />
                            <Route path="/services/accessibility-tracker" element={<AccessibilityComplaintTrackerWorkspace />} />
                            <Route path="/dark-patterns-workspace" element={<DarkPatternsWorkspace />} />
                            <Route path="/drip-pricing-audit" element={<DarkPatternsWorkspace />} />
                            <Route path="/ccpa-redressal" element={<DarkPatternsWorkspace />} />
                            <Route path="/street-vendor-workspace" element={<StreetVendorWorkspace />} />
                            <Route path="/vendor-eviction-immunity" element={<StreetVendorWorkspace />} />
                            <Route path="/goods-seizure-reconciler" element={<StreetVendorWorkspace />} />
                            <Route path="/rte-quota-workspace" element={<RteAdmissionWorkspace />} />
                            <Route path="/rte-admission-audit" element={<RteAdmissionWorkspace />} />
                            <Route path="/rte-screening-redressal" element={<RteAdmissionWorkspace />} />
                            <Route path="/legal-sources" element={<LegalSourceReviewWorkspace />} />
                            <Route path="/legal-source-review" element={<LegalSourceReviewWorkspace />} />
                            <Route path="/workspace-template-sources" element={<LegalSourceReviewWorkspace />} />
                            <Route path="/evidence-dossier" element={<EvidenceDossierWorkspace />} />
                            <Route path="/verify-evidence" element={<EvidenceDossierWorkspace />} />
                            <Route path="/evidence-manifest" element={<EvidenceDossierWorkspace />} />

                            <Route path="/digital-evidence-locker" element={<DigitalEvidenceLockerWorkspace />} />
                            <Route path="/evidence-locker" element={<DigitalEvidenceLockerWorkspace />} />
                            <Route path="/encrypted-locker" element={<DigitalEvidenceLockerWorkspace />} />
                            <Route path="/track" element={<Track />} />
                            <Route path="/civic-works" element={<CivicWorksBoard />} />
                            <Route path="/micro-volunteer-board" element={<MicroVolunteerTaskBoard />} />
                            <Route path="/micro-volunteer" element={<MicroVolunteerTaskBoard />} />
                            <Route path="/services/micro-volunteer-board" element={<MicroVolunteerTaskBoard />} />
                            <Route path="/public-projects" element={<PublicProjectsWorkspace />} />
                            <Route path="/projects" element={<PublicProjectsWorkspace />} />
                            <Route path="/public-projects/:id" element={<PublicProjectsWorkspace />} />
                            <Route path="/road-safety" element={<RoadSafetyDashboard />} />
                            <Route path="/blackspots" element={<RoadSafetyDashboard />} />
                            <Route path="/school-zone-safety" element={<UpSchoolZoneSafetyAudit />} />
                            <Route path="/school-safety" element={<UpSchoolZoneSafetyAudit />} />
                            <Route path="/up-school-safety" element={<UpSchoolZoneSafetyAudit />} />
                            <Route path="/tree-health" element={<TreeHealthInventory />} />
                            <Route path="/tree-inventory" element={<TreeHealthInventory />} />
                            <Route path="/streetlights" element={<StreetlightOutageWorkspace />} />
                            <Route path="/streetlight-outages" element={<StreetlightOutageWorkspace />} />
                            <Route path="/services/streetlight-outages" element={<StreetlightOutageWorkspace />} />
                            <Route path="/relief-operations" element={<ReliefOperationsWorkspace />} />
                            <Route path="/disaster-relief" element={<ReliefOperationsWorkspace />} />
                            <Route path="/services/relief-operations" element={<ReliefOperationsWorkspace />} />
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
                            <Route path="/abuse-control-plane" element={
                              <ProtectedRoute requiredRole="admin">
                                <AbuseDashboardPage />
                              </ProtectedRoute>
                            } />

                            {/* Civic Agent Cost & Carbon Budget Governor (public, read-only aggregates) */}
                            <Route path="/cost-carbon-governor" element={<CostCarbonGovernorWorkspacePage />} />

                            {/* Civic Agent Workflow Policy-as-Code Engine (public evaluation UI) */}
                            <Route path="/policy-engine" element={<PolicyEngineWorkspacePage />} />

                            {/* Civic Information Freshness Prediction & Review Prioritization (maintainer triage UI) */}
                            <Route path="/freshness-prediction" element={<FreshnessPredictionWorkspacePage />} />

                            <Route path="/tenants" element={<TenantAdministrationWorkspace />} />
                            <Route path="/tenants/:tenantId" element={<TenantAdministrationWorkspace />} />
                            <Route path="/tenant-workspace" element={<TenantAdministrationWorkspace />} />

                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Suspense>
                      </RouteErrorBoundary>
                    </main>
                    <Footer />
                    <BackToTop />
                    <ToastContainer />
                    <AccessibilityToolbar />
                  </div>
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
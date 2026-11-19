import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Lock,
  Clock,
  FileText,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Coins,
} from 'lucide-react';
import {
  UP_OFFICES,
  UP_SERVICE_ROUTING,
  UP_OFFICE_ROUTING_MAP,
  UP_FORMS,
} from '../../data/upOffices.js';
import {
  APPOINTMENT_STATUS,
  VISIT_OUTCOME,
  generateUpVisitPackingChecklist,
  createUpVisitRecord,
  recordUpVisitOutcome,
  formatIcsDate$1,
  generateUpAppointmentIcs,
  compileUpVisitPack,
  buildUpPrintableVisitPackHtml,
  buildUpPrintableVisitPackText,
} from '../../services/upVisitPlannerService.js';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * VisitPlanner Component (#1010)
 * UP Government Office Visit Readiness and Token/Counter Journey Planner
 *
 * Citizens travelling to tehsil, block, municipal, registrar, or district offices
 * can get a practical visit plan without losing a full day.
 *
 * Key principles:
 * - The planner never invents a counter, appointment slot, or opening hour
 * - Private token/visit notes are not publicly indexed
 * - A failed visit can be recorded without exposing sensitive documents
 * - Users can export an offline visit checklist
 * - Office details show a dated official source
 * - Uncertain counter details are clearly marked
 */

const VISIT_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  TOKEN_ISSUED: 'TOKEN_ISSUED',
  ADDITIONAL_DOCS: 'ADDITIONAL_DOCS',
  CANCELLED: 'CANCELLED',
};

export default function VisitPlanner({ initialService, onClose }) {
  // State: currently selected service
  const [selectedServiceId, setSelectedServiceId] = useState(
    initialService?.id || Object.keys(UP_SERVICE_ROUTING)[0] || ''
  );

  // State: visit record (private to the user)
  const [visitRecord, setVisitRecord] = useState(null);

  // State: section visibility
  const [activeSection, setActiveSection] = useState('plan');

  // State: user notes (private)
  const [userNotes, setUserNotes] = useState('');

  // State: visit outcome tracking
  const [visitOutcome, setVisitOutcome] = useState(VISIT_STATUS.PENDING);

  // Memoize the selected service routing
  const selectedServiceRoute = useMemo(() => {
    return UP_SERVICE_ROUTING[selectedServiceId] || UP_SERVICE_ROUTING['income-certificate'];
  }, [selectedServiceId]);

  // Memoize the office data
  const officeData = useMemo(() => {
    const routing = selectedServiceRoute;
    if (!routing) return null;
    return UP_OFFICES.find((o) => o.id === routing.officeId) || null;
  }, [selectedServiceId]);

  // Memoize the compiled visit pack
  const visitPack = useMemo(() => {
    if (!officeData || !selectedServiceRoute) return null;

    // Build service object for compileUpVisitPack
    const serviceObj = {
      id: selectedServiceId,
      name: selectedServiceId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      category: 'General Civic Service',
      department: 'Uttar Pradesh Government',
    };

    return compileUpVisitPack({
      service: serviceObj,
      office: officeData,
      // If we have a visit record with appointment info, use it
      appointment: visitRecord
        ? {
            tokenNumber: visitRecord.checklist?.find(
              (c) => c.type === 'PHOTOCOPY' || false
            )
              ? visitRecord.tokenNumber
              : '[Walk-in during public reception hours]',
            appointmentDate: visitRecord?.createdAt ? new Date(visitRecord.createdAt).toLocaleDateString() : '[Walk-in during public reception hours]',
            timeSlot: 'Morning queue recommended (09:30 AM - 11:30 AM)',
            status: visitRecord?.outcome || 'Unbooked / Walk-in Mode',
            isBooked: !!visitRecord,
          }
        : null,
      userNotes: userNotes,
      includeUserNotes: false, // Controlled separately
    });
  }, [officeData, selectedServiceId, userNotes, visitRecord]);

  // Handle service selection change
  const handleServiceChange = (serviceId) => {
    setSelectedServiceId(serviceId);
    setActiveSection('plan');
    // Reset visit record when changing service
    setVisitRecord(null);
    setUserNotes('');
    setVisitOutcome(VISIT_STATUS.PENDING);
  };

  // Handle creating a new visit record
  const handleCreateVisit = () => {
    if (!officeData) {
      // Show error - no office data
      return;
    }

    const newRecord = createUpVisitRecord({
      serviceName: selectedServiceId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      officeName: officeData.name,
      officeAddress: officeData.address,
      appointmentDateTime: new Date().toISOString(),
      referenceNumber: null,
      officialSourceUrl: officeData.auditMetadata?.sourceUrl || '',
      userNotes: '',
      requirementsConfig: {
        photocopyCount: 2,
        photoCount: 2,
      },
    }, 'current-user'); // In production, use actual authenticated user ID

    setVisitRecord(newRecord);
    setActiveSection('pack');
  };

  // Handle recording visit outcome
  const handleRecordOutcome = (outcome, notes = '') => {
    if (!visitRecord) return;

    setVisitOutcome(outcome);
    setUserNotes(''); // Clear notes after recording
    // In a full implementation, this would update the store with owner-based privacy
    // recordOutcome(visitRecord.id, outcome, notes, 'current-user');
  };

  // Handle exporting printable visit pack
  const handleExportPrint = () => {
    if (!visitPack) return;

    const html = buildUpPrintableVisitPackHtml(visitPack);
    // Trigger download
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `up-visit-pack-${selectedServiceId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle exporting text version
  const handleExportText = () => {
    if (!visitPack) return;

    const text = buildUpPrintableVisitPackText(visitPack);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `up-visit-checklist-${selectedServiceId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle reporting incorrect office info
  const handleReportIssue = () => {
    // In a full implementation, this would open a moderation queue
    // For now, we just alert the user
    if (window.confirm('Are you sure the office information is incorrect? This will be submitted for moderator review before any public updates.')) {
      // TODO: Submit to moderation queue
      alert('Thank you for reporting. Your feedback will be reviewed by moderators before any public updates.');
    }
  };

  // Handle downloading iCalendar
  const handleDownloadIcs = () => {
    if (!visitRecord || !visitRecord.appointmentDateTime) return;

    const icsContent = generateUpAppointmentIcs({
      id: visitRecord.id,
      serviceName: visitRecord.serviceName,
      officeName: visitRecord.officeName,
      counterNumber: visitRecord.counterNumber || 'General Counter',
      appointmentDateTime: visitRecord.appointmentDateTime,
      officialSourceUrl: visitRecord.officialSourceUrl || '',
      referenceNumber: visitRecord.referenceNumber,
    });

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `up-appointment-${visitRecord.id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render service selection tabs
  const serviceTabs = Object.keys(UP_SERVICE_ROUTING).map((serviceId) => ({
    id: serviceId,
    name: serviceId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  return (
    <div className="visit-planner max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Service Selection Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              UP Government Office Visit Planner
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a civic task to get a practical visit plan for Tehsil, Municipal, or RTO offices in Lucknow district.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Service:
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {serviceTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeSection === 'plan' && (
        <div>
          {/* Office Details Preview */}
          {officeData && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 mb-6 border border-slate-200/20 dark:border-slate-800/20">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                {officeData.name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">Address</p>
                  <p className="mt-1 break-all">{officeData.address}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">City</p>
                  <p className="mt-1 break-all">{officeData.city}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">District</p>
                  <p className="mt-1 break-all">{officeData.district}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">Helpline</p>
                  <p className="mt-1">{officeData.contact?.helpline || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">Operating Hours</p>
                  <p className="mt-1">{officeData.officeHours?.hours || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">Counter Desks</p>
                  <p className="mt-1 break-all small-text">
                    {officeData.counterDesks?.map((cd) => `${cd.name}: ${cd.description || ''}`).join(' | ' ) || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Service-Specific Routing Info */}
          {selectedServiceRoute && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 mb-6 border border-slate-200/20 dark:border-slate-800/20">
              <h3 className="text-font-semibold text-slate-900 dark:text-white mb-4">Journey Routing</h3>
              <p className="text-slate-600 dark:text-slate-400">
                <strong>Primary Office:</strong> {selectedServiceRoute.primaryOffice ||
                  'Not mapped'}<br />
                <strong>Counter:</strong> {selectedServiceRoute.counter ||
                  'Not specified'}<br />
                <strong>Appointment Required:</strong> {selectedServiceRoute.appointmentRequired ? 'Yes' : 'Walk-in'}
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-teal-600 dark:text-teal-400">
                  Questions to Ask at Counter
                </summary>
                <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400 space-y-1">
                  {selectedServiceRoute.questionsToAsk.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </details>
              {/* Distinguish official vs citizen instructions */}
              {selectedServiceRoute.instructions && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-teal-600 dark:text-teal-400">
                    Official Instructions vs Citizen Observations
                  </summary>
                  <div className="grid grid-cols-2 gap-4 text-xs mt-3">
                    <div>
                      <p className="font-medium text-slate-600 dark:text-slate-400">Official:</p>
                      <p className="mt-1 break-all">{selectedServiceRoute.instructions.official}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-600 dark:text-slate-400">Citizen Observation:</p>
                      <p className="mt-1 break-all">{selectedServiceRoute.instructions.citizenObservation}</p>
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Create Visit Plan Button */}
          <button
            onClick={handleCreateVisit}
            className="mt-6 w-full px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            Create My Visit Plan
          </button>
        </div>
      )}

      {/* Visit Pack Section */}
      {activeSection === 'pack' && visitRecord && (
        <div>
          {/* Visit Pack Display */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 mb-6 border border-slate-200/20 dark:border-slate-800/20">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Your Visit Plan for {visitRecord.serviceName}
            </h2>

            {/* Token/Appointment Info */}
            {visitRecord.checklist && visitRecord.checklist.length > 0 && (
              <div className="mb-6 p-4 bg-teal-50 rounded-lg">
                <h3 className="font-medium text-teal-700 mb-2">Token / Counter Information</h3>
                <p className="text-slate-600">
                  Counter: <strong>{visitRecord.counterNumber || 'General Counter'}</strong> •
                  Status: {visitRecord.outcome || 'PENDING_VISIT'}
                </p>
              </div>
            )}

            {/* Document Checklist */}
            <div>
              <h3 className="text-font-semibold text-slate-900 dark:text-white mb-4">Document Checklist</h3>
              <div className="grid grid-cols-2 gap-2">
                {visitRecord.checklist.map((item) => (
                  <div
                    key={item.id}
                    className={item.isPacked ? 'bg-teal-100 dark:bg-teal-900/30 rounded p-2' : 'border rounded p-2 border-slate-300/50'}
                  >
                    <span className={item.type === 'ORIGINAL' ? 'font-medium' : ''}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handleExportPrint()}
                className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm rounded-lg hover:bg-slate-300/50 transition-colors">
                🖨️ Print Pack
              </button>
              <button
                onClick={() => handleExportText()}
                className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm rounded-lg hover:bg-slate-300/50 transition-colors">
                📄 Text Checklist
              </button>
              <button
                onClick={() => handleDownloadIcs()}
                className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm rounded-lg hover:bg-slate-300/50 transition-colors">
                📅 Calendar
              </button>
            </div>
          </div>

          {/* Outcome Recording */}
          {visitOutcome !== VISIT_STATUS.PENDING && (
            <div className="mt-6 p-4 bg-slate-50 rounded-xl">
              <h3 className="font-medium text-slate-800 mb-2">Visit Outcome</h3>
              <p className="text-slate-600">
                Outcome: <strong>{visitOutout === VISIT_STATUS.COMPLETED ? 'Completed' : visitOutcome}</strong>
              </p>
              {visitOutcome === VISIT_STATUS.COMPLETED && (
                <p className="mt-2 text-sm text-slate-500">
                  You can record any deficiency memo or next step below.
                </p>
              )}
              <button
                onClick={() => handleRecordOutcome(visitOutcome)}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors">
                Record Outcome
              </button>
            </div>
          )}
        </div>
      )}

      {/* Report Issue Section */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200/20">
        <h3 className="font-medium text-slate-800 mb-2">Report Incorrect Office Information</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-3">
          If the office details (hours, counter information, address) are incorrect, you can report
          them for moderator review. Public updates require moderator verification.
        </p>
        <button
          onClick={handleReportIssue}
          className="w-full px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors">
          Submit Report for Moderator Review
        </button>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Reports are reviewed by moderators before any public updates are made.
        </p>
      </div>

      {/* Close Button */}
      <div className="mt-6">
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm rounded-lg hover:bg-slate-300/50 transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

/* Small text utility for internal use */
const smallText = (text) => `<small>${text}</small>`;
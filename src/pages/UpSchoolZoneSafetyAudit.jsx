import { useState, useMemo } from 'react';
import SchoolZoneSafetyHeader from '../components/schoolZoneSafety/SchoolZoneSafetyHeader';
import SchoolZoneAuditFeed from '../components/schoolZoneSafety/SchoolZoneAuditFeed';
import SchoolZoneDirectoryTable from '../components/schoolZoneSafety/SchoolZoneDirectoryTable';
import SchoolZoneAuditModal from '../components/schoolZoneSafety/SchoolZoneAuditModal';
import SchoolZoneStatusTrackerModal from '../components/schoolZoneSafety/SchoolZoneStatusTrackerModal';
import SmcPrintableAuditModal from '../components/schoolZoneSafety/SmcPrintableAuditModal';
import {
  listSchoolZones,
  listAuditReports,
  submitSchoolZoneAudit,
  transitionAuditStatus,
  endorseAuditReport,
} from '../services/upSchoolZoneSafetyService';
import { AUDIT_STATUSES } from '../data/upSchoolZoneSafetyContract';

export default function UpSchoolZoneSafetyAudit() {
  const [activeTab, setActiveTab] = useState('audits'); // 'audits' | 'schools'

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedLocationType, setSelectedLocationType] = useState('');
  const [selectedHazardType, setSelectedHazardType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedAuthority, setSelectedAuthority] = useState('');

  // Modals
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditModalSchoolId, setAuditModalSchoolId] = useState('');
  const [isStatusTrackerOpen, setIsStatusTrackerOpen] = useState(false);
  const [activeAuditForTracking, setActiveAuditForTracking] = useState(null);
  const [isSmcModalOpen, setIsSmcModalOpen] = useState(false);
  const [smcModalSchoolId, setSmcModalSchoolId] = useState('');

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState('');

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Load School Zones
  const schoolZones = useMemo(() => {
    if (refreshKey < 0) return [];
    return listSchoolZones({
      query: searchQuery,
      district: selectedDistrict,
      locationType: selectedLocationType,
    });
  }, [searchQuery, selectedDistrict, selectedLocationType, refreshKey]);

  // Load Audits
  const audits = useMemo(() => {
    if (refreshKey < 0) return [];
    const raw = listAuditReports({
      hazardType: selectedHazardType,
      status: selectedStatus,
      authority: selectedAuthority,
    });

    if (!searchQuery && !selectedDistrict) return raw;

    const lowerQuery = searchQuery.toLowerCase();
    return raw.filter((a) => {
      const matchSchool = (a.schoolName || '').toLowerCase().includes(lowerQuery);
      const matchUdise = (a.udiseCode || '').toLowerCase().includes(lowerQuery);
      const matchTitle = (a.hazardTitle || '').toLowerCase().includes(lowerQuery);
      return matchSchool || matchUdise || matchTitle;
    });
  }, [selectedHazardType, selectedStatus, selectedAuthority, searchQuery, selectedDistrict, refreshKey]);

  // Compute live stats
  const stats = useMemo(() => {
    if (refreshKey < 0) return { totalSchools: 0, activeHazards: 0, inProgress: 0, resolved: 0 };
    const allAudits = listAuditReports();
    const allSchools = listSchoolZones();
    return {
      totalSchools: allSchools.length,
      activeHazards: allAudits.filter((a) => a.status !== AUDIT_STATUSES.RESOLVED).length,
      inProgress: allAudits.filter(
        (a) =>
          a.status === AUDIT_STATUSES.INSPECTED ||
          a.status === AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED
      ).length,
      resolved: allAudits.filter((a) => a.status === AUDIT_STATUSES.RESOLVED).length,
    };
  }, [refreshKey]);

  const handleOpenAuditModal = (schoolId = '') => {
    setAuditModalSchoolId(schoolId);
    setIsAuditModalOpen(true);
  };

  const handleOpenSmcModal = (schoolId = '') => {
    setSmcModalSchoolId(schoolId || schoolZones[0]?.id || '');
    setIsSmcModalOpen(true);
  };

  const handleSelectAuditForTracking = (audit) => {
    setActiveAuditForTracking(audit);
    setIsStatusTrackerOpen(true);
  };

  const handleSubmitAudit = (auditInput) => {
    const newReport = submitSchoolZoneAudit(auditInput);
    setToastMessage(`Audit report "${newReport.id}" lodged successfully.`);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const handleUpdateStatus = ({ reportId, targetStatus, actor, notes }) => {
    const updated = transitionAuditStatus({
      reportId,
      targetStatus,
      actor,
      notes,
    });
    setActiveAuditForTracking(updated);
    setToastMessage(`Status updated to "${updated.status}" for ${reportId}.`);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const handleEndorse = (reportId) => {
    endorseAuditReport(reportId);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="section" style={{ minHeight: '80vh', padding: '1.5rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {toastMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              background: '#065f46',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage('')}
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              ✕
            </button>
          </div>
        )}

        <SchoolZoneSafetyHeader
          stats={stats}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedDistrict={selectedDistrict}
          onDistrictChange={setSelectedDistrict}
          selectedLocationType={selectedLocationType}
          onLocationTypeChange={setSelectedLocationType}
          selectedHazardType={selectedHazardType}
          onHazardTypeChange={setSelectedHazardType}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedAuthority={selectedAuthority}
          onAuthorityChange={setSelectedAuthority}
          onOpenAuditModal={() => handleOpenAuditModal()}
          onOpenSmcExportModal={() => handleOpenSmcModal()}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === 'audits' ? (
          <SchoolZoneAuditFeed
            audits={audits}
            onSelectAuditForTracking={handleSelectAuditForTracking}
            onEndorseAudit={handleEndorse}
            onOpenSmcExportForSchool={(schId) => handleOpenSmcModal(schId)}
          />
        ) : (
          <SchoolZoneDirectoryTable
            schools={schoolZones}
            onConductAuditForSchool={(schId) => handleOpenAuditModal(schId)}
            onExportSmcForSchool={(schId) => handleOpenSmcModal(schId)}
          />
        )}

        {/* Audit Lodging Wizard Modal */}
        <SchoolZoneAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          schoolZones={schoolZones}
          onSubmitAudit={handleSubmitAudit}
          defaultSchoolId={auditModalSchoolId}
        />

        {/* Status Lifecycle Tracker Modal */}
        <SchoolZoneStatusTrackerModal
          isOpen={isStatusTrackerOpen}
          onClose={() => setIsStatusTrackerOpen(false)}
          audit={activeAuditForTracking}
          onUpdateStatus={handleUpdateStatus}
        />

        {/* SMC Printable Dossier Modal */}
        <SmcPrintableAuditModal
          isOpen={isSmcModalOpen}
          onClose={() => setIsSmcModalOpen(false)}
          schoolZones={schoolZones}
          audits={audits}
          initialSchoolId={smcModalSchoolId}
        />
      </div>
    </div>
  );
}

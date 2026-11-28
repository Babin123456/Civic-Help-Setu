import crypto from 'node:crypto';

export const INCIDENT_TYPE = Object.freeze({
  SEWAGE_OVERFLOW: 'SEWAGE_OVERFLOW',
  OPEN_MANHOLE: 'OPEN_MANHOLE',
  WASTEWATER_DISCHARGE: 'WASTEWATER_DISCHARGE',
  BLOCKED_STORM_DRAIN: 'BLOCKED_STORM_DRAIN'
});

export const INCIDENT_SEVERITY = Object.freeze({
  EMERGENCY_HAZARD: 'EMERGENCY_HAZARD', // Exposed wires or deep open manhole
  MAJOR: 'MAJOR',
  MODERATE: 'MODERATE'
});

export class SewageIncidentDossierService {
  constructor() {
    this.incidents = new Map();
  }

  createIncidentReport(data = {}) {
    const {
      incidentType,
      observedStartTime,
      observedEndTime,
      location = {},
      hasElectricalHazard = false,
      isOpenManhole = false,
      evidencePhotos = [],
      reporterNotes = ''
    } = data;

    if (!incidentType || !INCIDENT_TYPE[incidentType]) {
      throw new Error(`Invalid incident type: ${incidentType}`);
    }

    if (!location.landmark && !location.address) {
      throw new Error('Landmark or address is mandatory for location dispatch.');
    }

    const dossierId = `DOS-WW-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const isEmergency = hasElectricalHazard || isOpenManhole;

    const incident = {
      dossierId,
      incidentType,
      severity: isEmergency ? INCIDENT_SEVERITY.EMERGENCY_HAZARD : INCIDENT_SEVERITY.MAJOR,
      observedStartTime: observedStartTime || new Date().toISOString(),
      observedEndTime: observedEndTime || null,
      submissionTime: new Date().toISOString(),
      location: {
        address: location.address || 'Address provided',
        landmark: location.landmark,
        district: location.district || 'Municipal Ward',
        coordinates: location.coordinates || null
      },
      safetyHazards: {
        hasElectricalHazard: Boolean(hasElectricalHazard),
        isOpenManhole: Boolean(isOpenManhole)
      },
      evidenceChronology: [
        {
          timestamp: observedStartTime || new Date().toISOString(),
          eventType: 'INCIDENT_OBSERVED',
          note: reporterNotes || 'First citizen observation registered.'
        }
      ],
      safetyAdvisory: isEmergency
        ? 'CAUTION: Do not approach the hazard area. Keep pedestrians at least 15 feet away due to structural/electrical risks.'
        : 'Do not attempt to clear blocked drains or handle wastewater directly.',
      responsibleAgency: 'Jal Board / Municipal Water & Sewerage Board',
      status: 'LOGGED'
    };

    this.incidents.set(dossierId, incident);
    return incident;
  }

  addFollowUpEvidence(dossierId, evidenceNote) {
    const incident = this.incidents.get(dossierId);
    if (!incident) throw new Error(`Dossier ${dossierId} not found.`);

    incident.evidenceChronology.push({
      timestamp: new Date().toISOString(),
      eventType: 'FOLLOW_UP_OBSERVATION',
      note: evidenceNote
    });

    return incident;
  }

  generateEscalationPacket(dossierId) {
    const incident = this.incidents.get(dossierId);
    if (!incident) throw new Error(`Dossier ${dossierId} not found.`);

    return {
      dossierId: incident.dossierId,
      agencyDispatch: `To: Ward Sanitation Officer / Executive Engineer, ${incident.responsibleAgency}`,
      urgencyLevel: incident.severity,
      locationDetails: `${incident.location.address} (Landmark: ${incident.location.landmark})`,
      chronologySummary: incident.evidenceChronology.map(e => `[${e.timestamp}] ${e.eventType}: ${e.note}`).join('\n'),
      safetyAdvisoryNotice: incident.safetyAdvisory
    };
  }
}

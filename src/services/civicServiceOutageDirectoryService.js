/**
 * Civic Service Outage and Alternative-Access Directory Service
 *
 * Implements a civic service status directory distinguishing verified administrative incidents
 * from citizen-reported accessibility issues:
 *
 * 1. Strict Separation of Incident Tiers:
 *    - VERIFIED_OFFICIAL: Backed by department public advisories, maintenance notices, or confirmed bulletins.
 *    - COMMUNITY_REPORTED: Unverified citizen observations, labeled clearly as pending review.
 * 2. Automatic Stale Notice Expiration:
 *    - Automatically transitions unresolved incidents past their time-to-live (TTL) into STALE_EXPIRED.
 * 3. Verified Official Alternative Access Channels:
 *    - Surfaces offline counters, CSC / e-Sevai centres, postal counters, and official telephone desks.
 *    - Validates alternative channel URLs to ensure they link exclusively to verified official domains.
 * 4. Ethical Safeguard (No Probing):
 *    - Strictly relies on administrative bulletins and community feedback.
 *    - Absolutely prohibits network port-scanning, ping sweeps, or active probing of government systems.
 */

export const INCIDENT_TIER = {
  VERIFIED_OFFICIAL: 'VERIFIED_OFFICIAL',
  COMMUNITY_REPORTED: 'COMMUNITY_REPORTED',
};

export const INCIDENT_STATUS = {
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED',
  STALE_EXPIRED: 'STALE_EXPIRED',
  ARCHIVED: 'ARCHIVED',
};

export const ALTERNATIVE_CHANNEL_TYPE = {
  PHYSICAL_COUNTER: 'PHYSICAL_COUNTER',
  HELPLINE_PHONE: 'HELPLINE_PHONE',
  COMMON_SERVICE_CENTRE: 'COMMON_SERVICE_CENTRE',
  SECONDARY_PORTAL: 'SECONDARY_PORTAL',
};

export const OUTAGE_SERVICE_DISCLAIMER =
  'Civic-Help-Setu publishes service availability notices based on verified government bulletins and ' +
  'moderated community feedback. We do not perform automated pinging or unauthorized probing of ' +
  'government IT infrastructure.';

/**
 * Validates whether a provided URL belongs to a sanctioned government or official public domain.
 */
export function isValidOfficialUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('.gov.in') ||
      host.endsWith('.nic.in') ||
      host.endsWith('.gov') ||
      host.endsWith('.tnega.org') ||
      host.endsWith('.org.in')
    );
  } catch {
    return false;
  }
}

/**
 * In-memory outage directory store.
 */
class OutageDirectoryStore {
  constructor() {
    this.incidents = new Map();
  }

  reset() {
    this.incidents.clear();
  }

  publishOfficialIncident(data, publisherRole = 'ADMIN') {
    if (publisherRole !== 'ADMIN' && publisherRole !== 'OFFICIAL_EDITOR') {
      throw new Error('Authorization Error: Only authorized administrators may publish official verified notices');
    }

    if (!data.serviceKey || !data.title || !data.officialSource) {
      throw new Error('Valid serviceKey, title, and officialSource are required');
    }

    const id = data.id || `inc_off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const verifiedAlternatives = (data.alternativeChannels || []).filter((alt) => {
      if (alt.url && !isValidOfficialUrl(alt.url)) {
        throw new Error(`Invalid alternative URL: '${alt.url}' is not a verified official government domain`);
      }
      return true;
    });

    const incident = {
      id,
      tier: INCIDENT_TIER.VERIFIED_OFFICIAL,
      status: INCIDENT_STATUS.ACTIVE,
      serviceKey: data.serviceKey.trim(),
      serviceName: data.serviceName || data.serviceKey,
      jurisdiction: data.jurisdiction || 'CENTRAL',
      title: data.title.trim(),
      description: data.description ? data.description.trim() : '',
      affectedFunctions: data.affectedFunctions || ['Full Service'],
      officialSource: data.officialSource.trim(),
      officialBulletinUrl: data.officialBulletinUrl || null,
      startTime: data.startTime ? new Date(data.startTime).toISOString() : new Date().toISOString(),
      expectedResolutionTime: data.expectedResolutionTime
        ? new Date(data.expectedResolutionTime).toISOString()
        : null,
      lastUpdatedAt: new Date().toISOString(),
      alternativeChannels: verifiedAlternatives,
      disclaimer: OUTAGE_SERVICE_DISCLAIMER,
    };

    this.incidents.set(id, incident);
    return incident;
  }

  submitCommunityReport(reportData, userIpBucket = 'bucket_general') {
    if (!reportData.serviceKey || !reportData.description) {
      throw new Error('Valid serviceKey and description are required');
    }

    const id = `inc_comm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const incident = {
      id,
      tier: INCIDENT_TIER.COMMUNITY_REPORTED,
      status: INCIDENT_STATUS.ACTIVE,
      serviceKey: reportData.serviceKey.trim(),
      serviceName: reportData.serviceName || reportData.serviceKey,
      jurisdiction: reportData.jurisdiction || 'CENTRAL',
      title: `Community Access Issue: ${reportData.serviceKey}`,
      description: reportData.description.trim(),
      affectedFunctions: reportData.affectedFunctions || ['Portal Access'],
      reportedAt: new Date().toISOString(),
      isModerated: false,
      userIpBucket,
      disclaimer: OUTAGE_SERVICE_DISCLAIMER,
    };

    this.incidents.set(id, incident);
    return incident;
  }

  moderateCommunityReport(id, approveAsVerified = false, officialSource = '', moderatorRole = 'ADMIN') {
    if (moderatorRole !== 'ADMIN') throw new Error('Authorization required');
    const existing = this.incidents.get(id);
    if (!existing) throw new Error('Incident not found');

    if (approveAsVerified) {
      existing.tier = INCIDENT_TIER.VERIFIED_OFFICIAL;
      existing.officialSource = officialSource || 'Verified by Civic Moderator';
      existing.isModerated = true;
      existing.lastUpdatedAt = new Date().toISOString();
    } else {
      existing.status = INCIDENT_STATUS.ARCHIVED;
      existing.moderationNote = 'Dismissed during editorial review';
    }

    this.incidents.set(id, existing);
    return existing;
  }

  checkAndExpireStaleIncidents(maxTtlHours = 48) {
    const now = Date.now();
    const expiredCount = [];

    for (const [id, inc] of this.incidents.entries()) {
      if (inc.status === INCIDENT_STATUS.ACTIVE) {
        const createdMs = new Date(inc.startTime || inc.reportedAt).getTime();
        const ageHours = (now - createdMs) / (1000 * 60 * 60);

        if (ageHours > maxTtlHours) {
          inc.status = INCIDENT_STATUS.STALE_EXPIRED;
          inc.lastUpdatedAt = new Date().toISOString();
          inc.expirationNote = `Automatically expired after ${maxTtlHours} hours without editorial update.`;
          this.incidents.set(id, inc);
          expiredCount.push(id);
        }
      }
    }

    return expiredCount;
  }

  getServiceIncidents(serviceKey) {
    const list = [];
    for (const inc of this.incidents.values()) {
      if (inc.serviceKey === serviceKey && inc.status !== INCIDENT_STATUS.ARCHIVED) {
        list.push(inc);
      }
    }
    return list;
  }
}

export const outageDirectoryStore = new OutageDirectoryStore();

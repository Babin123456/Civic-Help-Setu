/**
 * Civic Public Notice Subscription by Ward and Topic Service
 * 
 * Provides privacy-preserving locality-level subscription to civic public notices,
 * gazettes, tenders, and municipal notifications without storing exact GPS coordinates.
 * Core design features:
 * - Ward / Municipal Zone granularity (avoids collecting exact home addresses)
 * - Topic filters (Water supply, road works, sanitation, public hearings, property tax, zoning)
 * - Audit tracking of amendments, corrigenda, cancellations, and superseding notices
 * - Digest cadence controls (Immediate alert vs Daily morning digest vs Weekly summary)
 * - Transparent 1-click unsubscribe token generation
 */

export const NOTICE_TOPICS = {
  WATER_SUPPLY: { id: 'water_supply', label: 'Water Supply & Pipeline Maintenance' },
  ROAD_WORKS: { id: 'road_works', label: 'Road Closures, Digging & Paving' },
  SANITATION: { id: 'sanitation', label: 'Solid Waste & Sanitation Drives' },
  PUBLIC_HEARINGS: { id: 'public_hearings', label: 'Town Hall & Ward Committee Meetings' },
  PROPERTY_TAX: { id: 'property_tax', label: 'Property Tax & Trade Licence Revisions' },
  ZONING_ENVIRONMENT: { id: 'zoning_environment', label: 'Master Plan, Tree Trimming & Zoning Notices' }
};

export const DIGEST_FREQUENCIES = {
  IMMEDIATE: { id: 'immediate', label: 'Immediate Alert (Emergency notices only)' },
  DAILY: { id: 'daily', label: 'Daily Morning Summary (8:00 AM)' },
  WEEKLY: { id: 'weekly', label: 'Weekly Consolidated Digest (Sunday)' }
};

export const SUBSCRIPTION_AUDIT_ACTIONS = {
  SUBSCRIBE: 'SUBSCRIBE',
  UNSUBSCRIBE: 'UNSUBSCRIBE',
  UPDATE_TOPICS: 'UPDATE_TOPICS',
  PAUSE_DIGEST: 'PAUSE_DIGEST'
};

/**
 * Creates an immutable audit record for subscription modifications.
 * @param {string} action 
 * @param {Object} details 
 * @returns {Object} auditRecord
 */
export function createSubscriptionAuditEntry(action, details = {}) {
  return {
    action: SUBSCRIPTION_AUDIT_ACTIONS[action] || action,
    timestamp: new Date().toISOString(),
    ward: details.ward || 'N/A',
    municipality: details.municipality || 'N/A',
    topicCount: (details.topics || []).length,
    channelType: details.email ? 'EMAIL' : details.mobile ? 'SMS' : 'IN_APP',
    unsubscribeTokenHash: details.tokenHash || 'gen_' + Math.random().toString(36).substring(2, 10)
  };
}

/**
 * Validates public notice subscription payload with privacy safeguards.
 * @param {Object} subData 
 * @returns {Object} validation
 */
export function validateSubscriptionRequest(subData = {}) {
  const errors = [];
  const warnings = [];

  if (!subData.municipality || subData.municipality.trim().length < 2) {
    errors.push('Municipality or Urban Local Body (ULB) name is required.');
  }

  if (!subData.ward || subData.ward.toString().trim().length === 0) {
    errors.push('Ward number or locality zone is required.');
  }

  // Privacy check: flag if user erroneously passes precise address / GPS coords
  if (subData.latitude || subData.longitude || subData.exactAddress) {
    warnings.push('Privacy protection: Exact coordinates and house addresses are not stored. Civic notices are aggregated at the ward/zone level.');
  }

  const selectedTopics = Array.isArray(subData.topics) ? subData.topics : [];
  if (selectedTopics.length === 0) {
    errors.push('At least one topic subscription must be selected.');
  } else {
    const invalidTopics = selectedTopics.filter(t => !NOTICE_TOPICS[t.toUpperCase()]);
    if (invalidTopics.length > 0) {
      warnings.push(`Unrecognized topic codes ignored: ${invalidTopics.join(', ')}`);
    }
  }

  // Contact channel
  if (!subData.email && !subData.mobile) {
    errors.push('Either an email address or mobile number is required for dispatch.');
  }

  const frequency = Object.values(DIGEST_FREQUENCIES).find(
    f => f.id === (subData.frequency || 'daily').toLowerCase()
  ) || DIGEST_FREQUENCIES.DAILY;

  return {
    isValid: errors.length === 0,
    frequency,
    errors,
    warnings,
    sanitizedSubscription: {
      municipality: subData.municipality ? subData.municipality.trim() : '',
      ward: subData.ward ? subData.ward.toString().trim() : '',
      topics: selectedTopics.filter(t => NOTICE_TOPICS[t.toUpperCase()]),
      frequency: frequency.id,
      subscribedAt: new Date().toISOString()
    }
  };
}

/**
 * Filters a corpus of civic notices based on subscription criteria and handles amendments.
 * @param {Array<Object>} noticeCorpus 
 * @param {Object} subscriptionCriteria 
 * @returns {Object} filteredNotices
 */
export function matchNoticesForSubscription(noticeCorpus = [], subscriptionCriteria = {}) {
  const targetMunicipality = (subscriptionCriteria.municipality || '').toLowerCase();
  const targetWard = (subscriptionCriteria.ward || '').toString().toLowerCase();
  const targetTopics = (subscriptionCriteria.topics || []).map(t => t.toLowerCase());

  const activeNotices = [];
  const supersededNotices = [];
  const corrigenda = [];

  noticeCorpus.forEach(notice => {
    const matchesMun = !targetMunicipality || (notice.municipality && notice.municipality.toLowerCase().includes(targetMunicipality));
    const matchesWard = !targetWard || (notice.ward && notice.ward.toString().toLowerCase() === targetWard) || notice.ward === 'ALL';
    const matchesTopic = targetTopics.length === 0 || (notice.topic && targetTopics.includes(notice.topic.toLowerCase()));

    if (matchesMun && matchesWard && matchesTopic) {
      if (notice.isSuperseded) {
        supersededNotices.push(notice);
      } else if (notice.noticeType === 'CORRIGENDUM') {
        corrigenda.push(notice);
      } else {
        activeNotices.push(notice);
      }
    }
  });

  return {
    totalMatches: activeNotices.length + corrigenda.length,
    activeNotices,
    corrigenda,
    supersededNotices
  };
}

/**
 * Generates formatted digest markdown preview for the citizen.
 * @param {Object} subscription 
 * @param {Array<Object>} matchedNotices 
 * @returns {string} digestPreview
 */
export function formatNoticeDigest(subscription = {}, matchedNotices = []) {
  const result = matchNoticesForSubscription(matchedNotices, subscription);

  return [
    `# Civic Public Notice Digest: Ward ${subscription.ward || 'All'} (${subscription.municipality || 'Urban Local Body'})`,
    `**Frequency:** ${subscription.frequency || 'Daily'}`,
    `**Active Notices:** ${result.activeNotices.length}`,
    `**Corrigenda / Revisions:** ${result.corrigenda.length}`,
    `**Superseded / Withdrawn Notices:** ${result.supersededNotices.length}`,
    ``,
    `## Active Notices`,
    ...(result.activeNotices.length > 0
      ? result.activeNotices.map(n => `- **[${n.noticeNumber || 'Notice'}] ${n.title}**\n  Published: ${n.publishedDate || 'N/A'} | Topic: ${n.topic}\n  ${n.summary || ''}`)
      : ['No new notices in this period.']),
    ...(result.corrigenda.length > 0 ? [``, `## Important Corrigenda & Date Amendments`, ...result.corrigenda.map(c => `- **⚠️ [AMENDMENT: ${c.noticeNumber}]** ${c.title}: Refers to original notice #${c.supersedesNoticeNumber || 'N/A'}`)] : []),
    ``,
    `---`,
    `*To update topics or unsubscribe in 1 click, visit your subscription preferences.*`
  ].join('\n');
}

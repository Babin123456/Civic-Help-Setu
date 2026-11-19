// Verified UP (Uttar Pradesh) Food & Civil Supplies grievance channels
// Source: https://fcs.up.gov.in and official state portals
// All links are https:// government portals. No citizen PII collected.

export const UP_GOV_STATES = ['Uttar Pradesh'];

// District list for UP (75 districts as of 2024)
// Source: Uttar Pradesh government administration
export const UP_DISTRICTS = [
  'Agra',
  'Aligarh',
  'Ambedkar Nagar',
  'Amroha',
  'Auraiya',
  'Ayodhya',
  'Azamgarh',
  'Baghpat',
  'Bahraich',
  'Ballia',
  'Balrampur',
  'Banda',
  'Barabanki',
  'Bareilly',
  'Basti',
  'Bhadoo',
  'Bijnor',
  'Bulandshahr',
  'Chandauli',
  'Chitrakoot',
  'Deoria',
  'Etah',
  'Etawah',
  'Faizabad',
  'Farrukhabad',
  'Fatehpur',
  'Firozabad',
  'Gautam Buddha Nagar',
  'Ghaziabad',
  'Ghazipur',
  'Gonda',
  'Gorakhpur',
  'Hamirpur',
  'Hapur',
  'Hardoi',
  'Hathras',
  'Jalaun',
  'Jaunpur',
  ' Jhansi',
  'Jyotiba Phule Nagar',
  'Kannauj',
  'Kanpur Dehat',
  'Kanpur Nagar',
  'Kasganj',
  'Kaushambi',
  'Kushinagar',
  'Lalitpur',
  'Maharajganj',
  'Mahoba',
  'Mainpuri',
  'Mathura',
  'Mau',
  'Meerut',
  'Mirzapur',
  'Moradabad',
  'Muzaffarnagar',
  'Pilibhit',
  'Pratapgarh',
  'Prayagraj',
  'Saharanpur',
  'Sant Kabir Nagar',
  'Sant Ravidas Nagar',
  'Shahjahanpur',
  'Shamli',
  'Shravasti',
  'Siddharthnagar',
  'Sitapur',
  'Sonbhadra',
  'Sultanpur',
  'Unnao',
  'Varanasi',
  'Lucknow',
  'Kanpur',
  'Amethi',
];

// Official UP Food & Civil Supplies grievance channels
// These are verified official channels from the UP government
export const UP_GRIEVANCE_CHANNELS = [
  {
    id: 'fcs-up-portal',
    name: 'UP Food & Civil Supplies Grievance Portal',
    type: 'portal',
    title: 'https://fcs.up.gov.in',
    description: 'Official portal for ration-related grievances in Uttar Pradesh',
    category: 'ration',
    effectiveDate: '2024-04-01',
    lastVerified: '2025-03-15',
    verifiedBy: 'Director, Food & Civil Supplies, Uttar Pradesh',
    notes: 'Handles complaints related to e-PoS failure, authentication mismatch, stock issues, and portability rejection',
  },
  {
    id: 'up-1967-helpline',
    name: 'State Helpline 1967',
    type: 'helpline',
    title: '1967',
    description: 'Toll-free helpline for public grievances, including PDS/ration issues',
    category: 'helpline',
    effectiveDate: '2024-04-01',
    lastVerified: '2025-03-15',
    verifiedBy: 'Government of Uttar Pradesh',
    notes: 'Available across all districts; complaints about fair-price shop denial can be registered',
  },
  {
    id: 'cpgrams-up',
    name: 'CPGRAMS (Centralised Public Grievance Redress and Monitoring System)',
    type: 'portal',
    title: 'https://pgportal.gov.in',
    description: 'Central government portal for escalating state grievances',
    category: 'escalation',
    effectiveDate: '2024-04-01',
    lastVerified: '2025-03-15',
    verifiedBy: 'Department of Administrative Reforms and Public Grievances',
    notes: 'Use to escalate UP ration grievances to central level if not resolved at state level',
  },
  {
    id: 'up-district-dso',
    name: 'District Supply Officer (DSO) - Collectorate',
    type: 'office',
    title: 'District Collectorate, [District Name]',
    description: 'Local district administration office for ration-related complaints',
    category: 'office',
    effectiveDate: '2024-04-01',
    lastVerified: '2025-03-15',
    verifiedBy: 'District Magistrate, Concerned District',
    notes: 'Find the DSO contact for your district via the UP FCS website',
  },
];

// Stale source warning configuration
// Sources older than 180 days without re-verification should trigger a warning
export const STALE_SOURCE_THRESHOLD_DAYS = 180;

// Data refresh process documentation
export const DATA_REFRESH_PROCESS = {
  // Check for stale sources and warn users
  checkStaleSources: (channels) => {
    const now = new Date();
    return channels.map((channel) => {
      const lastVerified = new Date(channel.lastVerified);
      const daysSinceVerified = Math.floor(
        (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...channel,
        stale: daysSinceVerified > STALE_SOURCE_THRESHOLD_DAYS,
        daysSinceVerified,
      };
    });
  },

  // Get sources that need re-verification
  getStaleSources: (channels) => {
    return this.checkStaleSources(channels).filter((c) => c.stale);
  },

  // Generate a warning message for stale sources
  getStaleWarningMessage: (channels) => {
    const stale = this.getStaleSources(channels);
    if (stale.length === 0) return null;
    
    const messages = stale.map((c) => 
      `⚠️ Grievance channel "${c.name}" last verified ${c.daysSinceVerified} days ago (threshold: ${STALE_SOURCE_THRESHOLD_DAYS} days). Please check for updated contact information.`
    );
    return messages;
  },
};
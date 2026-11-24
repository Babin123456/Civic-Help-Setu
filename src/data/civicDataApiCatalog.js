export const CIVIC_DATA_API_VERSION = 'v1';

export const DATASET_IDS = {
  SERVICE_LOCATIONS: 'service-locations',
  PUBLIC_NOTICES: 'public-notices',
  WARD_METRICS: 'ward-metrics',
};

export const DATASET_CATEGORIES = {
  DIRECTORY: 'service_directory',
  NOTICES: 'public_notices',
  AGGREGATES: 'ward_aggregates',
};

const LOCATION_SEED = [
  { state: 'Delhi', district: 'New Delhi', ward: 'Ward 04 - Connaught Place', name: 'Connaught Place Citizen Service Centre', department: 'Department of Revenue', category: 'citizen_service_centre', address: 'Block A, Palika Bhavan, Connaught Place', timings: 'Mon-Fri 09:30-17:00', officialUrl: 'https://edistrict.delhi.gov.in/' },
  { state: 'Delhi', district: 'South Delhi', ward: 'Ward 12 - Hauz Khas', name: 'Hauz Khas Municipal Service Counter', department: 'Municipal Corporation of Delhi', category: 'municipal_office', address: 'Aurobindo Marg, Hauz Khas', timings: 'Mon-Sat 10:00-16:00', officialUrl: 'https://mcdonline.nic.in/' },
  { state: 'Delhi', district: 'West Delhi', ward: 'Ward 21 - Rajouri Garden', name: 'Rajouri Garden Ration Card Office', department: 'Department of Food and Civil Supplies', category: 'pds_office', address: 'Najafgarh Road, Rajouri Garden', timings: 'Mon-Fri 10:00-17:00', officialUrl: 'https://nfs.delhi.gov.in/' },
  { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 80 - Indiranagar', name: 'Indiranagar Ward Office', department: 'Bruhat Bengaluru Mahanagara Palike', category: 'ward_office', address: '100 Feet Road, Indiranagar', timings: 'Mon-Sat 09:00-17:30', officialUrl: 'https://bbmp.gov.in/' },
  { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 76 - Koramangala', name: 'Koramangala Revenue Service Centre', department: 'Department of Revenue', category: 'citizen_service_centre', address: '80 Feet Road, Koramangala', timings: 'Mon-Fri 10:00-17:00', officialUrl: 'https://nadakacheri.karnataka.gov.in/' },
  { state: 'Karnataka', district: 'Mysuru', ward: 'Ward 18 - Kuvempunagar', name: 'Kuvempunagar Civic Service Centre', department: 'Mysuru City Corporation', category: 'municipal_office', address: 'Kantharaja Urs Road, Kuvempunagar', timings: 'Mon-Sat 10:00-17:00', officialUrl: 'https://mysurucity.mrc.gov.in/' },
  { state: 'Tamil Nadu', district: 'Chennai', ward: 'Ward 63 - Adyar', name: 'Adyar Zonal Office', department: 'Greater Chennai Corporation', category: 'zonal_office', address: 'Sastri Nagar, Adyar', timings: 'Mon-Fri 09:45-17:30', officialUrl: 'https://chennaicorporation.gov.in/' },
  { state: 'Tamil Nadu', district: 'Chennai', ward: 'Ward 110 - Mylapore', name: 'Mylapore Taluk Revenue Office', department: 'Tamil Nadu Revenue Department', category: 'revenue_office', address: 'Kutchery Road, Mylapore', timings: 'Mon-Fri 10:00-17:45', officialUrl: 'https://tnedistrict.tn.gov.in/' },
  { state: 'Tamil Nadu', district: 'Coimbatore', ward: 'Ward 24 - Gandhipuram', name: 'Gandhipuram Service Centre', department: 'Coimbatore City Municipal Corporation', category: 'citizen_service_centre', address: 'Cross Cut Road, Gandhipuram', timings: 'Mon-Sat 09:30-17:30', officialUrl: 'https://ccmc.gov.in/' },
  { state: 'Maharashtra', district: 'Mumbai Suburban', ward: 'Ward K/E - Andheri East', name: 'Andheri East Ward Office', department: 'Brihanmumbai Municipal Corporation', category: 'ward_office', address: 'MIDC Central Road, Andheri East', timings: 'Mon-Sat 09:00-17:00', officialUrl: 'https://portal.mcgm.gov.in/' },
  { state: 'Maharashtra', district: 'Pune', ward: 'Ward 09 - Kothrud', name: 'Kothrud Citizen Facilitation Centre', department: 'Pune Municipal Corporation', category: 'citizen_service_centre', address: 'Paud Road, Kothrud', timings: 'Mon-Fri 10:00-18:00', officialUrl: 'https://pmc.gov.in/' },
  { state: 'Telangana', district: 'Hyderabad', ward: 'Ward 15 - Secunderabad', name: 'Secunderabad MeeSeva Centre', department: 'Telangana IT, Electronics and Communications Department', category: 'citizen_service_centre', address: 'Sardar Patel Road, Secunderabad', timings: 'Mon-Sat 08:30-18:30', officialUrl: 'https://ts.meeseva.telangana.gov.in/' },
  { state: 'Telangana', district: 'Hyderabad', ward: 'Ward 07 - Charminar', name: 'Charminar Zonal Office', department: 'Greater Hyderabad Municipal Corporation', category: 'zonal_office', address: 'Shalibanda Road, Charminar', timings: 'Mon-Fri 10:00-17:00', officialUrl: 'https://www.ghmc.gov.in/' },
  { state: 'West Bengal', district: 'Kolkata', ward: 'Ward 62 - Ballygunge', name: 'Ballygunge Borough Office', department: 'Kolkata Municipal Corporation', category: 'borough_office', address: 'Rashbehari Avenue, Ballygunge', timings: 'Mon-Fri 10:00-17:00', officialUrl: 'https://www.kmcgov.in/' },
  { state: 'Gujarat', district: 'Ahmedabad', ward: 'Ward 07 - Navrangpura', name: 'Navrangpura Civic Centre', department: 'Ahmedabad Municipal Corporation', category: 'citizen_service_centre', address: 'Ashram Road, Navrangpura', timings: 'Mon-Sat 09:30-17:30', officialUrl: 'https://ahmedabadcity.gov.in/' },
  { state: 'Rajasthan', district: 'Jaipur', ward: 'Ward 34 - Mansarovar', name: 'Mansarovar Ward Office', department: 'Jaipur Municipal Corporation', category: 'ward_office', address: 'Shipra Path, Mansarovar', timings: 'Mon-Fri 10:00-17:00', officialUrl: 'https://jaipurmc.org/' },
  { state: 'Kerala', district: 'Ernakulam', ward: 'Ward 31 - Edappally', name: 'Edappally Service Centre', department: 'Kochi Municipal Corporation', category: 'citizen_service_centre', address: 'Edappally Junction, Kochi', timings: 'Mon-Sat 09:30-17:00', officialUrl: 'https://kochicorporation.lsgkerala.gov.in/' },
  { state: 'Madhya Pradesh', district: 'Indore', ward: 'Ward 45 - Vijay Nagar', name: 'Vijay Nagar Ward Office', department: 'Indore Municipal Corporation', category: 'ward_office', address: 'AB Road, Vijay Nagar', timings: 'Mon-Sat 10:00-17:30', officialUrl: 'https://www.imcindore.org/' },
];

export const SERVICE_LOCATION_ROWS = Object.freeze(
  LOCATION_SEED.map((row, index) => Object.freeze({
    id: `loc_${String(index + 1).padStart(3, '0')}`,
    ...row,
    lastVerifiedAt: '2026-10-15T00:00:00.000Z',
  }))
);

const NOTICE_SEED = [
  { state: 'Delhi', district: 'All', title: 'Revision of income certificate validity period', department: 'Department of Revenue', category: 'rule_amendment', issuedAt: '2026-10-02', effectiveAt: '2026-11-01', summary: 'Income certificates issued through the e-district portal remain valid for three financial years.', sourceUrl: 'https://edistrict.delhi.gov.in/' },
  { state: 'Delhi', district: 'All', title: 'Extended counter hours for property tax collection', department: 'Municipal Corporation of Delhi', category: 'office_notice', issuedAt: '2026-09-18', effectiveAt: '2026-10-01', summary: 'Selected citizen service counters remain open until 19:00 on weekdays during the collection window.', sourceUrl: 'https://mcdonline.nic.in/' },
  { state: 'Karnataka', district: 'Bengaluru Urban', title: 'Ward-level grievance review schedule for November 2026', department: 'Bruhat Bengaluru Mahanagara Palike', category: 'office_notice', issuedAt: '2026-10-20', effectiveAt: '2026-11-01', summary: 'Ward committees publish the public grievance review schedule for the November cycle.', sourceUrl: 'https://bbmp.gov.in/' },
  { state: 'Karnataka', district: 'All', title: 'Revision of Sakala service timelines', department: 'Department of Personnel and Administrative Reforms', category: 'rule_amendment', issuedAt: '2026-08-11', effectiveAt: '2026-09-01', summary: 'Published service timelines are revised for selected revenue and municipal services under Sakala.', sourceUrl: 'https://sakala.karnataka.gov.in/' },
  { state: 'Tamil Nadu', district: 'Chennai', title: 'Chennai trade licence renewal grace period', department: 'Greater Chennai Corporation', category: 'deadline_extension', issuedAt: '2026-09-25', effectiveAt: '2026-10-01', summary: 'A 30-day grace period applies to trade licence renewals without a late fee.', sourceUrl: 'https://chennaicorporation.gov.in/' },
  { state: 'Tamil Nadu', district: 'All', title: 'Revision of encumbrance certificate fee', department: 'Tamil Nadu Registration Department', category: 'fee_revision', issuedAt: '2026-07-14', effectiveAt: '2026-08-01', summary: 'The fee schedule for encumbrance certificate searches is revised for online applications.', sourceUrl: 'https://tnreginet.gov.in/' },
  { state: 'Maharashtra', district: 'Mumbai Suburban', title: 'Andheri East ward office relocation notice', department: 'Brihanmumbai Municipal Corporation', category: 'office_notice', issuedAt: '2026-10-05', effectiveAt: '2026-10-15', summary: 'Public counters move to the annex building while the main ward office is renovated.', sourceUrl: 'https://portal.mcgm.gov.in/' },
  { state: 'Maharashtra', district: 'All', title: 'Property tax rebate period announcement', department: 'Urban Development Department', category: 'deadline_extension', issuedAt: '2026-08-30', effectiveAt: '2026-09-15', summary: 'Eligible property tax payers receive a rebate when payment is completed in the announced window.', sourceUrl: 'https://maharashtra.gov.in/' },
  { state: 'Telangana', district: 'Hyderabad', title: 'MeeSeva service list update', department: 'Telangana IT, Electronics and Communications Department', category: 'rule_amendment', issuedAt: '2026-10-10', effectiveAt: '2026-11-01', summary: 'The MeeSeva service list adds new certificate correction workflows and retires two legacy forms.', sourceUrl: 'https://ts.meeseva.telangana.gov.in/' },
  { state: 'Gujarat', district: 'Ahmedabad', title: 'Ahmedabad civic centre weekly closure', department: 'Ahmedabad Municipal Corporation', category: 'office_notice', issuedAt: '2026-09-05', effectiveAt: '2026-09-12', summary: 'Selected civic centres close on the second Saturday of each month for staff training.', sourceUrl: 'https://ahmedabadcity.gov.in/' },
  { state: 'West Bengal', district: 'Kolkata', title: 'Kolkata building plan submission window', department: 'Kolkata Municipal Corporation', category: 'deadline_extension', issuedAt: '2026-08-22', effectiveAt: '2026-09-01', summary: 'An extended submission window applies to pending building plan applications.', sourceUrl: 'https://www.kmcgov.in/' },
  { state: 'Rajasthan', district: 'Jaipur', title: 'Jaipur ward boundary clarification', department: 'Jaipur Municipal Corporation', category: 'gazette_order', issuedAt: '2026-07-30', effectiveAt: '2026-08-15', summary: 'A gazette clarification lists ward boundaries for service counters and grievance routing.', sourceUrl: 'https://jaipurmc.org/' },
  { state: 'Kerala', district: 'Ernakulam', title: 'Kochi online permit acceptance update', department: 'Kochi Municipal Corporation', category: 'rule_amendment', issuedAt: '2026-10-12', effectiveAt: '2026-10-20', summary: 'Online permit submissions now accept digitally signed documents from approved providers.', sourceUrl: 'https://kochicorporation.lsgkerala.gov.in/' },
  { state: 'Madhya Pradesh', district: 'Indore', title: 'Indore ward service camp calendar', department: 'Indore Municipal Corporation', category: 'office_notice', issuedAt: '2026-09-28', effectiveAt: '2026-10-05', summary: 'Public service camps are scheduled across selected wards during the month.', sourceUrl: 'https://www.imcindore.org/' },
  { state: 'All', district: 'All', title: 'National e-governance service standards reminder', department: 'Ministry of Electronics and Information Technology', category: 'gazette_order', issuedAt: '2026-06-15', effectiveAt: '2026-07-01', summary: 'A reminder on citizen service standards and public grievance acknowledgement timelines.', sourceUrl: 'https://www.meity.gov.in/' },
];

export const PUBLIC_NOTICE_ROWS = Object.freeze(
  NOTICE_SEED.map((row, index) => Object.freeze({
    id: `notice_${String(index + 1).padStart(3, '0')}`,
    ...row,
    lastVerifiedAt: '2026-10-22T00:00:00.000Z',
  }))
);

const WARD_METRIC_SEED = [
  { state: 'Delhi', district: 'New Delhi', ward: 'Ward 04 - Connaught Place', metric: 'applications_received', value: 1840, unit: 'applications', period: '2026-10' },
  { state: 'Delhi', district: 'New Delhi', ward: 'Ward 04 - Connaught Place', metric: 'grievances_resolved', value: 412, unit: 'grievances', period: '2026-10' },
  { state: 'Delhi', district: 'New Delhi', ward: 'Ward 04 - Connaught Place', metric: 'avg_resolution_days', value: 6.4, unit: 'days', period: '2026-10' },
  { state: 'Delhi', district: 'South Delhi', ward: 'Ward 12 - Hauz Khas', metric: 'applications_received', value: 2210, unit: 'applications', period: '2026-10' },
  { state: 'Delhi', district: 'South Delhi', ward: 'Ward 12 - Hauz Khas', metric: 'grievances_resolved', value: 388, unit: 'grievances', period: '2026-10' },
  { state: 'Delhi', district: 'South Delhi', ward: 'Ward 12 - Hauz Khas', metric: 'avg_resolution_days', value: 8.1, unit: 'days', period: '2026-10' },
  { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 80 - Indiranagar', metric: 'applications_received', value: 3180, unit: 'applications', period: '2026-10' },
  { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 80 - Indiranagar', metric: 'grievances_resolved', value: 905, unit: 'grievances', period: '2026-10' },
  { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 80 - Indiranagar', metric: 'avg_resolution_days', value: 4.7, unit: 'days', period: '2026-10' },
  { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 76 - Koramangala', metric: 'applications_received', value: 2960, unit: 'applications', period: '2026-10' },
  { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 76 - Koramangala', metric: 'grievances_resolved', value: 811, unit: 'grievances', period: '2026-10' },
  { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 76 - Koramangala', metric: 'avg_resolution_days', value: 5.2, unit: 'days', period: '2026-10' },
  { state: 'Tamil Nadu', district: 'Chennai', ward: 'Ward 63 - Adyar', metric: 'applications_received', value: 1725, unit: 'applications', period: '2026-10' },
  { state: 'Tamil Nadu', district: 'Chennai', ward: 'Ward 63 - Adyar', metric: 'grievances_resolved', value: 506, unit: 'grievances', period: '2026-10' },
  { state: 'Tamil Nadu', district: 'Chennai', ward: 'Ward 63 - Adyar', metric: 'avg_resolution_days', value: 5.9, unit: 'days', period: '2026-10' },
  { state: 'Tamil Nadu', district: 'Chennai', ward: 'Ward 110 - Mylapore', metric: 'applications_received', value: 1490, unit: 'applications', period: '2026-10' },
  { state: 'Tamil Nadu', district: 'Chennai', ward: 'Ward 110 - Mylapore', metric: 'grievances_resolved', value: 433, unit: 'grievances', period: '2026-10' },
  { state: 'Tamil Nadu', district: 'Chennai', ward: 'Ward 110 - Mylapore', metric: 'avg_resolution_days', value: 7.3, unit: 'days', period: '2026-10' },
  { state: 'Maharashtra', district: 'Pune', ward: 'Ward 09 - Kothrud', metric: 'applications_received', value: 2015, unit: 'applications', period: '2026-10' },
  { state: 'Maharashtra', district: 'Pune', ward: 'Ward 09 - Kothrud', metric: 'grievances_resolved', value: 611, unit: 'grievances', period: '2026-10' },
  { state: 'Maharashtra', district: 'Pune', ward: 'Ward 09 - Kothrud', metric: 'avg_resolution_days', value: 4.2, unit: 'days', period: '2026-10' },
  { state: 'Telangana', district: 'Hyderabad', ward: 'Ward 15 - Secunderabad', metric: 'applications_received', value: 2560, unit: 'applications', period: '2026-10' },
  { state: 'Telangana', district: 'Hyderabad', ward: 'Ward 15 - Secunderabad', metric: 'grievances_resolved', value: 720, unit: 'grievances', period: '2026-10' },
  { state: 'Telangana', district: 'Hyderabad', ward: 'Ward 15 - Secunderabad', metric: 'avg_resolution_days', value: 6.8, unit: 'days', period: '2026-10' },
];

export const WARD_METRIC_ROWS = Object.freeze(
  WARD_METRIC_SEED.map((row, index) => Object.freeze({
    id: `metric_${String(index + 1).padStart(3, '0')}`,
    ...row,
    sourceUpdatedAt: '2026-10-31T00:00:00.000Z',
  }))
);

const SERVICE_LOCATION_FIELDS = [
  { name: 'id', type: 'string', required: true, public: true, maxLength: 32, description: 'Stable dataset identifier' },
  { name: 'name', type: 'string', required: true, public: true, maxLength: 120, description: 'Published service location name' },
  { name: 'department', type: 'string', required: true, public: true, maxLength: 120, description: 'Responsible public department' },
  { name: 'category', type: 'enum', required: true, public: true, values: ['citizen_service_centre', 'municipal_office', 'ward_office', 'zonal_office', 'revenue_office', 'pds_office', 'borough_office'] },
  { name: 'state', type: 'string', required: true, public: true, maxLength: 60 },
  { name: 'district', type: 'string', required: true, public: true, maxLength: 60 },
  { name: 'ward', type: 'string', required: true, public: true, maxLength: 80 },
  { name: 'address', type: 'string', required: true, public: true, maxLength: 180 },
  { name: 'timings', type: 'string', required: true, public: true, maxLength: 80 },
  { name: 'officialUrl', type: 'url', required: true, public: true, maxLength: 300 },
  { name: 'lastVerifiedAt', type: 'date', required: true, public: true },
];

const PUBLIC_NOTICE_FIELDS = [
  { name: 'id', type: 'string', required: true, public: true, maxLength: 32 },
  { name: 'title', type: 'string', required: true, public: true, maxLength: 160 },
  { name: 'department', type: 'string', required: true, public: true, maxLength: 120 },
  { name: 'category', type: 'enum', required: true, public: true, values: ['rule_amendment', 'deadline_extension', 'fee_revision', 'gazette_order', 'office_notice'] },
  { name: 'state', type: 'string', required: true, public: true, maxLength: 60 },
  { name: 'district', type: 'string', required: true, public: true, maxLength: 60 },
  { name: 'issuedAt', type: 'date', required: true, public: true },
  { name: 'effectiveAt', type: 'date', required: true, public: true },
  { name: 'summary', type: 'string', required: true, public: true, maxLength: 600 },
  { name: 'sourceUrl', type: 'url', required: true, public: true, maxLength: 300 },
  { name: 'lastVerifiedAt', type: 'date', required: true, public: true },
];

const WARD_METRIC_FIELDS = [
  { name: 'id', type: 'string', required: true, public: true, maxLength: 32 },
  { name: 'state', type: 'string', required: true, public: true, maxLength: 60 },
  { name: 'district', type: 'string', required: true, public: true, maxLength: 60 },
  { name: 'ward', type: 'string', required: true, public: true, maxLength: 80 },
  { name: 'metric', type: 'enum', required: true, public: true, values: ['applications_received', 'grievances_resolved', 'avg_resolution_days'] },
  { name: 'value', type: 'number', required: true, public: true, min: 0, max: 1000000 },
  { name: 'unit', type: 'string', required: true, public: true, maxLength: 24 },
  { name: 'period', type: 'string', required: true, public: true, maxLength: 12, format: 'YYYY-MM' },
  { name: 'sourceUpdatedAt', type: 'date', required: true, public: true },
];

export const DATASET_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: DATASET_IDS.SERVICE_LOCATIONS,
    name: 'Municipal Service Locations',
    version: 'v1',
    schemaVersion: 1,
    category: DATASET_CATEGORIES.DIRECTORY,
    status: 'approved',
    description: 'Approved public service counters, ward offices and revenue offices with official source links and verification dates.',
    owner: 'Civic Help Setu Data Office',
    dataClassification: 'public_directory',
    dataSource: 'Synthetic fixture v1 for sandbox; approved public directory for production',
    license: 'CC-BY-4.0',
    retentionDays: 365,
    defaultPageSize: 10,
    maxPageSize: 50,
    dailyQuota: { sandbox: 250, production: 5000 },
    requestsPerMinute: { sandbox: 30, production: 120 },
    sortField: 'id',
    searchFields: ['name', 'department', 'address', 'ward', 'district'],
    filterFields: ['state', 'district', 'ward', 'category', 'q'],
    publicFields: SERVICE_LOCATION_FIELDS.filter((field) => field.public).map((field) => field.name),
    lastReviewedAt: '2026-10-20T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    createdBy: 'data-office',
  }),
  Object.freeze({
    id: DATASET_IDS.PUBLIC_NOTICES,
    name: 'Public Notices',
    version: 'v1',
    schemaVersion: 1,
    category: DATASET_CATEGORIES.NOTICES,
    status: 'approved',
    description: 'Reviewed public notices, rule amendments, fee revisions and deadline extensions linked to an official source.',
    owner: 'Civic Help Setu Notices Desk',
    dataClassification: 'public_notice',
    dataSource: 'Synthetic fixture v1 for sandbox; approved notice digest for production',
    license: 'CC-BY-4.0',
    retentionDays: 730,
    defaultPageSize: 10,
    maxPageSize: 50,
    dailyQuota: { sandbox: 250, production: 5000 },
    requestsPerMinute: { sandbox: 30, production: 120 },
    sortField: 'id',
    searchFields: ['title', 'department', 'summary', 'district'],
    filterFields: ['state', 'district', 'category', 'issuedAfter', 'issuedBefore', 'q'],
    publicFields: PUBLIC_NOTICE_FIELDS.filter((field) => field.public).map((field) => field.name),
    lastReviewedAt: '2026-10-22T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    createdBy: 'notices-desk',
  }),
  Object.freeze({
    id: DATASET_IDS.WARD_METRICS,
    name: 'Ward-Level Aggregate Metrics',
    version: 'v1',
    schemaVersion: 1,
    category: DATASET_CATEGORIES.AGGREGATES,
    status: 'approved',
    description: 'Ward-level counts and averages only. No application, grievance or citizen-level records are exposed.',
    owner: 'Civic Help Setu Analytics Office',
    dataClassification: 'aggregate_only',
    dataSource: 'Synthetic fixture v1 for sandbox; aggregated ward reporting for production',
    license: 'CC-BY-4.0',
    retentionDays: 1095,
    defaultPageSize: 12,
    maxPageSize: 60,
    dailyQuota: { sandbox: 250, production: 5000 },
    requestsPerMinute: { sandbox: 30, production: 120 },
    sortField: 'id',
    searchFields: ['ward', 'district', 'metric'],
    filterFields: ['state', 'district', 'ward', 'metric', 'period', 'q'],
    publicFields: WARD_METRIC_FIELDS.filter((field) => field.public).map((field) => field.name),
    lastReviewedAt: '2026-10-31T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-31T00:00:00.000Z',
    createdBy: 'analytics-office',
  }),
]);

export const SCHEMA_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: `${DATASET_IDS.SERVICE_LOCATIONS}@v1`,
    datasetId: DATASET_IDS.SERVICE_LOCATIONS,
    version: 'v1',
    schemaVersion: 1,
    status: 'active',
    compatibility: 'backward_compatible',
    fields: SERVICE_LOCATION_FIELDS,
    createdAt: '2026-09-01T00:00:00.000Z',
  }),
  Object.freeze({
    id: `${DATASET_IDS.PUBLIC_NOTICES}@v1`,
    datasetId: DATASET_IDS.PUBLIC_NOTICES,
    version: 'v1',
    schemaVersion: 1,
    status: 'active',
    compatibility: 'backward_compatible',
    fields: PUBLIC_NOTICE_FIELDS,
    createdAt: '2026-09-01T00:00:00.000Z',
  }),
  Object.freeze({
    id: `${DATASET_IDS.WARD_METRICS}@v1`,
    datasetId: DATASET_IDS.WARD_METRICS,
    version: 'v1',
    schemaVersion: 1,
    status: 'active',
    compatibility: 'backward_compatible',
    fields: WARD_METRIC_FIELDS,
    createdAt: '2026-09-01T00:00:00.000Z',
  }),
]);

export const DATASET_ROWS = Object.freeze({
  [DATASET_IDS.SERVICE_LOCATIONS]: SERVICE_LOCATION_ROWS,
  [DATASET_IDS.PUBLIC_NOTICES]: PUBLIC_NOTICE_ROWS,
  [DATASET_IDS.WARD_METRICS]: WARD_METRIC_ROWS,
});

export const SANDBOX_DATASET_ROWS = DATASET_ROWS;

import { INDIAN_STATES_AND_UTS } from './jurisdictions.js';

export const EMERGENCY_PACK_VERSION = '1.0.0';

export const EMERGENCY_PACK_META = {
  version: EMERGENCY_PACK_VERSION,
  lastUpdated: new Date().toISOString(),
  reviewCycleMonths: 6,
};

export const EMERGENCY_CONTACTS_NATIONAL = [
  {
    id: 'national-emergency-112',
    name: 'National Emergency Response Support System (ERSS)',
    number: '112',
    category: 'All-in-One Emergency',
    description:
      'Single unified 24x7 emergency number for Police, Fire, and Ambulance across all States and Union Territories in India.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#ef4444',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'cybercrime-1930',
    name: 'National Cybercrime Financial Fraud Helpline',
    number: '1930',
    category: 'Cyber & Financial Fraud',
    description:
      'Citizen Financial Cyber Fraud Reporting System to instantly freeze unauthorized bank and UPI transactions within golden hours.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#8b5cf6',
    sourceUrl: 'https://cybercrime.gov.in',
  },
  {
    id: 'women-distress-1091',
    name: 'Women in Distress Helpline',
    number: '1091',
    category: 'Women Safety',
    description:
      'National Commission for Women round-the-clock emergency assistance, domestic violence reporting, and police dispatch.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#ec4899',
    sourceUrl: 'https://ncw.gov.in',
  },
  {
    id: 'women-helpline-181',
    name: 'Women Helpline (Domestic Violence & Abuse)',
    number: '181',
    category: 'Women Safety',
    description:
      'Toll-free 24-hour telecom service providing integrated support, rescue, medical aid, and counseling to women affected by violence.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#ec4899',
    sourceUrl: 'https://wcd.nic.in',
  },
  {
    id: 'childline-1098',
    name: 'CHILDLINE India (Child Abuse & Protection)',
    number: '1098',
    category: 'Child Welfare',
    description:
      'Emergency rescue and support service for children in need of care, protection from abuse, or missing child tracing.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#f59e0b',
    sourceUrl: 'https://childlineindia.org',
  },
  {
    id: 'medical-ambulance-108',
    name: 'Emergency Medical & Ambulance Service',
    number: '108',
    category: 'Medical & Health',
    description:
      'Free emergency ambulance dispatch, accident trauma response, and critical medical transport.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#10b981',
    sourceUrl: 'https://nhm.gov.in',
  },
  {
    id: 'senior-citizens-14567',
    name: 'Elder Line (National Helpline for Senior Citizens)',
    number: '14567',
    category: 'Senior Citizens',
    description:
      'Support against elder abuse, rescue of abandoned seniors, emotional support, and legal guidance under Ministry of Social Justice.',
    timing: '8:00 AM - 8:00 PM',
    tollFree: true,
    badgeColor: '#3b82f6',
    sourceUrl: 'https://sjcow.gov.in',
  },
  {
    id: 'disaster-management-1070',
    name: 'National Disaster Management Authority (NDMA)',
    number: '1070',
    category: 'Disaster Relief',
    description:
      'Central control room for flood, cyclone, earthquake, and extreme weather disaster relief and rescue coordination.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#f97316',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'mental-health-kiran',
    name: 'KIRAN Mental Health Rehabilitation Helpline',
    number: '1800-599-0019',
    category: 'Mental Health',
    description:
      'Toll-free 24x7 psychological first-aid, crisis intervention, distress management, and suicide prevention counseling in 13 languages.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#06b6d4',
    sourceUrl: 'https://mohfw.gov.in',
  },
  {
    id: 'anti-corruption-1064',
    name: 'Anti-Corruption Bureau (Bribe Reporting)',
    number: '1064',
    category: 'Anti-Corruption',
    description:
      'Toll-free vigilance line to report government officers demanding bribes or illegal gratification for public services.',
    timing: '10:00 AM - 6:00 PM',
    tollFree: true,
    badgeColor: '#6366f1',
    sourceUrl: 'https://vigilance.gov.in',
  },
];

const createStatePack = (stateName) => ({
  state: stateName,
  published: new Date().toISOString(),
  expires: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 6 months
  lastReviewed: new Date().toISOString(),
  sourceUrl: 'https://ndma.gov.in',

  nationalHelplines: EMERGENCY_CONTACTS_NATIONAL,

  districtContacts: {},

  preparednessChecklist: {
    emergencyKitEssentials: [
      {
        id: 'water',
        item: 'Drinking water (minimum 3 liters per person)',
        essential: true,
      },
      {
        id: 'food',
        item: 'Non-perishable food items (canned goods, energy bars)',
        essential: true,
      },
      {
        id: 'first-aid',
        item: 'Basic first-aid kit with medications',
        essential: true,
      },
      {
        id: 'flashlight',
        item: 'Flashlight with extra batteries',
        essential: true,
      },
      {
        id: 'radio',
        item: 'Battery-powered or hand-crank radio',
        essential: true,
      },
      {
        id: 'documents',
        item: 'Important documents (ID, insurance, property papers)',
        essential: false,
      },
      {
        id: 'charges',
        item: 'Mobile phone chargers and power banks',
        essential: false,
      },
      {
        id: 'clothing',
        item: 'Weather-appropriate clothing and sturdy shoes',
        essential: false,
      },
    ],
    floodPreparation: [
      {
        id: 'elevate',
        item: 'Elevate furniture and electrical items',
        essential: true,
      },
      {
        id: 'sandbags',
        item: 'Sandbags or water barriers for doors',
        essential: true,
      },
      {
        id: 'valve',
        item: 'Know how to shut off gas, electricity, and water valves',
        essential: true,
      },
    ],
    heatwavePreparation: [
      {
        id: 'hydration',
        item: 'Stay hydrated with water and electrolytes',
        essential: true,
      },
      {
        id: 'shade',
        item: 'Stay in shaded or air-cooled areas during peak hours',
        essential: true,
      },
      {
        id: 'check-on-neighbors',
        item: 'Check on elderly and vulnerable neighbors',
        essential: false,
      },
    ],
    cyclonePreparation: [
      {
        id: 'secure',
        item: 'Secure loose objects around property',
        essential: true,
      },
      {
        id: 'evacuation',
        item: 'Identify evacuation routes and shelters',
        essential: true,
      },
      {
        id: 'communication',
        item: 'Have a family communication plan',
        essential: true,
      },
    ],
  },

  lastSynced: new Date().toISOString(),
});

export const EMERGENCY_PACKS = INDIAN_STATES_AND_UTS.reduce(
  (acc, state) => {
    acc[state] = createStatePack(state);
    return acc;
  },
  {}
);
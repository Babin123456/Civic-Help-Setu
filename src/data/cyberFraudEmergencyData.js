/**
 * @file cyberFraudEmergencyData.js
 * @description Official Indian cybercrime and banking emergency reporting channels (1930 Helpline, cybercrime.gov.in),
 * fraud categories, golden hour protocols, and strict warnings against sharing credentials.
 */

export const CYBER_FRAUD_SCENARIOS = [
  {
    code: 'UPI_PAYMENT_FRAUD',
    title: 'UPI / QR Code / Payment Gateway Fraud',
    description: 'Deceptive requests on PhonePe, Google Pay, Paytm, or spoofed collect-request links, where victim entered UPI PIN.',
    immediateActions: [
      'Immediately dial 1930 (Citizen Financial Cyber Fraud Reporting Management System).',
      'Open your bank mobile app and temporarily freeze UPI transactions / de-link accounts.',
      'Call your bank 24x7 toll-free fraud helpline to place a hold on the transacted account / lien on recipient IFSC.'
    ],
    goldenHourWindowHours: 2, // First 2-3 hours allow beneficiary bank freeze
    evidenceToPreserve: [
      'UPI Transaction ID (12-digit UTR number)',
      'Screenshot of UPI debit message with timestamp',
      'Virtual Payment Address (VPA / UPI ID) of the recipient',
      'Bank statement reflecting the exact deducted amount and transaction reference'
    ]
  },
  {
    code: 'REMOTE_ACCESS_APP_TAKEOVER',
    title: 'Screen Sharing / Remote Access Takeover (AnyDesk, TeamViewer, RustDesk)',
    description: 'Fraudster posed as customer care/bank agent and instructed victim to install a screen-mirroring app.',
    immediateActions: [
      'Immediately turn off Wi-Fi and mobile data or switch phone to Airplane Mode.',
      'Uninstall the remote access application (AnyDesk, QuickSupport, TeamViewer, RustDesk).',
      'From a separate safe device or landline, call your bank to block net banking, debit cards, and credit cards immediately.',
      'Format or perform security scan on the compromised mobile/PC device before logging into financial apps.'
    ],
    goldenHourWindowHours: 1,
    evidenceToPreserve: [
      'APK name, app store link, or download link sent by fraudster',
      'Call log showing fraudster phone number and call duration',
      'SMS alerts containing unauthorized OTPs or password reset notifications',
      'App permissions log or download folder contents'
    ]
  },
  {
    code: 'IMPERSONATION_SOCIAL_ENGINEERING',
    title: 'Digital Arrest / Police / Customs / Courier Impersonation',
    description: 'Victim threatened via WhatsApp video/Skype by impersonators claiming illegal parcels, CBI arrests, or ED summons.',
    immediateActions: [
      'Immediately hang up the call. Real Indian law enforcement, CBI, Police, and Courts NEVER conduct digital arrests via video call or demand bank transfers.',
      'Do not transfer money to any "RBI verification account" or "government clearance account".',
      'Report caller numbers on Chakshu portal (sancharsaathi.gov.in) and file an incident on cybercrime.gov.in.'
    ],
    goldenHourWindowHours: 24,
    evidenceToPreserve: [
      'Fraudulent letterheads, arrest notices, or court summons received on WhatsApp/Email (save original PDF/images with metadata)',
      'WhatsApp phone numbers, Skype IDs, and profile screenshots',
      'Bank account details provided by fraudsters for extortion',
      'Call recordings or chat transcripts (exported without deleting)'
    ]
  }
];

export const OFFICIAL_REPORTING_CHANNELS = {
  NATIONAL_CYBER_CRIME_PORTAL: {
    name: 'National Cyber Crime Reporting Portal (NCRP)',
    portalUrl: 'https://cybercrime.gov.in',
    tollFreeHelpline: '1930', // Operates under I4C (Indian Cyber Crime Coordination Centre, MHA)
    administeringAuthority: 'Ministry of Home Affairs (MHA), Govt. of India',
    isOfficial: true,
    operatingHours: '24x7'
  },
  CHAKSHU_SUSPECTED_FRAUD_REPORTING: {
    name: 'Chakshu Portal (Department of Telecommunications)',
    portalUrl: 'https://sancharsaathi.gov.in/sfc',
    purpose: 'Report suspected fraudulent communications, fake SMS headers, and impersonation numbers.'
  }
};

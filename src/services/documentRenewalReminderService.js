/**
 * Service to analyze vault documents for statutory expiration, financial year
 * validity deadlines (March 31st), and license grace periods.
 */

/**
 * Returns the March 31st date corresponding to the end of the Indian Financial Year
 * for a given date.
 */
export const getFiscalYearEnd = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed: 0 = Jan, 2 = March, 3 = April

  // If Jan, Feb, or March (0, 1, 2), fiscal year ends March 31st of the SAME calendar year
  if (month <= 2) {
    return new Date(year, 2, 31, 23, 59, 59, 999);
  }
  // If April-Dec, fiscal year ends March 31st of the NEXT calendar year
  return new Date(year + 1, 2, 31, 23, 59, 59, 999);
};

/**
 * Evaluates a list of stored documents and detects impending renewal requirements.
 */
export const evaluateDocumentRenewalNeeds = (documents = [], now = new Date()) => {
  if (!Array.isArray(documents) || documents.length === 0) return [];

  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const reminders = [];

  for (const doc of documents) {
    const docType = String(doc.type || '').toLowerCase();
    const docName = String(doc.name || '').toLowerCase();
    const combinedName = `${docType} ${docName}`;

    // 1. Income, EWS, and OBC Non-Creamy Layer Certificates (Annual Fiscal Year Cycle)
    if (
      combinedName.includes('income') ||
      combinedName.includes('ews') ||
      combinedName.includes('creamy layer') ||
      combinedName.includes('scholarship')
    ) {
      const issueDate = doc.issueDate || doc.createdAt;
      if (issueDate) {
        const issuedFiscalEnd = getFiscalYearEnd(new Date(issueDate)).getTime();
        const currentFiscalEnd = getFiscalYearEnd(new Date(currentTime)).getTime();

        if (currentTime > issuedFiscalEnd) {
          reminders.push({
            docId: doc.id,
            docType: doc.type,
            docNumber: doc.number,
            renewalUrgency: 'EXPIRED',
            headline: 'Financial Year Validity Lapsed',
            description: 'Income/EWS certificates lapse at the close of the financial year (March 31). A fresh certificate is needed for civic and scholarship filings.',
            renewalServicePath: '/services/income-certificate',
            recommendedLeadDays: 15,
          });
          continue;
        }

        // If within 45 days of March 31st
        const daysToFiscalEnd = Math.floor((issuedFiscalEnd - currentTime) / (1000 * 60 * 60 * 24));
        if (daysToFiscalEnd <= 45 && daysToFiscalEnd >= 0) {
          reminders.push({
            docId: doc.id,
            docType: doc.type,
            docNumber: doc.number,
            renewalUrgency: 'UPCOMING',
            headline: `Fiscal Year Renewal in ${daysToFiscalEnd} Days`,
            description: `Valid until March 31. Pre-apply now at your Tehsil/CSC to prevent gap in welfare entitlements.`,
            renewalServicePath: '/services/income-certificate',
            recommendedLeadDays: 30,
          });
          continue;
        }
      }
    }

    // 2. Driving License (Motor Vehicles Act: 30-day grace period)
    if (combinedName.includes('driving') || combinedName.includes('license') || combinedName.includes('dl')) {
      if (doc.expiryDate) {
        const expiryTime = new Date(doc.expiryDate).getTime();
        const diffDays = Math.floor((expiryTime - currentTime) / (1000 * 60 * 60 * 24));

        if (diffDays < 0 && diffDays >= -30) {
          reminders.push({
            docId: doc.id,
            docType: doc.type,
            docNumber: doc.number,
            renewalUrgency: 'URGENT',
            headline: 'Statutory 30-Day Grace Period Active',
            description: `License expired ${Math.abs(diffDays)} days ago. Under Section 14 of the MV Act, renew within 30 days without re-test penalties.`,
            renewalServicePath: '/services/driving-license',
            recommendedLeadDays: 30,
          });
          continue;
        }

        if (diffDays < -30) {
          reminders.push({
            docId: doc.id,
            docType: doc.type,
            docNumber: doc.number,
            renewalUrgency: 'EXPIRED',
            headline: 'Driving License Grace Period Lapsed',
            description: 'Expired beyond statutory 30 days. Late fee surcharge and driving re-test may be required by the RTO.',
            renewalServicePath: '/services/driving-license',
            recommendedLeadDays: 45,
          });
          continue;
        }

        if (diffDays <= 60 && diffDays >= 0) {
          reminders.push({
            docId: doc.id,
            docType: doc.type,
            docNumber: doc.number,
            renewalUrgency: 'UPCOMING',
            headline: `License Expiration in ${diffDays} Days`,
            description: 'Parivahan Sarathi allows renewal applications up to 1 year before expiry.',
            renewalServicePath: '/services/driving-license',
            recommendedLeadDays: 30,
          });
          continue;
        }
      }
    }

    // 3. Passport (6-Month Minimum Validity Requirement)
    if (combinedName.includes('passport')) {
      if (doc.expiryDate) {
        const expiryTime = new Date(doc.expiryDate).getTime();
        const diffDays = Math.floor((expiryTime - currentTime) / (1000 * 60 * 60 * 24));

        if (diffDays <= 180 && diffDays > 0) {
          reminders.push({
            docId: doc.id,
            docType: doc.type,
            docNumber: doc.number,
            renewalUrgency: 'UPCOMING',
            headline: `Passport Below 6-Month Validity (${diffDays} Days Left)`,
            description: 'Most international immigration and visa authorities mandate at least 6 months remaining passport validity.',
            renewalServicePath: '/services/passport-seva',
            recommendedLeadDays: 60,
          });
        }
      }
    }
  }

  return reminders;
};

/**
 * noisePollutionService.js
 *
 * Implements statutory and acoustic algorithms under:
 * 1. Noise Pollution (Regulation and Control) Rules, 2000 (Environment (Protection) Act, 1986).
 * 2. CPCB Noise Standards & Compounding Penalty Scale (Rule 5 & Section 15 EPA 1986).
 * 3. Supreme Court Guidelines in In Re: Noise Pollution (AIR 2005 SC 3136).
 */

/**
 * Statutory Ambient Noise Standards under Schedule to Noise Rules, 2000
 * Day Time: 6:00 AM to 10:00 PM
 * Night Time: 10:00 PM to 6:00 AM
 */
export const NOISE_ZONES = {
  INDUSTRIAL_AREA: {
    id: 'INDUSTRIAL_AREA',
    label: 'Industrial Area',
    code: 'A',
    dayLimitDbA: 75,
    nightLimitDbA: 70,
    description: 'Manufacturing clusters, factories, workshops, and industrial estates.',
  },
  COMMERCIAL_AREA: {
    id: 'COMMERCIAL_AREA',
    label: 'Commercial Area',
    code: 'B',
    dayLimitDbA: 65,
    nightLimitDbA: 55,
    description: 'Markets, shopping complexes, offices, restaurants, and commercial streets.',
  },
  RESIDENTIAL_AREA: {
    id: 'RESIDENTIAL_AREA',
    label: 'Residential Area',
    code: 'C',
    dayLimitDbA: 55,
    nightLimitDbA: 45,
    description: 'Housing societies, apartments, standalone residences, and mixed residential lanes.',
  },
  SILENCE_ZONE: {
    id: 'SILENCE_ZONE',
    label: 'Silence Zone (100m Perimeter)',
    code: 'D',
    dayLimitDbA: 50,
    nightLimitDbA: 40,
    description: 'Area comprising not less than 100 meters around hospitals, educational institutions, courts, and nursing homes.',
  },
};

/**
 * Common Offending Noise Sources & Statutory Curfew Rules under Rule 5
 */
export const NOISE_SOURCES = {
  LOUDSPEAKER_OR_PA_SYSTEM: {
    id: 'LOUDSPEAKER_OR_PA_SYSTEM',
    label: 'Loudspeaker / Public Address (PA) System / DJ Sound Box',
    nightCurfewMandatory: true, // Complete ban 10 PM - 6 AM (Rule 5(1))
    compoundingPenaltyInr: 10000,
    statutoryRemedy: 'Immediate sound curtailment & equipment seizure under Rule 5(2).',
  },
  DIESEL_GENERATOR_SET: {
    id: 'DIESEL_GENERATOR_SET',
    label: 'Diesel Generator (DG) Set without Acoustic Enclosure',
    nightCurfewMandatory: false,
    compoundingPenaltyInr: 25000, // Ranges ₹10k to ₹1,00,000 depending on kVA
    statutoryRemedy: 'Mandatory acoustic hood installation (min 25 dB(A) insertion loss) under CPCB DG norms.',
  },
  CONSTRUCTION_EQUIPMENT: {
    id: 'CONSTRUCTION_EQUIPMENT',
    label: 'Construction Machinery (Concrete Mixer, Hammer, Excavator)',
    nightCurfewMandatory: true, // Prohibited at night in residential/silence areas
    compoundingPenaltyInr: 50000,
    statutoryRemedy: 'Stop-work notice for nocturnal construction & heavy equipment confiscation.',
  },
  FIRECRACKERS: {
    id: 'FIRECRACKERS',
    label: 'Bursting of Firecrackers / Pyrotechnics',
    nightCurfewMandatory: true, // Strictly banned in silence zones and after 10 PM
    compoundingPenaltyInr: 3000,
    statutoryRemedy: 'Prohibition under Supreme Court orders & police seizure under IPC/BNS public nuisance.',
  },
  COMMERCIAL_BANQUET_EVENT: {
    id: 'COMMERCIAL_BANQUET_EVENT',
    label: 'Commercial Event / Marriage Hall / Open-Air Banquet',
    nightCurfewMandatory: true,
    compoundingPenaltyInr: 20000,
    statutoryRemedy: 'Verification of written DM permit and sound limiter calibration check.',
  },
};

/**
 * Evaluates an observed sound reading against zone thresholds and acoustic physics.
 *
 * @param {Object} params
 * @param {number} params.observedDbA Sound pressure level in dB(A) Leq
 * @param {string} [params.zoneKey='RESIDENTIAL_AREA'] Key from NOISE_ZONES
 * @param {number} [params.hourOfDay] Hour 0-23 (defaults to current system hour)
 * @param {number} [params.durationMinutes=30] Duration of continued noise
 * @param {string} [params.sourceType='LOUDSPEAKER_OR_PA_SYSTEM'] Key from NOISE_SOURCES
 * @param {boolean} [params.isEnclosedDg=false] For DG sets, whether acoustic enclosure exists
 * @returns {Object} Evaluation with exceedance, energy multiple, severity, and penalty
 */
export function evaluateSoundReading({
  observedDbA = 0,
  zoneKey = 'RESIDENTIAL_AREA',
  hourOfDay,
  durationMinutes = 30,
  sourceType = 'LOUDSPEAKER_OR_PA_SYSTEM',
  isEnclosedDg = false,
}) {
  const db = Math.max(0, Number(observedDbA) || 0);
  const zone = NOISE_ZONES[zoneKey] || NOISE_ZONES.RESIDENTIAL_AREA;
  const source = NOISE_SOURCES[sourceType] || NOISE_SOURCES.LOUDSPEAKER_OR_PA_SYSTEM;

  const hour = (typeof hourOfDay === 'number' && hourOfDay >= 0 && hourOfDay <= 23)
    ? hourOfDay
    : new Date().getHours();

  // Day: 6:00 AM (06:00) to 10:00 PM (22:00)
  const isNightTime = hour < 6 || hour >= 22;
  const timePeriodLabel = isNightTime ? 'Night Time (10:00 PM - 6:00 AM)' : 'Day Time (6:00 AM - 10:00 PM)';
  const permissibleLimitDbA = isNightTime ? zone.nightLimitDbA : zone.dayLimitDbA;

  const exceedanceDbA = parseFloat(Math.max(0, db - permissibleLimitDbA).toFixed(1));
  const isViolation = exceedanceDbA > 0;

  // Acoustic physics:
  // 1. Sound energy doubles every +3 dB: Energy Multiple = 2^(exceedance / 3)
  // 2. Perceived subjective loudness doubles every +10 dB: Loudness Multiple = 2^(exceedance / 10)
  const soundEnergyMultiplier = parseFloat(Math.pow(2, exceedanceDbA / 3).toFixed(1));
  const perceivedLoudnessMultiplier = parseFloat(Math.pow(2, exceedanceDbA / 10).toFixed(1));

  // Severity Tier
  let severityTier = 'COMPLIANT';
  let severityLabel = 'Compliant with Statutory Limit';
  let severityColor = '#22c55e'; // Green

  if (exceedanceDbA > 15) {
    severityTier = 'HAZARDOUS_EXCEEDANCE';
    severityLabel = 'Hazardous Exceedance (> 15 dB Above Limit)';
    severityColor = '#ef4444'; // Red
  } else if (exceedanceDbA > 10) {
    severityTier = 'SEVERE_VIOLATION';
    severityLabel = 'Severe Violation (10 - 15 dB Above Limit)';
    severityColor = '#f97316'; // Orange-red
  } else if (exceedanceDbA > 5) {
    severityTier = 'MODERATE_VIOLATION';
    severityLabel = 'Moderate Violation (5 - 10 dB Above Limit)';
    severityColor = '#f59e0b'; // Amber
  } else if (exceedanceDbA > 0) {
    severityTier = 'MARGINAL_VIOLATION';
    severityLabel = 'Marginal Violation (1 - 5 dB Above Limit)';
    severityColor = '#eab308'; // Yellow
  }

  // Curfew violation check
  const isCurfewViolation = isNightTime && source.nightCurfewMandatory;

  // DG set acoustic hood violation check
  const isDgAcousticViolation = sourceType === 'DIESEL_GENERATOR_SET' && !isEnclosedDg && isViolation;

  // Statutory penalty calculation
  let estimatedCompoundingFineInr = 0;
  if (isViolation || isCurfewViolation) {
    estimatedCompoundingFineInr = source.compoundingPenaltyInr;
    if (exceedanceDbA > 10) {
      estimatedCompoundingFineInr = Math.min(100000, estimatedCompoundingFineInr * 1.5);
    }
  }

  return {
    observedDbA: db,
    zoneKey: zone.id,
    zoneLabel: zone.label,
    hourOfDay: hour,
    isNightTime,
    timePeriodLabel,
    permissibleLimitDbA,
    exceedanceDbA,
    isViolation,
    soundEnergyMultiplier,
    perceivedLoudnessMultiplier,
    severityTier,
    severityLabel,
    severityColor,
    sourceType: source.id,
    sourceLabel: source.label,
    isCurfewViolation,
    isDgAcousticViolation,
    durationMinutes: Math.max(1, Number(durationMinutes) || 1),
    estimatedCompoundingFineInr,
    statutoryRemedy: source.statutoryRemedy,
    statutoryCitation: 'Schedule to Rule 3(1) and Rule 5 of Noise Pollution (Regulation and Control) Rules, 2000',
  };
}

/**
 * Generates formal statutory complaint memorandum under Rule 7 of Noise Rules, 2000.
 * Addressed to Sub-Divisional Magistrate (SDM) / Station House Officer (SHO) / Police Commissioner.
 *
 * @param {Object} complaintData
 * @returns {string} Formatted legal complaint text
 */
export function generateRule7ComplaintMemorandum(complaintData = {}) {
  const complainantName = complaintData.complainant?.name || '[NAME OF COMPLAINANT / RWA SECRETARY]';
  const complainantAddress = complaintData.complainant?.address || '[RESIDENTIAL ADDRESS / APARTMENT]';
  const complainantContact = complaintData.complainant?.contact || '[PHONE / EMAIL]';

  const sdmOffice = complaintData.authority?.sdmOffice || '[SUB-DIVISIONAL MAGISTRATE (SDM) OFFICE]';
  const policeStation = complaintData.authority?.policeStation || '[LOCAL POLICE STATION / DCP JURISDICTION]';
  const city = complaintData.location?.city || '[CITY / DISTRICT]';
  const state = complaintData.location?.state || '[STATE]';
  const incidentLocation = complaintData.location?.incidentLocation || '[EXACT INCIDENT LANDMARK / STREET]';

  const evalData = complaintData.evaluation || {};
  const observedDb = evalData.observedDbA || 0;
  const permissibleDb = evalData.permissibleLimitDbA || 45;
  const deltaDb = evalData.exceedanceDbA || 0;
  const energyMult = evalData.soundEnergyMultiplier || 1;
  const zoneName = evalData.zoneLabel || 'Residential Area';
  const sourceName = evalData.sourceLabel || 'Loudspeaker / Sound Amplifiers';
  const timePeriod = evalData.timePeriodLabel || 'Night Time (10:00 PM - 6:00 AM)';
  const dateStr = complaintData.incidentDate || new Date().toISOString().slice(0, 10);
  const duration = evalData.durationMinutes || 60;

  const lines = [
    '================================================================================',
    'FORMAL STATUTORY COMPLAINT MEMORANDUM UNDER RULE 7 OF NOISE POLLUTION',
    '(REGULATION AND CONTROL) RULES, 2000 READ WITH SECTION 15 OF EPA, 1986',
    '================================================================================',
    '',
    `DATE: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'TO:',
    `1. THE DESIGNATED AUTHORITY / SUB-DIVISIONAL MAGISTRATE (SDM)`,
    `   ${sdmOffice}, ${city}, ${state}`,
    '',
    `2. THE DEPUTY COMMISSIONER OF POLICE / STATION HOUSE OFFICER (SHO)`,
    `   ${policeStation}, ${city}, ${state}`,
    '',
    `3. THE MEMBER SECRETARY / REGIONAL OFFICER`,
    `   ${state} State Pollution Control Board (SPCB)`,
    '',
    'FROM:',
    `${complainantName}`,
    `${complainantAddress}`,
    `Contact: ${complainantContact}`,
    '',
    '--------------------------------------------------------------------------------',
    'SUBJECT: URGENT COMPLAINT UNDER RULE 7 FOR UNLAWFUL NOISE EXCEEDANCE OF +' + deltaDb + ' dB(A),',
    `VIOLATION OF NIGHT-TIME CURFEW, AND CONTINUED STATUTORY DEFAULT AT ${incidentLocation}.`,
    '--------------------------------------------------------------------------------',
    '',
    'RESPECTED DESIGNATED AUTHORITY,',
    '',
    '1. DETAILS OF THE NOISE OFFENSE & ZONE CLASSIFICATION:',
    `   (a) Subject Location: ${incidentLocation}, ${city}, ${state}.`,
    `   (b) Declared Statutory Zone: ${zoneName} (Noise Rules, 2000 Schedule).`,
    `   (c) Date & Period of Infraction: ${dateStr} during ${timePeriod}.`,
    `   (d) Continuous Duration: Approximately ${duration} minutes.`,
    `   (e) Offending Noise Source: ${sourceName}.`,
    '',
    '2. SCIENTIFIC & STATUTORY DECIBEL MEASUREMENTS:',
    `   (a) Permissible Ambient Limit for Zone: ${permissibleDb} dB(A) Leq.`,
    `   (b) Recorded Sound Level (LAeq): ${observedDb} dB(A).`,
    `   (c) Net Statutory Exceedance (Delta dB): +${deltaDb} dB(A) above legal limit.`,
    `   (d) Acoustic Impact Multiple: ${energyMult}x increase in physical sound pressure energy.`,
    '',
    '3. SPECIFIC STATUTORY INFRACTIONS:',
    '   (a) Rule 3(1) & Schedule: Gross breach of permissible ambient decibel standards.',
    '   (b) Rule 5(1): Unlawful operation of loudspeakers / sound amplifying equipment during night curfew (10 PM to 6 AM) without written permission.',
    '   (c) Rule 5(2): Failure of the polluter to curtail sound levels to not exceed 10 dB(A) above ambient limits at the peripheral boundary.',
    '   (d) Hon\'ble Supreme Court Directives in In Re: Noise Pollution (AIR 2005 SC 3136) establishing freedom from noise pollution as a fundamental right under Article 21.',
    '',
    '4. SPECIFIC PRAYERS & RELIEFS SOUGHT:',
    'The Complainant respectfully requests the Designated Authority to:',
    '   (a) Issue immediate directions under Rule 8 to the offending entity to forthwith stop / abate the unlawful noise emission;',
    '   (b) Order the seizure and confiscation of the offending loudspeakers, sound amplifiers, or unattenuated machinery under Rule 5(2);',
    '   (c) Levy environmental compensation and compounding penalty (estimated at Rs. ' + (evalData.estimatedCompoundingFineInr || 10000).toLocaleString('en-IN') + ') as per CPCB schedule; and',
    '   (d) Initiate penal prosecution under Section 15 of the Environment (Protection) Act, 1986 against defaulting organizers/contractors.',
    '',
    'Submitted respectfully,',
    '',
    '____________________________________',
    `${complainantName}`,
    '================================================================================',
  ];

  return lines.join('\n');
}

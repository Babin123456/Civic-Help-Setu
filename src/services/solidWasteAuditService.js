/**
 * Municipal Solid Waste Dumping, Bulk Waste Generator Audit & NGT Compensation Service
 *
 * Implements deterministic volumetric waste tonnage estimations, SPCB/CPCB density metrics,
 * Bulk Waste Generator (BWG) compliance evaluations under Solid Waste Management Rules, 2016,
 * Construction & Demolition (C&D) Waste Management Rules, 2016, and National Green Tribunal (NGT)
 * Environmental Compensation (EC) statutory fine formulas.
 */

/**
 * CPCB and SPCB Standard Bulk Density Metrics (Tonnes per cubic meter).
 * Reference: CPCB Guidelines on Environmental Compensation for Solid Waste Management (2019).
 */
export const WASTE_DENSITY_METRICS = {
  UNCOMPACTED_MIXED_MSW: {
    id: 'UNCOMPACTED_MIXED_MSW',
    label: 'Uncompacted Mixed MSW (Open Street / Vacant Plot Dump)',
    densityTonnesPerCuM: 0.45, // 450 kg/m³
    pollutionIndex: 80, // Red Category
    description: 'Fresh municipal solid waste piled loosely on streets, open plots, or wetlands.',
  },
  COMPACTED_LANDFILL_MSW: {
    id: 'COMPACTED_LANDFILL_MSW',
    label: 'Compacted / Settled Dumpsite MSW (Legacy Waste Mound)',
    densityTonnesPerCuM: 0.85, // 850 kg/m³
    pollutionIndex: 80,
    description: 'Aged, settled waste in informal dump yards with anaerobic decomposition.',
  },
  ORGANIC_WET_KITCHEN: {
    id: 'ORGANIC_WET_KITCHEN',
    label: 'Organic Kitchen & Wet Biodegradable Waste',
    densityTonnesPerCuM: 0.60, // 600 kg/m³
    pollutionIndex: 50, // Orange Category
    description: 'High-moisture food waste from markets, banquets, and residential complexes.',
  },
  CONSTRUCTION_DEMOLITION: {
    id: 'CONSTRUCTION_DEMOLITION',
    label: 'Construction & Demolition (C&D) Debris (Concrete, Brick, Plaster, Sand)',
    densityTonnesPerCuM: 1.50, // 1500 kg/m³
    pollutionIndex: 50,
    description: 'Heavy inorganic rubble, concrete chunks, excavation soil, and plaster chips.',
  },
  DRY_RECYCLABLE_PLASTIC_PAPER: {
    id: 'DRY_RECYCLABLE_PLASTIC_PAPER',
    label: 'Dry Recyclable Packaging & Plastic Litter',
    densityTonnesPerCuM: 0.25, // 250 kg/m³
    pollutionIndex: 50,
    description: 'Single-use plastics, packaging materials, cardboard, and dry litter.',
  },
};

/**
 * Bulk Waste Generator (BWG) Premise Classifications per SWM Rule 3(1)(7).
 */
export const BWG_PREMISE_TYPES = {
  GATED_RESIDENTIAL_SOCIETY: {
    id: 'GATED_RESIDENTIAL_SOCIETY',
    label: 'Gated Residential Society / Apartment Complex (> 5,000 sq.m or > 100 kg/day)',
    dailyThresholdKg: 100,
    areaThresholdSqM: 5000,
    mandatoryOnSiteBioProcessing: true,
  },
  COMMERCIAL_MALL_COMPLEX: {
    id: 'COMMERCIAL_MALL_COMPLEX',
    label: 'Commercial Shopping Mall / Retail Complex',
    dailyThresholdKg: 100,
    areaThresholdSqM: 5000,
    mandatoryOnSiteBioProcessing: true,
  },
  IT_TECH_PARK: {
    id: 'IT_TECH_PARK',
    label: 'IT Tech Park / Corporate Office SEZ',
    dailyThresholdKg: 100,
    areaThresholdSqM: 5000,
    mandatoryOnSiteBioProcessing: true,
  },
  HOTEL_RESTAURANT_BANQUET: {
    id: 'HOTEL_RESTAURANT_BANQUET',
    label: 'Hotel / Restaurant / Marriage Banquet Hall',
    dailyThresholdKg: 100,
    areaThresholdSqM: 5000,
    mandatoryOnSiteBioProcessing: true,
  },
  EDUCATIONAL_INSTITUTION: {
    id: 'EDUCATIONAL_INSTITUTION',
    label: 'University / Large Educational Institution Campus',
    dailyThresholdKg: 100,
    areaThresholdSqM: 5000,
    mandatoryOnSiteBioProcessing: true,
  },
  HOSPITAL_HEALTHCARE: {
    id: 'HOSPITAL_HEALTHCARE',
    label: 'Hospital / Healthcare Facility (General Non-Biomedical Solid Waste)',
    dailyThresholdKg: 100,
    areaThresholdSqM: 5000,
    mandatoryOnSiteBioProcessing: true,
  },
};

/**
 * National Green Tribunal (NGT) Zonal Benches having jurisdiction over environmental disputes.
 */
export const NGT_ZONAL_BENCHES = {
  PRINCIPAL_BENCH_DELHI: {
    id: 'PRINCIPAL_BENCH_DELHI',
    benchName: 'Principal Bench, New Delhi',
    jurisdictionStates: ['Delhi', 'Uttar Pradesh', 'Punjab', 'Haryana', 'Uttarakhand', 'Himachal Pradesh', 'Jammu & Kashmir'],
    registrarOffice: 'Faridkot House, Copernicus Marg, New Delhi - 110001',
  },
  WESTERN_BENCH_PUNE: {
    id: 'WESTERN_BENCH_PUNE',
    benchName: 'Western Zonal Bench, Pune',
    jurisdictionStates: ['Maharashtra', 'Gujarat', 'Goa', 'Daman & Diu', 'Dadra & Nagar Haveli'],
    registrarOffice: 'New Administrative Building, D-Wing, Opp. Council Hall, Pune - 411001',
  },
  SOUTHERN_BENCH_CHENNAI: {
    id: 'SOUTHERN_BENCH_CHENNAI',
    benchName: 'Southern Zonal Bench, Chennai',
    jurisdictionStates: ['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana', 'Puducherry'],
    registrarOffice: 'Kalas Mahal, Heritage Building, PWD Estate, Chepauk, Chennai - 600005',
  },
  EASTERN_BENCH_KOLKATA: {
    id: 'EASTERN_BENCH_KOLKATA',
    benchName: 'Eastern Zonal Bench, Kolkata',
    jurisdictionStates: ['West Bengal', 'Odisha', 'Bihar', 'Jharkhand', 'Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Tripura', 'Nagaland', 'Arunachal Pradesh', 'Sikkim'],
    registrarOffice: 'Old P.G. Hospital Building, Kolkata - 700020',
  },
  CENTRAL_BENCH_BHOPAL: {
    id: 'CENTRAL_BENCH_BHOPAL',
    benchName: 'Central Zonal Bench, Bhopal',
    jurisdictionStates: ['Madhya Pradesh', 'Rajasthan', 'Chhattisgarh'],
    registrarOffice: 'Van Vigyan Bhawan, Gammon India Complex, Link Road No. 2, Bhopal - 462003',
  },
};

/**
 * Location Factors (LF) defined in CPCB Environmental Compensation Guidelines.
 */
export const CITY_LOCATION_FACTORS = {
  METRO_ABOVE_10M: {
    id: 'METRO_ABOVE_10M',
    label: 'Mega-City (Population > 10 Million e.g. Mumbai, Delhi, Bengaluru)',
    factor: 2.0,
  },
  CLASS_1_1M_TO_10M: {
    id: 'CLASS_1_1M_TO_10M',
    label: 'Class-I City (Population 1 Million to 10 Million e.g. Pune, Hyderabad, Ahmedabad, Chennai)',
    factor: 1.5,
  },
  TIER_2_500K_TO_1M: {
    id: 'TIER_2_500K_TO_1M',
    label: 'Tier-2 City (Population 500,000 to 1 Million)',
    factor: 1.25,
  },
  TOWN_BELOW_500K: {
    id: 'TOWN_BELOW_500K',
    label: 'Town / Municipal Council (Population < 500,000)',
    factor: 1.0,
  },
};

/**
 * Scale Factors (S) for polluter operations.
 */
export const SCALE_FACTORS = {
  LARGE_BULK_OR_ULB: {
    id: 'LARGE_BULK_OR_ULB',
    label: 'Large Entity (ULB Municipal Corporation, Major Tech Park, Heavy Builder)',
    factor: 1.5,
  },
  MEDIUM_COMMERCIAL: {
    id: 'MEDIUM_COMMERCIAL',
    label: 'Medium Commercial Complex / Banquet Hall / Hospital',
    factor: 1.0,
  },
  SMALL_COMMUNITY: {
    id: 'SMALL_COMMUNITY',
    label: 'Small Housing Society / Individual Commercial Shop',
    factor: 0.5,
  },
};

/**
 * CPCB Statutory Base Rate factor in Rupees per day (R).
 */
export const CPCB_BASE_FACTOR_R = 250; // INR 250 per day

/**
 * Standard CPCB bio-mining remediation cost per metric tonne of legacy waste.
 */
export const STANDARD_BIO_REMEDIATION_COST_PER_TONNE_INR = 550; // INR 550 / tonne

/**
 * Evaluates Bulk Waste Generator (BWG) status and compliance under SWM Rules, 2016.
 *
 * @param {Object} params
 * @param {string} params.premiseType Key from BWG_PREMISE_TYPES
 * @param {number} [params.dailyWasteKg=0] Daily total waste generated (in kg)
 * @param {number} [params.builtUpAreaSqM=0] Total plinth / plot area (in sq. meters)
 * @param {boolean} [params.onSiteWetWasteProcessing=false] Whether wet waste is processed on-site
 * @param {boolean} [params.bioMethanationOrComposting=false] Whether bio-methanation / composting facility exists
 * @param {boolean} [params.dryWasteChannelized=false] Whether dry waste is handed over to registered recyclers
 * @param {boolean} [params.hazardousWasteSegregated=false] Whether sanitary / domestic hazardous waste is segregated
 * @returns {Object} Bulk Waste Generator evaluation and penalty liability
 */
export function evaluateBwgCompliance({
  premiseType = 'GATED_RESIDENTIAL_SOCIETY',
  dailyWasteKg = 0,
  builtUpAreaSqM = 0,
  onSiteWetWasteProcessing = false,
  bioMethanationOrComposting = false,
  dryWasteChannelized = false,
  hazardousWasteSegregated = false,
}) {
  const wasteKg = Math.max(0, Number(dailyWasteKg) || 0);
  const areaSqM = Math.max(0, Number(builtUpAreaSqM) || 0);

  const isBwgByWaste = wasteKg >= 100;
  const isBwgByArea = areaSqM >= 5000;
  const isBulkGenerator = isBwgByWaste || isBwgByArea;

  const violations = [];
  let complianceScore = 100;

  if (isBulkGenerator) {
    if (!onSiteWetWasteProcessing) {
      violations.push({
        rule: 'Rule 4(6) SWM Rules 2016',
        description: 'Failure to facilitate collection of segregated waste and on-site treatment of biodegradable waste.',
        penaltyInrPerDay: 5000,
      });
      complianceScore -= 35;
    }

    if (!bioMethanationOrComposting) {
      violations.push({
        rule: 'Rule 4(7) SWM Rules 2016',
        description: 'Absence of operational in-situ composting, vermi-composting, or bio-methanation facility.',
        penaltyInrPerDay: 5000,
      });
      complianceScore -= 25;
    }

    if (!dryWasteChannelized) {
      violations.push({
        rule: 'Rule 4(8) SWM Rules 2016',
        description: 'Failure to channelize recyclable non-biodegradable waste to authorized recyclers or waste pickers.',
        penaltyInrPerDay: 2500,
      });
      complianceScore -= 20;
    }

    if (!hazardousWasteSegregated) {
      violations.push({
        rule: 'Rule 4(1)(c) SWM Rules 2016',
        description: 'Failure to store domestic hazardous waste (diapers, batteries, paints) separately in designated bins.',
        penaltyInrPerDay: 2500,
      });
      complianceScore -= 20;
    }
  } else {
    // Non-BWG generator
    if (!dryWasteChannelized || !hazardousWasteSegregated) {
      complianceScore -= 30;
      violations.push({
        rule: 'Rule 4(1) SWM Rules 2016',
        description: 'Failure to perform 3-stream segregation (Wet, Dry, Domestic Hazardous) at source.',
        penaltyInrPerDay: 500,
      });
    }
  }

  complianceScore = Math.max(0, Math.min(100, complianceScore));

  const totalSpotFineExposureInrPerDay = violations.reduce(
    (acc, v) => acc + (v.penaltyInrPerDay || 0),
    0
  );

  let status = 'COMPLIANT';
  if (violations.length > 0) {
    status = complianceScore < 50 ? 'CRITICAL_VIOLATION' : 'DEFICIENT';
  }

  return {
    isBulkGenerator,
    isBwgByWaste,
    isBwgByArea,
    dailyWasteKg: wasteKg,
    builtUpAreaSqM: areaSqM,
    premiseType,
    complianceScore,
    status,
    isCompliant: violations.length === 0,
    violations,
    totalSpotFineExposureInrPerDay,
    statutoryMandate: isBulkGenerator
      ? 'Rule 4(6), 4(7), 4(8) of SWM Rules, 2016 mandates 100% on-site wet waste processing & zero wet waste handover to ULB.'
      : 'Rule 4(1) of SWM Rules, 2016 mandates strict 3-stream source segregation for non-bulk generators.',
  };
}

/**
 * Calculates volumetric dumping tonnage and NGT Environmental Compensation (EC).
 *
 * Formula: EC = PI * N * R * S * LF
 * Where:
 *  - PI = Pollution Index (CPCB Red Category = 80, Orange = 50)
 *  - N  = Number of days of continued default / illegal dumping
 *  - R  = Base factor in Rupees per day (CPCB standard = INR 250)
 *  - S  = Scale factor (1.5 Large, 1.0 Medium, 0.5 Small)
 *  - LF = Location Factor (2.0 Metro, 1.5 Class 1, 1.0 Town)
 *
 * @param {Object} params
 * @param {number} [params.dumpLengthM=0] Length of dump site (in meters)
 * @param {number} [params.dumpWidthM=0] Width of dump site (in meters)
 * @param {number} [params.dumpAvgDepthM=0] Average height / depth of waste pile (in meters)
 * @param {string} [params.wasteCategory='UNCOMPACTED_MIXED_MSW'] Category from WASTE_DENSITY_METRICS
 * @param {number} [params.defaultDays=30] Days the dump has persisted without clearance
 * @param {string} [params.cityClass='CLASS_1_1M_TO_10M'] City classification from CITY_LOCATION_FACTORS
 * @param {string} [params.scaleOfOperation='LARGE_BULK_OR_ULB'] Scale factor from SCALE_FACTORS
 * @param {boolean} [params.activeBurningObserved=false] Whether open burning / smoke is present (triggers 1.5x NGT penalty multiplier)
 * @returns {Object} Tonnage, remediation cost, and NGT environmental compensation estimate
 */
export function calculateWasteTonnageAndNgtCompensation({
  dumpLengthM = 0,
  dumpWidthM = 0,
  dumpAvgDepthM = 0,
  wasteCategory = 'UNCOMPACTED_MIXED_MSW',
  defaultDays = 30,
  cityClass = 'CLASS_1_1M_TO_10M',
  scaleOfOperation = 'LARGE_BULK_OR_ULB',
  activeBurningObserved = false,
}) {
  const length = Math.max(0, Number(dumpLengthM) || 0);
  const width = Math.max(0, Number(dumpWidthM) || 0);
  const depth = Math.max(0, Number(dumpAvgDepthM) || 0);
  const days = Math.max(1, parseInt(defaultDays, 10) || 1);

  const metric = WASTE_DENSITY_METRICS[wasteCategory] || WASTE_DENSITY_METRICS.UNCOMPACTED_MIXED_MSW;
  const location = CITY_LOCATION_FACTORS[cityClass] || CITY_LOCATION_FACTORS.CLASS_1_1M_TO_10M;
  const scale = SCALE_FACTORS[scaleOfOperation] || SCALE_FACTORS.LARGE_BULK_OR_ULB;

  // Volume in cubic meters: V = L * W * D
  const dumpVolumeCuM = Math.round(length * width * depth * 100) / 100;

  // Estimated tonnage: Volume * Density
  const estimatedTonnage = Math.round(dumpVolumeCuM * metric.densityTonnesPerCuM * 100) / 100;

  // Standard Bio-remediation / Bio-mining cost: Tonnage * 550 INR
  const estimatedRemediationCostInr = Math.round(
    estimatedTonnage * STANDARD_BIO_REMEDIATION_COST_PER_TONNE_INR
  );

  // NGT Formula: EC = PI * N * R * S * LF
  const PI = metric.pollutionIndex;
  const N = days;
  const R = CPCB_BASE_FACTOR_R;
  const S = scale.factor;
  const LF = location.factor;

  const baseCompensationInr = Math.round(PI * N * R * S * LF);

  // If open burning is observed, NGT strictly applies 1.5x aggravation multiplier under Rule 15(v)
  const burningMultiplier = activeBurningObserved ? 1.5 : 1.0;
  const finalEnvironmentalCompensationInr = Math.round(baseCompensationInr * burningMultiplier);

  const perDayFineInr = Math.round(finalEnvironmentalCompensationInr / days);

  return {
    isValid: dumpVolumeCuM > 0,
    dumpLengthM: length,
    dumpWidthM: width,
    dumpAvgDepthM: depth,
    dumpVolumeCuM,
    wasteCategory,
    densityTonnesPerCuM: metric.densityTonnesPerCuM,
    estimatedTonnage,
    estimatedRemediationCostInr,
    defaultDays: days,
    pollutionIndex: PI,
    cpcbBaseFactorR: R,
    scaleFactor: S,
    locationFactor: LF,
    activeBurningObserved,
    burningMultiplier,
    finalEnvironmentalCompensationInr,
    perDayFineInr,
    statutoryCitation: 'CPCB Guidelines on Environmental Compensation for MSW Default & NGT Order in O.A. 606/2018',
  };
}

/**
 * Evaluates Construction & Demolition (C&D) Waste compliance under C&D Waste Management Rules, 2016.
 *
 * @param {Object} params
 * @param {number} [params.dailyGenerationTons=0] Daily C&D waste generated (tons)
 * @param {number} [params.totalProjectTons=0] Total project C&D waste estimated (tons)
 * @param {boolean} [params.hasUlApprovedPlan=false] Whether Waste Management Plan is approved by ULB
 * @param {boolean} [params.segregatedDeposition=false] Whether waste is segregated into 4 streams
 * @returns {Object} C&D waste evaluation
 */
export function evaluateCdWasteCompliance({
  dailyGenerationTons = 0,
  totalProjectTons = 0,
  hasUlApprovedPlan = false,
  segregatedDeposition = false,
}) {
  const daily = Math.max(0, Number(dailyGenerationTons) || 0);
  const total = Math.max(0, Number(totalProjectTons) || 0);

  // Rule 4(3) thresholds for Bulk C&D Generator: > 20 tons/day OR > 300 tons/project
  const isBulkCdGenerator = daily >= 20 || total >= 300;

  const violations = [];
  if (isBulkCdGenerator && !hasUlApprovedPlan) {
    violations.push({
      rule: 'Rule 4(3) C&D Rules 2016',
      description: 'Bulk C&D generator operating without prior submission and ULB approval of Waste Management Plan.',
      mandatoryAction: 'Submit detailed waste processing and recycling plan to Municipal Commissioner.',
    });
  }

  if (!segregatedDeposition) {
    violations.push({
      rule: 'Rule 4(1) C&D Rules 2016',
      description: 'Failure to segregate C&D waste into 4 streams (concrete, soil/sand, brick masonry, steel/wood).',
      mandatoryAction: 'Deploy on-site physical partition bins before transportation to ULB collection center.',
    });
  }

  return {
    isBulkCdGenerator,
    dailyGenerationTons: daily,
    totalProjectTons: total,
    isCompliant: violations.length === 0,
    violations,
    statutoryRef: isBulkCdGenerator
      ? 'Rule 4(3) of C&D Waste Management Rules, 2016 (Mandatory ULB Plan Approval)'
      : 'Rule 4(1) of C&D Waste Management Rules, 2016 (Segregated Stream Deposition)',
  };
}

/**
 * Generates a formal statutory notice under Rule 15 & Rule 16 of SWM Rules, 2016
 * addressed to Municipal Commissioner, District Magistrate, and SPCB Member Secretary.
 *
 * @param {Object} noticeData
 * @returns {string} Formatted legal notice text
 */
export function generateRule15StatutoryNotice(noticeData = {}) {
  const complainantName = noticeData.complainant?.name || '[NAME OF COMPLAINANT / RWA REPRESENTATIVE]';
  const complainantAddress = noticeData.complainant?.address || '[RESIDENTIAL ADDRESS / LOCALITY]';
  const complainantContact = noticeData.complainant?.contact || '[PHONE / EMAIL]';

  const locationDescription = noticeData.location?.address || '[EXACT LANDMARK / WARD / SURVEY NO.]';
  const wardNumber = noticeData.location?.ward || '[WARD NUMBER]';
  const city = noticeData.location?.city || '[MUNICIPAL CORPORATION CITY]';
  const state = noticeData.location?.state || '[STATE]';

  const calc = noticeData.calculation || noticeData;
  const defaultDays = calc.defaultDays || 30;
  const tonnage = calc.estimatedTonnage || 0;
  const compensationInr = calc.finalEnvironmentalCompensationInr || calc.environmentalCompensationInr || 0;
  const activeBurning = calc.activeBurningObserved ? 'YES (Active Smoke / Burning observed)' : 'NO';
  const dumpVolumeCuM = calc.dumpVolumeCuM || (noticeData.dumpDimensions ? (noticeData.dumpDimensions.lengthM || 0) * (noticeData.dumpDimensions.widthM || 0) * (noticeData.dumpDimensions.avgDepthM || 0) : 0);
  const remediationCost = calc.estimatedRemediationCostInr || 0;

  const lines = [
    '================================================================================',
    'FORMAL STATUTORY NOTICE UNDER RULE 15 & 16 OF SOLID WASTE MANAGEMENT RULES, 2016',
    'READ WITH SECTION 5 OF ENVIRONMENT (PROTECTION) ACT, 1986',
    '================================================================================',
    '',
    `DATE: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'TO:',
    `1. THE MUNICIPAL COMMISSIONER / CHIEF EXECUTIVE OFFICER`,
    `   ${city} Municipal Corporation, ${state}`,
    '',
    `2. THE DISTRICT MAGISTRATE / DEPUTY COMMISSIONER`,
    `   District Magistrate Office, ${city}, ${state}`,
    '',
    `3. THE MEMBER SECRETARY`,
    `   ${state} State Pollution Control Board (SPCB)`,
    '',
    'FROM:',
    `${complainantName}`,
    `${complainantAddress}`,
    `Contact: ${complainantContact}`,
    '',
    '--------------------------------------------------------------------------------',
    'SUBJECT: URGENT STATUTORY REPRESENTATION REGARDING ILLEGAL OPEN SOLID WASTE',
    `DUMPING, ACCUMULATED TONNAGE OF ${tonnage} METRIC TONNES, AND NGT ENVIRONMENTAL`,
    `COMPENSATION LIABILITY IN WARD NO. ${wardNumber}, ${city}.`,
    '--------------------------------------------------------------------------------',
    '',
    'RESPECTED AUTHORITIES,',
    '',
    '1. LOCATIONAL DETAILS & STATUTORY INFRACTIONS:',
    `   (a) Subject Location: ${locationDescription}, Ward No.: ${wardNumber}, ${city}, ${state}.`,
    `   (b) Duration of Continued Default: ${defaultDays} consecutive days without municipal clearance.`,
    `   (c) Estimated Waste Mass: Approx. ${tonnage} Metric Tonnes accumulated over an estimated volume of ${dumpVolumeCuM} m³.`,
    `   (d) Open Waste Burning Status: ${activeBurning}.`,
    '',
    '2. MANDATORY OBLIGATIONS BREACHED UNDER SWM RULES, 2016:',
    '   (a) Rule 15(a) & 15(b): Failure to establish door-to-door collection and prevent open littering.',
    '   (b) Rule 15(v): Explicit violation of statutory prohibition against open burning of solid waste and bio-mass.',
    '   (c) Rule 15(zg): Failure to prevent groundwater contamination, toxic leachate discharge, and vector breeding in residential zones.',
    '',
    '3. COMPUTATION OF ENVIRONMENTAL COMPENSATION UNDER NGT MANDATES:',
    '   In terms of the binding orders of the Hon\'ble National Green Tribunal in O.A. No. 606/2018 (Compliance of SWM Rules, 2016) and the CPCB Environmental Compensation formula:',
    `   - Estimated Bio-Remediation / Bio-Mining Cost: Rs. ${Number(remediationCost).toLocaleString('en-IN')}`,
    `   - Statutory Environmental Compensation Accrued: Rs. ${Number(compensationInr).toLocaleString('en-IN')}`,
    '',
    '4. STATUTORY DEMANDS & 15-DAY CURE NOTICE:',
    'The undersigned hereby demands that the Municipal Corporation and SPCB shall:',
    '   (a) Deploy mechanized earthmovers and waste transport compactors within 72 hours to clear the accumulated dump site;',
    '   (b) Undertake immediate bio-remediation and lime/insecticide spray to prevent vector epidemic breakout;',
    '   (c) Identify and prosecute commercial bulk generators / contractors dumping unsegregated debris in the plot;',
    '   (d) Install CCTV surveillance and signboards warning of spot fines under Rule 15(g).',
    '',
    'PLEASE TAKE NOTICE that if the illegal dumping and open burning are not fully remediated within fifteen (15) days of receipt of this notice, the undersigned shall institute an Original Application under Section 14 & 15 of the National Green Tribunal Act, 2010 before the Hon\'ble NGT Zonal Bench for exemplary environmental restitution fines and personal disciplinary prosecution against the defaulting municipal officials.',
    '',
    'Yours faithfully,',
    '',
    '____________________________________',
    `${complainantName}`,
    '================================================================================',
  ];

  return lines.join('\n');
}

/**
 * Formulates a court-ready draft Original Application outline under Section 14/15 NGT Act, 2010.
 *
 * @param {Object} caseData
 * @returns {string} Formatted NGT Application text
 */
export function generateNgtSection14Application(caseData = {}) {
  const benchKey = caseData.bench || 'WESTERN_BENCH_PUNE';
  const bench = NGT_ZONAL_BENCHES[benchKey] || NGT_ZONAL_BENCHES.WESTERN_BENCH_PUNE;

  const applicantName = caseData.complainant?.name || '[NAME OF APPLICANT]';
  const respondentMunicipal = caseData.respondentMunicipal || '[MUNICIPAL CORPORATION]';
  const respondentSpcb = caseData.respondentSpcb || '[STATE POLLUTION CONTROL BOARD]';
  const location = caseData.location?.address || '[LOCATION OF DUMPSITE]';

  const calc = caseData.calculation || caseData;
  const tonnage = calc.estimatedTonnage || 0;
  const compensation = Number(calc.finalEnvironmentalCompensationInr || calc.environmentalCompensationInr || 0).toLocaleString('en-IN');

  const lines = [
    '================================================================================',
    'BEFORE THE HON\'BLE NATIONAL GREEN TRIBUNAL',
    `AT ${bench.benchName.toUpperCase()}`,
    '================================================================================',
    '',
    `ORIGINAL APPLICATION NO. __________ OF ${new Date().getFullYear()}`,
    '(UNDER SECTION 14 READ WITH SECTION 15 OF THE NATIONAL GREEN TRIBUNAL ACT, 2010)',
    '',
    'IN THE MATTER OF:',
    `${applicantName}`,
    '... APPLICANT',
    '',
    'VERSUS',
    '',
    `1. ${respondentMunicipal}, Through Municipal Commissioner`,
    `2. ${respondentSpcb}, Through Member Secretary`,
    '3. STATE OF ENVIRONMENT DEPARTMENT',
    '... RESPONDENTS',
    '',
    '--------------------------------------------------------------------------------',
    'APPLICATION UNDER SECTION 14 & 15 SEEKING REMEDIATION OF ILLEGAL SOLID WASTE',
    'DUMPING AND IMPOSITION OF ENVIRONMENTAL COMPENSATION UNDER POLLUTER PAYS PRINCIPLE',
    '--------------------------------------------------------------------------------',
    '',
    'THE APPLICANT RESPECTFULLY STATES AS UNDER:',
    '',
    '1. SUBSTANTIAL QUESTION RELATING TO ENVIRONMENT:',
    '   The present application raises substantial questions relating to the environment arising out of the gross, continued violation of the Solid Waste Management Rules, 2016, Construction and Demolition Waste Management Rules, 2016, and Article 21 of the Constitution of India.',
    '',
    '2. FACTS OF THE CASE:',
    `   (a) An unauthorized legacy waste dump of approximately ${tonnage} Metric Tonnes has accumulated at ${location}.`,
    `   (b) The dump has generated toxic leachate contaminating local storm-water drains and ambient air, exacerbated by uncontrolled open burning.`,
    '   (c) Statutory notice under Rule 15 of SWM Rules, 2016 was duly served upon the Respondents, but they have failed to perform their statutory duties.',
    '',
    '3. RELIEFS & PRAYERS:',
    'The Applicant respectfully prays that this Hon\'ble Tribunal may be pleased to:',
    '   (a) Direct the Respondent Municipal Corporation to forthwith commence bio-mining and bio-remediation of the subject waste dump within a time-bound period of 30 days;',
    `   (b) Direct the Respondent SPCB to levy and recover interim Environmental Compensation of Rs. ${compensation} from the defaulting municipal authority in accordance with CPCB guidelines;`,
    '   (c) Direct the installation of permanent boundary fencing, high-resolution CCTV cameras, and strict spot fines against polluters; and',
    '   (d) Pass such further order(s) as this Hon\'ble Tribunal may deem just and equitable in the interest of public health and environment.',
    '',
    'VERIFICATION:',
    `Verified at ${bench.benchName} on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '____________________________________',
    'Signature of Applicant',
    '================================================================================',
  ];

  return lines.join('\n');
}

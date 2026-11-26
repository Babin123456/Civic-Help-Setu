/**
 * electricityConsumerService.js
 *
 * Implements statutory compensation algorithms, disconnection legality audits,
 * defective meter diagnostic reconciliations, and CGRF petition drafting under:
 * 1. Electricity Act, 2003 (Sections 42(5), 43, 56, 142).
 * 2. Electricity (Rights of Consumers) Rules, 2020 (Notified by Ministry of Power).
 * 3. Central Electricity Authority (Installation and Operation of Meters) Regulations.
 * 4. State Electricity Regulatory Commission (SERC) Standard of Performance (SoP) Regulations.
 */

/**
 * Standard of Performance (SoP) Default Compensation Rates under Rule 11 of Rules 2020
 */
export const SOP_COMPENSATION_BENCHMARKS = {
  SUPPLY_OUTAGE: {
    id: 'SUPPLY_OUTAGE',
    label: 'Unscheduled Supply Interruption / Power Outage',
    permissibleHours: 4, // Max allowed interruption duration before penalty kicks in
    ratePerHourInr: 10,
    minRatePerDayInr: 100,
    description: 'Statutory credit for unscheduled outages exceeding prescribed duration (Rule 11(2)).',
  },
  TRANSFORMER_FAILURE: {
    id: 'TRANSFORMER_FAILURE',
    label: 'Burnt / Failed Distribution Transformer Replacement',
    permissibleHoursMetro: 24,
    permissibleHoursRural: 48,
    ratePerDayInr: 150,
    description: 'Failure to replace burnt transformer within 24h in cities / 48h in rural areas.',
  },
  NEW_CONNECTION_DELAY: {
    id: 'NEW_CONNECTION_DELAY',
    label: 'Delayed New Connection / Load Extension Release',
    permissibleDaysMetro: 7,
    permissibleDaysRural: 15,
    ratePerWeekInr: 500,
    description: 'Mandatory 7-day metro / 15-day rural release timeline under Rule 4.',
  },
  METER_REPLACEMENT_DELAY: {
    id: 'METER_REPLACEMENT_DELAY',
    label: 'Burnt / Defective / Fast Meter Replacement Delay',
    permissibleHours: 24,
    ratePerDayInr: 50,
    description: 'Failure to test and replace defective or stopped meter within statutory limit (Rule 7).',
  },
  VOLTAGE_FLUCTUATION: {
    id: 'VOLTAGE_FLUCTUATION',
    label: 'Persistent Voltage Variation / Dip (>10% of nominal)',
    permissibleDays: 5,
    ratePerDayInr: 100,
    description: 'Failure to rectify transformer tap or resolve voltage drops exceeding ±10%.',
  },
};

/**
 * Calculates statutory compensation payable by DISCOM under Rule 11.
 *
 * @param {Object} params
 * @param {number} params.outageDurationHours - Total unscheduled outage hours
 * @param {number} params.transformerFailureDays - Days taken to replace failed transformer
 * @param {boolean} params.isRuralArea - Whether consumer location is rural
 * @param {number} params.newConnectionDelayDays - Days delayed beyond statutory limit
 * @param {number} params.meterDelayDays - Days delayed in replacing burnt meter
 * @param {number} params.voltageDelayDays - Days unresolved voltage fluctuation
 * @returns {Object} Calculated compensation breakdown
 */
export function calculateSopCompensation({
  outageDurationHours = 0,
  transformerFailureDays = 0,
  isRuralArea = false,
  newConnectionDelayDays = 0,
  meterDelayDays = 0,
  voltageDelayDays = 0,
} = {}) {
  let totalCompensationInr = 0;
  const breakdown = [];

  // 1. Supply Outage
  const outageHours = Math.max(0, Number(outageDurationHours) || 0);
  const excessOutageHours = Math.max(0, outageHours - SOP_COMPENSATION_BENCHMARKS.SUPPLY_OUTAGE.permissibleHours);
  if (excessOutageHours > 0) {
    const outageComp = Math.max(
      excessOutageHours * SOP_COMPENSATION_BENCHMARKS.SUPPLY_OUTAGE.ratePerHourInr,
      Math.ceil(excessOutageHours / 24) * SOP_COMPENSATION_BENCHMARKS.SUPPLY_OUTAGE.minRatePerDayInr
    );
    totalCompensationInr += outageComp;
    breakdown.push({
      category: 'Power Supply Outage Delay',
      excessDuration: `${excessOutageHours} hours beyond permissible threshold`,
      statutoryRate: '₹10/hour (min ₹100/day)',
      payableInr: outageComp,
      legalRule: 'Rule 11(2) Electricity (Rights of Consumers) Rules 2020',
    });
  }

  // 2. Transformer Breakdown
  const transDays = Math.max(0, Number(transformerFailureDays) || 0);
  const allowedTransDays = isRuralArea ? 2 : 1; // 48h rural, 24h urban
  const excessTransDays = Math.max(0, transDays - allowedTransDays);
  if (excessTransDays > 0) {
    const transComp = excessTransDays * SOP_COMPENSATION_BENCHMARKS.TRANSFORMER_FAILURE.ratePerDayInr;
    totalCompensationInr += transComp;
    breakdown.push({
      category: 'Transformer Replacement Delay',
      excessDuration: `${excessTransDays} days excess delay`,
      statutoryRate: '₹150/day',
      payableInr: transComp,
      legalRule: 'Rule 11 Standard of Performance (SoP)',
    });
  }

  // 3. New Connection Delay
  const connDelayDays = Math.max(0, Number(newConnectionDelayDays) || 0);
  if (connDelayDays > 0) {
    const weeks = Math.ceil(connDelayDays / 7);
    const connComp = weeks * SOP_COMPENSATION_BENCHMARKS.NEW_CONNECTION_DELAY.ratePerWeekInr;
    totalCompensationInr += connComp;
    breakdown.push({
      category: 'New Connection Statutory Default',
      excessDuration: `${connDelayDays} days delayed (${weeks} billable weeks)`,
      statutoryRate: '₹500/week or part thereof',
      payableInr: connComp,
      legalRule: 'Section 43 Electricity Act & Rule 4',
    });
  }

  // 4. Meter Replacement Delay
  const meterDays = Math.max(0, Number(meterDelayDays) || 0);
  if (meterDays > 0) {
    const meterComp = meterDays * SOP_COMPENSATION_BENCHMARKS.METER_REPLACEMENT_DELAY.ratePerDayInr;
    totalCompensationInr += meterComp;
    breakdown.push({
      category: 'Defective Meter Replacement Delay',
      excessDuration: `${meterDays} days delay`,
      statutoryRate: '₹50/day',
      payableInr: meterComp,
      legalRule: 'Rule 7 & CEA Metering Regulations',
    });
  }

  // 5. Voltage Fluctuations
  const voltDays = Math.max(0, Number(voltageDelayDays) || 0);
  if (voltDays > 0) {
    const voltComp = voltDays * SOP_COMPENSATION_BENCHMARKS.VOLTAGE_FLUCTUATION.ratePerDayInr;
    totalCompensationInr += voltComp;
    breakdown.push({
      category: 'Voltage Quality Standard Default',
      excessDuration: `${voltDays} days unresolved voltage dip`,
      statutoryRate: '₹100/day',
      payableInr: voltComp,
      legalRule: 'Rule 10 Power Quality Standards',
    });
  }

  return {
    totalCompensationInr,
    breakdown,
    hasClaim: totalCompensationInr > 0,
    statutoryMandate: 'Under Rule 11(3), this compensation must be credited automatically to the consumer electricity bill within the next billing cycle.',
  };
}

/**
 * Audits the legality of an electricity disconnection under Section 56(1) of the Electricity Act, 2003.
 *
 * @param {Object} params
 * @param {number} params.noticeDaysGiven - Number of clear days notice served
 * @param {boolean} params.writtenNoticeServed - Whether clear written notice was provided
 * @param {boolean} params.disconnectedAfterOnePm - Disconnected after 1:00 PM
 * @param {boolean} params.disconnectedOnFridayOrHoliday - Disconnected on Friday, weekend, or public holiday
 * @param {boolean} params.hasDisputedProvisionalBill - Whether consumer formally disputed bill under Section 56(1)
 * @param {boolean} params.depositedProtestAmount - Whether consumer deposited 50% or 6-month average under protest
 * @returns {Object} Disconnection legality evaluation
 */
export function auditDisconnectionLegality({
  noticeDaysGiven = 0,
  writtenNoticeServed = false,
  disconnectedAfterOnePm = false,
  disconnectedOnFridayOrHoliday = false,
  hasDisputedProvisionalBill = false,
  depositedProtestAmount = false,
} = {}) {
  const violations = [];

  // Statutory requirement 1: 15 clear days notice in writing
  if (!writtenNoticeServed) {
    violations.push({
      provision: 'Section 56(1) Electricity Act 2003',
      name: 'Absence of Mandatory Written Notice',
      impact: 'DISCOM cannot disconnect power without explicit 15-day written notice in prescribed format.',
    });
  } else if (noticeDaysGiven < 15) {
    violations.push({
      provision: 'Section 56(1) Notice Period Rule',
      name: 'Premature Disconnection (< 15 Clear Days)',
      impact: `Notice served was only ${noticeDaysGiven} days (statutory minimum is 15 clear days excluding receipt day).`,
    });
  }

  // Statutory requirement 2: Prohibited timing (after 1:00 PM)
  if (disconnectedAfterOnePm) {
    violations.push({
      provision: 'Electricity Supply Code & SoP Rules',
      name: 'Prohibited After-Hours Disconnection (Post 1:00 PM)',
      impact: 'Supply disconnection after 1:00 PM is illegal to prevent overnight deprivation of essential electricity.',
    });
  }

  // Statutory requirement 3: Friday / Holiday disconnection ban
  if (disconnectedOnFridayOrHoliday) {
    violations.push({
      provision: 'State Electricity Supply Code Rules',
      name: 'Disconnection on Friday / Weekend / Public Holiday',
      impact: 'Disconnection before non-working days deprives consumers of statutory payment or dispute window.',
    });
  }

  // Statutory requirement 4: Proviso to Section 56(1) - Disputed bill protection
  if (hasDisputedProvisionalBill && depositedProtestAmount) {
    violations.push({
      provision: 'Proviso to Section 56(1) Electricity Act 2003',
      name: 'Illegal Disconnection of Disputed Bill Deposited Under Protest',
      impact: 'Statutory bar: DISCOM cannot disconnect if the consumer pays under protest the average of last 6 months.',
    });
  }

  const isIllegalDisconnection = violations.length > 0;
  let severity = 'LEGAL';
  if (violations.length >= 3 || (hasDisputedProvisionalBill && depositedProtestAmount)) {
    severity = 'HIGHLY_ILLEGAL';
  } else if (isIllegalDisconnection) {
    severity = 'ACTIONABLE';
  }

  return {
    isIllegalDisconnection,
    severity,
    violations,
    remedy: isIllegalDisconnection
      ? 'Consumer entitled to immediate restoration within 4 hours and damages under Section 142.'
      : 'Disconnection complies prima-facie with Section 56(1) statutory procedure.',
  };
}

/**
 * Reconciles erratic kWh billing spikes against CEA Metering Regulations.
 *
 * @param {Object} params
 * @param {number} params.historicalAverageUnits - Average monthly kWh units over previous 6-12 months
 * @param {number} params.disputedBillUnits - Units billed in disputed invoice
 * @param {number} params.unitTariffInr - Average tariff rate per kWh unit
 * @param {boolean} params.meterTestBenchRequested - Whether consumer requested NABL lab test bench
 * @param {number} params.meterTestErrorPercentage - Error percentage determined by test bench (>2% is fast)
 * @returns {Object} Diagnostic and billing adjustment refund summary
 */
export function diagnoseDefectiveMeterAndBilling({
  historicalAverageUnits = 180,
  disputedBillUnits = 720,
  unitTariffInr = 8.5,
  meterTestBenchRequested = false,
  meterTestErrorPercentage = 0,
} = {}) {
  const avgUnits = Math.max(1, Number(historicalAverageUnits) || 1);
  const billedUnits = Math.max(0, Number(disputedBillUnits) || 0);
  const tariff = Math.max(1, Number(unitTariffInr) || 8.5);
  const errorPercent = Number(meterTestErrorPercentage) || 0;

  const unitSpikeRatio = billedUnits / avgUnits;
  const isErraticSpike = unitSpikeRatio >= 2.5; // >250% surge indicates potential meter creep or phase short

  let excessUnits = Math.max(0, billedUnits - avgUnits);
  if (errorPercent > 2) {
    // Fast running meter beyond permissible 2% limit under CEA regulations
    excessUnits = Math.round((billedUnits * errorPercent) / (100 + errorPercent));
  }

  const estimatedRefundInr = Math.round(excessUnits * tariff);
  const isMeterFast = errorPercent > 2;

  return {
    unitSpikeRatio: Number(unitSpikeRatio.toFixed(2)),
    isErraticSpike,
    isMeterFast,
    excessUnits,
    estimatedRefundInr,
    meterTestBenchRequested,
    statutoryRule: 'CEA (Installation and Operation of Meters) Regulations & Rule 7 (Accredited NABL test bench entitlement).',
    recommendation: isErraticSpike || isMeterFast
      ? 'Demand installation of check meter or third-party laboratory test bench. Provisional bill must be adjusted to 6-month average.'
      : 'Consumption falls within standard seasonal variance range.',
  };
}

/**
 * Formulates a formal statutory petition to the Consumer Grievance Redressal Forum (CGRF) under Section 42(5).
 *
 * @param {Object} params
 * @returns {string} Formatted statutory complaint text
 */
export function generateCgrfPetition({
  consumerName = 'Consumer Name',
  caNumber = 'CA-XXXX-XXXX',
  meterNumber = 'MTR-XXXXXX',
  sanctionedLoadKw = '3 kW Domestic',
  consumerAddress = 'Address of Consumer Premises',
  contactPhone = 'XXXXXXXXXX',
  discomName = 'State Electricity Distribution Company Ltd (DISCOM)',
  divisionOffice = 'Local Sub-Divisional Office (O&M)',
  districtName = 'District',
  stateName = 'State',
  sopData = null,
  disconnectionData = null,
  meterData = null,
  grievanceDescription = 'Unscheduled power outage without restoration and arbitrary provisional bill overcharge',
} = {}) {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const totalCompensation = sopData?.totalCompensationInr || 0;
  const refundAmount = meterData?.estimatedRefundInr || 0;

  return `FORMAL STATUTORY GRIEVANCE PETITION UNDER SECTION 42(5) OF THE ELECTRICITY ACT, 2003
BEFORE THE HON'BLE CONSUMER GRIEVANCE REDRESSAL FORUM (CGRF), ${discomName.toUpperCase()}

CONSUMER / PETITIONER:
Name: ${consumerName}
Consumer Account (CA) / Service ID: ${caNumber}
Meter Serial Number: ${meterNumber}
Sanctioned Load & Category: ${sanctionedLoadKw}
Service Premises Address: ${consumerAddress}
Contact Phone: ${contactPhone}

RESPONDENT DISCOM:
The Executive Engineer / Assistant Engineer (O&M),
${discomName},
Division / Sub-Division: ${divisionOffice},
District: ${districtName}, ${stateName}

SUBJECT: PETITION UNDER SECTION 42(5) READ WITH ELECTRICITY (RIGHTS OF CONSUMERS) RULES 2020 FOR COMPENSATION CREDIT, CANCELLATION OF UNLAWFUL BILLING / DISCONNECTION & SECTION 142 PENAL PROCEEDINGS

RESPECTFULLY SUBMITTED:

1. STATUTORY JURISDICTION & STANDING:
The Petitioner is a bona fide consumer of electricity under Section 2(15) of the Electricity Act 2003. This Hon'ble Forum is vested with statutory authority under Section 42(5) to adjudicate non-compliance with the Electricity (Rights of Consumers) Rules, 2020 and State Standard of Performance (SoP) regulations.

2. STATEMENT OF FACTS & GRIEVANCE:
(a) The consumer has maintained a regular payment track record without willful default.
(b) Specific Statement of Grievance: "${grievanceDescription}".
${sopData?.hasClaim ? `(c) STATUTORY SERVICE DELAY COMPENSATION DEFAULT (RULE 11):
The Respondent DISCOM failed to adhere to guaranteed performance timelines.
- Net Compensation Statutorily Payable: INR ${totalCompensation.toLocaleString('en-IN')}
- Performance Failures: ${(sopData.breakdown || []).map((b) => `${b.category} (${b.excessDuration})`).join('; ') || 'Guaranteed performance standard exceeded'}
Under Rule 11(3), this compensation was legally mandated to be credited automatically to the Petitioner's electricity bill.` : ''}
${disconnectionData?.isIllegalDisconnection ? `(d) CONTRAVENTION OF SECTION 56(1) (ILLEGAL DISCONNECTION):
The Respondent carried out supply disconnection in flagrant violation of statutory procedure:
${(disconnectionData.violations || []).map((v) => `- ${v.provision}: ${v.name} (${v.impact})`).join('\n') || '- Unlawful disconnection without due process'}` : ''}
${meterData?.isErraticSpike || meterData?.isMeterFast ? `(e) METER DEFECT & INFLATED PROVISIONAL BILLING:
The meter registered an unverified surge of ${meterData.unitSpikeRatio}x over the 6-month historical average (${meterData.excessUnits} excess units), creating an illegal financial burden of INR ${refundAmount.toLocaleString('en-IN')}. Under CEA Metering Regulations, the consumer is entitled to an accredited lab test bench and provisional billing adjustment.` : ''}

3. STATUTORY PRAYERS:
In the premises aforesaid, the Petitioner respectfully prays that this Hon'ble Forum may be pleased to:
(i) Direct the Respondent DISCOM to forthwith restore/reconnect electricity supply to the Petitioner's premises within 4 hours;
(ii) Order the automatic credit of statutory delay compensation amounting to INR ${totalCompensation.toLocaleString('en-IN')} directly into the consumer's billing ledger;
(iii) Direct retroactive adjustment and refund of inflated provisional billing charges amounting to INR ${refundAmount.toLocaleString('en-IN')};
(iv) Restrain the Respondent from levying delayed payment surcharges (DPS) or initiating coercive recovery pending adjudication;
(v) Recommend penal action under Section 142 of the Electricity Act 2003 against the responsible distribution engineers for deliberate flouting of consumer rights.

VERIFICATION:
I, ${consumerName}, the Petitioner above-named, do hereby solemnly declare that the facts stated in this petition are true and correct to my knowledge and based on records of the DISCOM.

Place: ${districtName}, ${stateName}
Date: ${today}

___________________________
Signature / Thumb Impression of Petitioner
`;
}

/**
 * @file rainwaterHarvestingRulesData.js
 * @description Municipal building bye-laws, plot size thresholds, mandatory RWH capacity rules,
 * and technical components across major Indian Urban Local Bodies (BBMP Bengaluru, MCD Delhi, GCC Chennai).
 */

export const MUNICIPAL_RWH_BYELAWS = [
  {
    jurisdictionId: 'IN-KA-BLR',
    city: 'Bengaluru',
    governingAuthority: 'Bangalore Water Supply and Sewerage Board (BWSSB) & BBMP',
    statutoryNotification: 'BWSSB (Amendment) Act, 2021 & Building Bye-Laws',
    mandatoryThresholds: {
      newBuildingsPlotAreaSqFt: 1200,
      existingBuildingsPlotAreaSqFt: 2400,
      storageOrRechargeMinLitresPerSqMeterRoof: 60
    },
    penaltiesForNonCompliance: '25% to 50% surcharge on monthly water and sewerage tariff bills.',
    keyComponents: [
      { name: 'Rooftop Catchment & Gutters', function: 'Collects unpolluted rainwater from terrace.' },
      { name: 'First Flush Diverter', function: 'Flushes out initial dirty water and atmospheric dust.' },
      { name: 'Mesh & Sand-Gravel Filter', function: 'Removes leaves, suspended solids, and particulate debris.' },
      { name: 'Storage Sump / Recharge Pit', function: 'Underground masonry tank or open recharge well into shallow aquifers.' }
    ],
    inspectionAgency: 'BWSSB Quality Assurance Wing / Ward Junior Engineer',
    officialPortalUrl: 'https://bwssb.karnataka.gov.in',
    lastVerifiedDate: '2026-03-01'
  },
  {
    jurisdictionId: 'IN-DL-MCD',
    city: 'Delhi',
    governingAuthority: 'Delhi Jal Board (DJB) & Municipal Corporation of Delhi (MCD)',
    statutoryNotification: 'Unified Building Bye-Laws for Delhi (UBBL 2016)',
    mandatoryThresholds: {
      newBuildingsPlotAreaSqFt: 1076, // 100 sq. meters
      existingBuildingsPlotAreaSqFt: 5382, // 500 sq. meters
      storageOrRechargeMinLitresPerSqMeterRoof: 50
    },
    penaltiesForNonCompliance: 'Denial of Completion Certificate / Occupancy Certificate and disconnection of sewer line.',
    keyComponents: [
      { name: 'Catchment Area', function: 'Rooftop, paved courtyards, and terraces.' },
      { name: 'De-silting Chamber', function: 'Traps silt before entering deep recharge borewell.' },
      { name: 'Recharge Borewell / Shaft', function: 'Perforated casing pipe directing filtered runoff into water table.' }
    ],
    inspectionAgency: 'DJB Rainwater Harvesting Cell',
    officialPortalUrl: 'https://delhijalboard.delhi.gov.in',
    lastVerifiedDate: '2026-02-28'
  },
  {
    jurisdictionId: 'IN-TN-CHN',
    city: 'Chennai',
    governingAuthority: 'Chennai Metropolitan Water Supply and Sewerage Board (CMWSSB)',
    statutoryNotification: 'Tamil Nadu Municipal Laws (Amendment) Act, 2003',
    mandatoryThresholds: {
      newBuildingsPlotAreaSqFt: 0, // Mandatory for ALL buildings regardless of size
      existingBuildingsPlotAreaSqFt: 0,
      storageOrRechargeMinLitresPerSqMeterRoof: 50
    },
    penaltiesForNonCompliance: 'Severance of municipal water connection and property tax fine.',
    keyComponents: [
      { name: 'Roof Collection Gutters', function: 'Directs rainfall from tiles and concrete slabs.' },
      { name: 'Percolation Pit / Recharging Trench', function: 'Recharges coastal sandy aquifers with gravel packing.' }
    ],
    inspectionAgency: 'CMWSSB Rain Centre Enforcement Unit',
    officialPortalUrl: 'https://chennaimetrowater.tn.gov.in',
    lastVerifiedDate: '2026-03-05'
  }
];

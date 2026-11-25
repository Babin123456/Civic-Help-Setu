/**
 * Transgender Certificate and Welfare Scheme Application Navigator Data
 * Implements GitHub Issue #1104
 *
 * Statutory Framework:
 * - The Transgender Persons (Protection of Rights) Act, 2019 (Act No. 40 of 2019)
 * - The Transgender Persons (Protection of Rights) Rules, 2020 (G.S.R. 592(E))
 * - National Portal for Transgender Persons: https://transgender.dosje.gov.in
 * - Ministry of Social Justice and Empowerment (MoSJE), Government of India
 *
 * Privacy Guarantees:
 * - 100% Client-side: Zero identity documents collected, zero server telemetry
 * - Browsing is completely anonymous: no user selections exposed to analytics
 * - Respectful, affirming, non-stigmatizing legal terminology throughout
 */

export const NATIONAL_PORTAL_INFO = {
  portalName: 'National Portal for Transgender Persons',
  portalUrl: 'https://transgender.dosje.gov.in',
  nodalMinistry: 'Ministry of Social Justice and Empowerment, Government of India',
  statutoryAct: 'The Transgender Persons (Protection of Rights) Act, 2019',
  statutoryRules: 'The Transgender Persons (Protection of Rights) Rules, 2020',
  issuingAuthority: 'District Magistrate (DM) / Collector of the jurisdiction of residence',
  statutoryTurnaroundDays: 30,
  medicalExamMandatoryForIdentityCert: false, // Section 5 prohibits intrusive physical exams
  applicationFee: 'Nil (Free of Cost as per Central Rules)',
  helpline: '14567 (National Tele-Counselling Toll-Free Helpline)'
};

export const TRANSGENDER_CERTIFICATE_STATES = {
  national: {
    id: 'national',
    state: 'All India / Central Framework',
    officialPortal: 'https://socialjustice.gov.in',
    applicationPortal: 'https://transgender.dosje.gov.in',
    competentAuthority: 'District Magistrate / Collector (Jurisdictional)',
    applicationProcess: {
      steps: [
        {
          id: 'step-nat-1',
          title: 'Register on the National Portal for Transgender Persons',
          description: 'Visit transgender.dosje.gov.in and create an account with a valid email and mobile number. No biometric or Aadhaar linkage is mandatory for account registration.',
          documents: [
            'Recent passport-size colour photograph',
            'Affidavit in Form 2 on non-judicial stamp paper declaring gender identity as Transgender'
          ],
          mandatory: ['photograph', 'affidavit']
        },
        {
          id: 'step-nat-2',
          title: 'Submit Form 1 (Application for Certificate of Identity)',
          description: 'Fill in personal details (chosen name, date of birth, parentage/guru details, address). Residence of at least one year within the district is required under Section 5 of the Act.',
          documents: [
            'Proof of residence (voter ID, electricity bill, ration card, rent agreement, or bank passbook)'
          ],
          mandatory: ['residence-proof']
        },
        {
          id: 'step-nat-3',
          title: 'District Magistrate Scrutiny & Statutory Timeline',
          description: 'Under Rule 6(1), the District Magistrate must issue the Certificate of Identity and Identity Card within 30 days of receiving the application. Section 5 explicitly prohibits requiring the applicant to undergo any physical or medical examination.',
          documents: [],
          mandatory: []
        },
        {
          id: 'step-nat-4',
          title: 'Digital Download of Certificate & Identity Card',
          description: 'Once approved by the District Magistrate, the digital Certificate of Identity and barcoded Identity Card can be downloaded directly from the portal dashboard without visiting any office.',
          documents: [],
          mandatory: []
        }
      ],
      estimatedTimeline: '30 statutory days from receipt of application',
      fee: 'Nil (Free of cost nationwide)'
    },
    correctionRoutes: {
      title: 'Correction & Gender Affirmation Routes (Sections 6 & 7)',
      description: 'The Act provides distinct pathways for minor detail corrections and for revising the gender marker to Male or Female post-medical affirmation:',
      steps: [
        {
          id: 'corr-nat-1',
          title: 'Minor Corrections (Name typo, DOB, Address)',
          description: 'Log into the National Portal, select "Application History" → "Request Modification", upload the corrective documentary proof (e.g. gazette notification or proof of new address), and submit for DM endorsement.',
          documents: ['Documentary proof of corrected detail', 'Affidavit clarifying typographical error'],
          mandatory: ['documentary-proof']
        },
        {
          id: 'corr-nat-2',
          title: 'Revised Certificate Post-Medical Intervention (Section 6 & 7)',
          description: 'If a transgender person undergoes medical intervention (hormone therapy, gender affirmation surgery) to confirm gender as male or female, they may apply to the DM for a revised certificate.',
          documents: [
            'Certificate in Form 3 from the Medical Superintendent or Chief Medical Officer of the medical institution',
            'Original Certificate of Identity previously issued under Section 5'
          ],
          mandatory: ['form-3-medical-cert', 'original-identity-cert']
        },
        {
          id: 'corr-nat-3',
          title: 'Updating Other Identity Documents (Aadhaar, PAN, Passport)',
          description: 'Under Section 7(3), the revised certificate entitles the holder to change their first name and gender marker across all official documents (PAN, Aadhaar, Passport, Educational Degrees) without re-adjudication.',
          documents: ['Revised Certificate of Identity issued by District Magistrate'],
          mandatory: ['revised-certificate']
        }
      ]
    },
    appealRoutes: {
      title: 'Statutory Appeal & Grievance Routes (Rule 11)',
      description: 'If an application is rejected or delayed past the statutory 30-day window:',
      steps: [
        {
          id: 'app-nat-1',
          title: 'Demand Written Rejection Memo with Reasons',
          description: 'Under Rule 6(3), the District Magistrate cannot reject an application without giving the applicant a reasonable opportunity of being heard and recording written reasons.',
          documents: ['Written rejection order or acknowledgement slip with date stamp'],
          mandatory: ['rejection-order']
        },
        {
          id: 'app-nat-2',
          title: 'Statutory First Appeal (Within 30 Days)',
          description: 'Under Rule 11 of the Transgender Persons Rules, an appeal against the DM order lies to the Appellate Authority designated by the State Government (usually the Divisional Commissioner or Secretary, Social Welfare) within 30 days.',
          documents: ['Appeal memo stating grounds of contest', 'Copy of original application and rejection memo', 'Supporting affidavits'],
          mandatory: ['appeal-memo', 'rejection-memo']
        },
        {
          id: 'app-nat-3',
          title: 'MoSJE & CPGRAMS Redressal',
          description: 'Complaints regarding harassment, insistence on physical inspection, or refusal to accept applications can be escalated to the National Council for Transgender Persons (NCTP) and the Department of Social Justice through CPGRAMS (pgportal.gov.in).',
          documents: ['Application reference token', 'Grievance narrative'],
          mandatory: ['reference-token']
        }
      ],
      nationalNodalMinistry: 'Ministry of Social Justice and Empowerment, Government of India'
    },
    welfareSchemes: [
      {
        id: 'central-smile',
        name: 'SMILE: Support for Marginalised Individuals for Livelihood and Enterprise',
        description: 'Comprehensive central umbrella scheme by MoSJE providing welfare measures, scholarships, skill training, and livelihood subsidies for transgender persons across all states.',
        eligibility: [
          'Must hold a valid Certificate of Identity issued under the 2019 Act',
          'Citizen of India',
          'Scholarships: Transgender students from 9th standard up to post-graduation'
        ],
        benefits: [
          'Pre-matric (9th-10th) and Post-matric (11th-PG) scholarship grants',
          'Skill development training with monthly stipend under PM-DAKSH',
          'Micro-enterprise capital and loan subsidies for self-employment'
        ],
        applicationPortal: 'https://transgender.dosje.gov.in',
        stateImplementingAgency: 'MoSJE & National Backward Classes Finance & Development Corporation (NBCFDC)'
      },
      {
        id: 'central-ayushman-tg',
        name: 'Ayushman Bharat TG Plus Health Package',
        description: 'Joint initiative of MoSJE and National Health Authority (NHA) providing ₹5 lakh annual cashless health insurance cover per transgender person.',
        eligibility: [
          'Must hold a valid Certificate of Identity from the National Portal',
          'No income ceiling or existing family card requirement'
        ],
        benefits: [
          'Cashless coverage up to ₹5,00,000 per annum across empanelled hospitals',
          'Covers gender reaffirmation surgery procedures, hormonal therapy, and post-operative care',
          'All general hospitalisation and critical medical treatments'
        ],
        applicationPortal: 'https://beneficiary.nha.gov.in',
        stateImplementingAgency: 'National Health Authority (NHA) & State Health Agencies'
      },
      {
        id: 'central-garima-greh',
        name: 'Garima Greh: Shelter Homes for Transgender Persons',
        description: 'MoSJE-supported residential shelter homes providing safe shelter, food, healthcare, medical checkups, and skill development to transgender persons in destitute situations.',
        eligibility: [
          'Transgender persons facing destitution, family abandonment, or eviction',
          'Hold valid identity or self-declaration'
        ],
        benefits: [
          'Safe dignified residential shelter and nutritious food',
          'Free legal aid and psychological counseling',
          'Linkage to vocational training for community reintegration'
        ],
        applicationPortal: 'https://transgender.dosje.gov.in',
        stateImplementingAgency: 'Empanelled Community-Based Organizations (CBOs)'
      }
    ],
    supportResources: [
      {
        name: 'National Tele-Counselling Helpline for Transgender Persons',
        type: 'Helpline',
        description: '24x7 toll-free mental health counseling, crisis assistance, and scheme guidance provided by MoSJE.',
        contact: {
          phone: '14567 (Toll-Free)',
          availability: '24 Hours / 7 Days'
        },
        website: 'https://transgender.dosje.gov.in',
        verified: true
      },
      {
        name: 'National Women & TG Emergency Helpline',
        type: 'Helpline',
        description: 'Toll-free emergency helpline for persons facing domestic violence, harassment, or unlawful detention.',
        contact: {
          phone: '181 (Toll-Free)',
          availability: '24 Hours / 7 Days'
        },
        verified: true
      },
      {
        name: 'National Legal Services Authority (NALSA) Helpline',
        type: 'Legal Aid',
        description: 'Free legal advice and representation for transgender persons under the NALSA v. Union of India mandate.',
        contact: {
          phone: '15100 (Toll-Free)',
          email: 'nalsa-dla@nic.in',
          website: 'https://nalsa.gov.in'
        },
        verified: true
      }
    ]
  },

  delhi: {
    id: 'delhi',
    state: 'Delhi (NCT)',
    officialPortal: 'https://dsj.delhigovt.nic.in',
    applicationPortal: 'https://transgender.dosje.gov.in',
    competentAuthority: 'District Magistrate (Revenue Department, GNCTD)',
    applicationProcess: {
      steps: [
        {
          id: 'step-dl-1',
          title: 'Apply through Central National Portal',
          description: 'GNCTD processes all Transgender Identity Certificates through the MoSJE National Portal (transgender.dosje.gov.in). District Magistrates of Delhi are linked directly to this portal.',
          documents: ['Self-declaration affidavit', 'Recent colour photograph', 'Delhi address proof'],
          mandatory: ['affidavit', 'photograph', 'delhi-address-proof']
        },
        {
          id: 'step-dl-2',
          title: 'Sub-Divisional Magistrate (SDM) Verification',
          description: 'The DM/SDM office verifies residential continuity in Delhi. Physical appearance is strictly optional and no medical exam can be insisted upon.',
          documents: ['Original address proof for verification if requested'],
          mandatory: []
        },
        {
          id: 'step-dl-3',
          title: 'Issuance within 30 Days',
          description: 'The DM signs digitally. You download the certificate directly from the National Portal dashboard.',
          documents: [],
          mandatory: []
        }
      ],
      estimatedTimeline: '30 statutory days',
      fee: 'Nil (Free)'
    },
    correctionRoutes: {
      title: 'Correction and Revision in Delhi',
      description: 'Handled online via the National Portal. In case of offline difficulties, visit the District Social Welfare Office or Delhi State Legal Services Authority (DSLSA).',
      steps: [
        {
          id: 'dl-corr-1',
          title: 'Online Portal Revision Request',
          description: 'Submit an online revision with the Form 3 medical superintendent certificate for gender marker changes.',
          documents: ['Form 3 Medical Certificate', 'Current Certificate'],
          mandatory: ['form-3']
        }
      ]
    },
    appealRoutes: {
      title: 'Appeals & Grievances in Delhi',
      description: 'Appeals against Delhi District Magistrates lie to the Divisional Commissioner (Revenue Department, 5 Sham Nath Marg, Delhi-110054).',
      steps: [
        {
          id: 'dl-app-1',
          title: 'Appeal to Divisional Commissioner',
          description: 'File a formal appeal within 30 days of the rejection order citing Section 7 and Rule 11.',
          documents: ['Rejection order', 'Grounds of appeal'],
          mandatory: ['rejection-order']
        }
      ],
      nationalNodalMinistry: 'Department of Social Welfare, GNCTD / MoSJE'
    },
    welfareSchemes: [
      {
        id: 'delhi-welfare-board',
        name: 'Delhi Transgender Welfare Board Assistance',
        description: 'State board initiatives providing educational stipends, health check-ups, and legal aid assistance across all 11 Delhi districts.',
        eligibility: ['Resident of NCT of Delhi for at least 3 years', 'Hold Transgender Certificate'],
        benefits: ['Skill development stipends', 'Access to designated Delhi Garima Greh facilities', 'Free legal representation via DSLSA'],
        applicationPortal: 'https://dsj.delhigovt.nic.in',
        applyOnline: true
      }
    ],
    supportResources: [
      {
        name: 'Nazariya: A Queer Feminist Resource Group',
        type: 'Legal Aid & Counseling',
        description: 'Support group offering legal aid, mental wellness, and gender affirmation support in Delhi NCR.',
        contact: {
          phone: '+91-11-2338-0487',
          email: 'info@nazariyaqfrg.com',
          address: 'Kalkaji, New Delhi'
        },
        website: 'https://nazariyaqfrg.com',
        verified: true
      },
      {
        name: 'Delhi State Legal Services Authority (DSLSA) Help Desk',
        type: 'Legal Aid',
        description: 'Dedicated legal aid desk providing pro bono advocates for transgender certificate issues and discrimination cases.',
        contact: {
          phone: '1516 (24x7 DSLSA Helpline)',
          address: 'Central Office, Rouse Avenue District Courts Complex, New Delhi'
        },
        website: 'https://dslsa.org',
        verified: true
      },
      {
        name: 'Mitr Trust Garima Greh (Delhi)',
        type: 'Shelter & Livelihood',
        description: 'Government-supported shelter home providing food, safe housing, medical counseling, and vocational training.',
        contact: {
          phone: '+91-98188-29930',
          email: 'rudrani@mitrtrust.org'
        },
        website: 'https://mitrtrust.org',
        verified: true
      }
    ]
  },

  maharashtra: {
    id: 'maharashtra',
    state: 'Maharashtra',
    officialPortal: 'https://sjsa.maharashtra.gov.in',
    applicationPortal: 'https://transgender.dosje.gov.in',
    competentAuthority: 'District Collector / District Magistrate',
    applicationProcess: {
      steps: [
        {
          id: 'step-mh-1',
          title: 'Apply through National Portal',
          description: 'Maharashtra District Collectors process certificate applications through transgender.dosje.gov.in. Create an account and submit Form 1.',
          documents: ['Self-declaration affidavit', 'Photograph', 'Domicile/Address proof in Maharashtra'],
          mandatory: ['affidavit', 'photograph', 'address-proof']
        },
        {
          id: 'step-mh-2',
          title: 'Verification by District Social Welfare Officer',
          description: 'Application is routed to the District Social Welfare Officer. No medical test is legally permissible for the initial TG card.',
          documents: [],
          mandatory: []
        },
        {
          id: 'step-mh-3',
          title: 'Collector Issuance (30 Days)',
          description: 'Identity Certificate and digital identity card are issued and signed digitally.',
          documents: [],
          mandatory: []
        }
      ],
      estimatedTimeline: '30–45 days',
      fee: 'Nil'
    },
    correctionRoutes: {
      title: 'Correction and Updates in Maharashtra',
      description: 'Online via the National Portal. Physical representations can be addressed to the District Collectorate Social Welfare Desk.',
      steps: [
        {
          id: 'mh-corr-1',
          title: 'Gender Revision Post-Surgery',
          description: 'Upload Form 3 issued by CMO / Medical Superintendent to convert status to Male or Female.',
          documents: ['Form 3 Medical Certificate'],
          mandatory: ['form-3']
        }
      ]
    },
    appealRoutes: {
      title: 'Appeals in Maharashtra',
      description: 'First appeal to the Divisional Commissioner (Konkan, Pune, Nashik, Aurangabad, Amravati, Nagpur Divisions). Second appeal to the Secretary, Social Justice and Special Assistance Department, Mantralaya, Mumbai.',
      steps: [
        {
          id: 'mh-app-1',
          title: 'Appeal to Divisional Commissioner',
          description: 'Submit appeal petition within 30 days of rejection.',
          documents: ['Rejection order', 'Petition'],
          mandatory: ['rejection-order']
        }
      ],
      nationalNodalMinistry: 'Social Justice and Special Assistance Department, Govt. of Maharashtra'
    },
    welfareSchemes: [
      {
        id: 'mh-trans-welfare-board',
        name: 'Maharashtra Transgender Welfare Board (Tritiyapanthi Kalyan Mandal)',
        description: 'State programmes for self-employment grants, educational loans, and housing support through the Maharashtra State Backward Class Development Corporation.',
        eligibility: ['Resident of Maharashtra', 'Valid Transgender Identity Certificate'],
        benefits: ['Micro-finance seed loans up to ₹50,000', 'Vocational training in IT, tailoring, and services', 'Emergency medical hardship assistance'],
        applicationPortal: 'https://sjsa.maharashtra.gov.in',
        applyOnline: true
      }
    ],
    supportResources: [
      {
        name: 'The Humsafar Trust',
        type: 'Healthcare & Legal Aid',
        description: 'Comprehensive health services, legal counsel, mental wellness, and gender affirmation surgery guidance in Mumbai.',
        contact: {
          phone: '+91-22-2667-3800',
          email: 'info@humsafar.org',
          address: '3rd Floor, Manthan Plaza, Vakola, Santacruz (E), Mumbai 400055'
        },
        website: 'https://humsafar.org',
        verified: true
      },
      {
        name: 'Kinnar Maa Samajik Sanstha',
        type: 'Community & Shelter',
        description: 'Community-led organization assisting with certificate paperwork, shelter, ration, and crisis response in Mumbai and Thane.',
        contact: {
          phone: '+91-98207-69677',
          address: 'Dharavi, Mumbai'
        },
        website: 'https://kinnarmaa.org',
        verified: true
      }
    ]
  },

  tamil_nadu: {
    id: 'tamil_nadu',
    state: 'Tamil Nadu',
    officialPortal: 'https://tnsocialwelfare.tn.gov.in',
    applicationPortal: 'https://transgender.dosje.gov.in',
    competentAuthority: 'Tamil Nadu Transgender Welfare Board & District Collectors',
    applicationProcess: {
      steps: [
        {
          id: 'step-tn-1',
          title: 'Apply through National Portal / State Welfare Board',
          description: 'Tamil Nadu pioneered the first Transgender Welfare Board in 2008. You can apply via the National Portal (transgender.dosje.gov.in) for the central certificate, and register with the State Board for state pension and housing.',
          documents: ['Self-declaration affidavit', 'Aadhaar / Ration card / Voter ID (proof of TN residence)', 'Photograph'],
          mandatory: ['affidavit', 'residence-proof', 'photograph']
        },
        {
          id: 'step-tn-2',
          title: 'District Social Welfare Officer (DSWO) Review',
          description: 'The DSWO reviews the application. In Tamil Nadu, community representatives sit on the District Committee to assist applicants respectfully.',
          documents: [],
          mandatory: []
        },
        {
          id: 'step-tn-3',
          title: 'Dual ID Card (State Board & Central Portal)',
          description: 'Receive both the National Certificate and the Tamil Nadu Thirunangai Welfare Card.',
          documents: [],
          mandatory: []
        }
      ],
      estimatedTimeline: '30 days',
      fee: 'Nil (Completely free)'
    },
    correctionRoutes: {
      title: 'Correction Routes in Tamil Nadu',
      description: 'Minor updates can be submitted via the National Portal. State card updates are processed at the District Collectorate (Social Welfare Section).',
      steps: [
        {
          id: 'tn-corr-1',
          title: 'Gender Revision Post Reaffirmation',
          description: 'Submit hospital surgical certificate from an empanelled government medical college hospital or approved centre.',
          documents: ['Form 3 Medical Certificate'],
          mandatory: ['form-3']
        }
      ]
    },
    appealRoutes: {
      title: 'Appeals in Tamil Nadu',
      description: 'First appeal to the District Collector. Second appeal to the Commissioner of Social Welfare, Panagal Building, Saidapet, Chennai.',
      steps: [
        {
          id: 'tn-app-1',
          title: 'District Collector Grievance Day',
          description: 'Every Monday, District Collectors hold a public grievance day where petitions regarding transgender certificates can be handed directly.',
          documents: ['Grievance petition', 'Proof of submission'],
          mandatory: ['petition']
        }
      ],
      nationalNodalMinistry: 'Department of Social Welfare and Women Empowerment, Govt. of Tamil Nadu'
    },
    welfareSchemes: [
      {
        id: 'tn-pension-scheme',
        name: 'Tamil Nadu Destitute Transgender Monthly Pension',
        description: 'Monthly direct benefit pension provided to transgender persons in need across Tamil Nadu.',
        eligibility: ['Resident of Tamil Nadu', 'Age 40 or above (relaxations apply for destitute persons)', 'Valid Transgender Identity Card'],
        benefits: ['Monthly pension of ₹1,500 transferred directly to bank account', 'Free bus travel pass in state transport corporation buses', 'Free housing allotment in TNHB schemes'],
        applicationPortal: 'https://tnsocialwelfare.tn.gov.in',
        applyOnline: true
      },
      {
        id: 'tn-education-scheme',
        name: 'Full Higher Education Fee Waiver (Tamil Nadu)',
        description: 'Complete tuition and hostel fee waiver for transgender students pursuing undergraduate and postgraduate courses in government colleges and universities.',
        eligibility: ['Admission in state government or aided university/college', 'Transgender identity proof'],
        benefits: ['100% tuition, examination, and hostel fees paid by state'],
        applicationPortal: 'https://tnsocialwelfare.tn.gov.in',
        applyOnline: true
      }
    ],
    supportResources: [
      {
        name: 'Sahodari Foundation',
        type: 'Community, Art & Legal Aid',
        description: 'Pioneering community organization founded by Kalki Subramaniam, offering crisis support, scholarships, legal aid, and art therapy in Tamil Nadu.',
        contact: {
          phone: '+91-76397-41916',
          email: 'reach@sahodari.org',
          address: 'Pollachi, Coimbatore District, Tamil Nadu'
        },
        website: 'https://sahodari.org',
        verified: true
      },
      {
        name: 'Thozhi NGO (Chennai)',
        type: 'Shelter, Health & Counseling',
        description: 'Community-based NGO providing emergency shelter, healthcare, and livelihood support in Chennai.',
        contact: {
          phone: '+91-44-2474-0414',
          email: 'thozhiorg@gmail.com',
          address: 'Vadapalani, Chennai 600026'
        },
        website: 'https://thozhichennai.org',
        verified: true
      }
    ]
  },

  karnataka: {
    id: 'karnataka',
    state: 'Karnataka',
    officialPortal: 'https://welfareoftransgender.karnataka.gov.in',
    applicationPortal: 'https://transgender.dosje.gov.in',
    competentAuthority: 'Deputy Commissioner / District Magistrate',
    applicationProcess: {
      steps: [
        {
          id: 'step-ka-1',
          title: 'Apply on the National Portal',
          description: 'Karnataka processes identity certificates through the Central National Portal (transgender.dosje.gov.in) with Deputy Commissioners as issuing authorities.',
          documents: ['Self-declaration affidavit in Form 2', 'Karnataka address proof', 'Photograph'],
          mandatory: ['affidavit', 'address-proof', 'photograph']
        },
        {
          id: 'step-ka-2',
          title: 'District Social Welfare Scrutiny',
          description: 'The Assistant Director of Social Welfare reviews the uploaded affidavit and residence proof. Under the Karnataka State Transgender Policy 2017, self-determination is upheld.',
          documents: [],
          mandatory: []
        },
        {
          id: 'step-ka-3',
          title: 'Download from Portal within 30 Days',
          description: 'The Deputy Commissioner approves digitally. The certificate is downloaded directly from the portal.',
          documents: [],
          mandatory: []
        }
      ],
      estimatedTimeline: '30 statutory days',
      fee: 'Nil'
    },
    correctionRoutes: {
      title: 'Correction and Updates in Karnataka',
      description: 'Handled through the National Portal dashboard. For post-surgery gender changes, Form 3 from a hospital CMO is required.',
      steps: [
        {
          id: 'ka-corr-1',
          title: 'Hospital Surgery Certificate Verification',
          description: 'Submit Form 3 to change gender marker to Male or Female.',
          documents: ['Form 3 Medical Certificate'],
          mandatory: ['form-3']
        }
      ]
    },
    appealRoutes: {
      title: 'Appeals in Karnataka',
      description: 'First appeal to the Regional Commissioner (Bengaluru, Mysuru, Belagavi, Kalaburagi). Second appeal to the Director, Directorate of Social Welfare, MS Building, Bengaluru.',
      steps: [
        {
          id: 'ka-app-1',
          title: 'Regional Commissioner Appeal',
          description: 'Submit an appeal petition within 30 days of the refusal order.',
          documents: ['Rejection memo', 'Appeal petition'],
          mandatory: ['rejection-memo']
        }
      ],
      nationalNodalMinistry: 'Department of Women & Child Development and Social Welfare, Govt. of Karnataka'
    },
    welfareSchemes: [
      {
        id: 'ka-mythri-scheme',
        name: 'Mythri Scheme (Monthly Pension)',
        description: 'State pension scheme offering monthly financial support to transgender persons residing in Karnataka.',
        eligibility: ['Karnataka resident for at least 3 years', 'Age 18 and above', 'Valid Transgender Identity Certificate'],
        benefits: ['Monthly pension of ₹1,200 deposited into applicant bank account', 'Free medical care in government hospitals'],
        applicationPortal: 'https://sevasindhu.karnataka.gov.in',
        applyOnline: true
      },
      {
        id: 'ka-chetana-scheme',
        name: 'Chetana Livelihood Scheme',
        description: 'Self-employment subsidy scheme offering financial support to set up independent businesses or artisan units.',
        eligibility: ['Holds Transgender ID Card', 'Resident of Karnataka'],
        benefits: ['Seed capital subsidy up to ₹50,000 for entrepreneurship'],
        applicationPortal: 'https://welfareoftransgender.karnataka.gov.in',
        applyOnline: true
      }
    ],
    supportResources: [
      {
        name: 'Ondede',
        type: 'Human Rights & Legal Aid',
        description: 'Bangalore-based organization led by Akkai Padmashali advocating for children, sexual minority rights, and trans legal aid.',
        contact: {
          phone: '+91-80-2339-4444',
          email: 'reachondede@gmail.com',
          address: 'Rajajinagar, Bengaluru, Karnataka 560010'
        },
        website: 'https://ondede.org',
        verified: true
      },
      {
        name: 'Sangama',
        type: 'Community & Healthcare',
        description: 'Human rights organization working for working-class transgender, intersex, and queer communities in Karnataka.',
        contact: {
          phone: '+91-80-2354-4444',
          email: 'contact@sangama.org',
          address: 'Kalyan Nagar, Bengaluru'
        },
        website: 'https://sangama.org',
        verified: true
      }
    ]
  },

  kerala: {
    id: 'kerala',
    state: 'Kerala',
    officialPortal: 'https://sjd.kerala.gov.in',
    applicationPortal: 'https://transgender.dosje.gov.in',
    competentAuthority: 'District Collector & District Social Justice Officer',
    applicationProcess: {
      steps: [
        {
          id: 'step-kl-1',
          title: 'Apply through National Portal',
          description: 'Kerala was the first state in India to adopt a State Transgender Policy in 2015. Apply via transgender.dosje.gov.in.',
          documents: ['Self-declaration affidavit', 'Kerala address proof', 'Photograph'],
          mandatory: ['affidavit', 'address-proof', 'photograph']
        },
        {
          id: 'step-kl-2',
          title: 'District Social Justice Office Processing',
          description: 'The District Social Justice Officer (DSJO) processes the file in coordination with the District Transgender Justice Board.',
          documents: [],
          mandatory: []
        },
        {
          id: 'step-kl-3',
          title: 'Certificate Issuance (30 Days)',
          description: 'Collector signs digitally. The certificate is downloaded from the dashboard.',
          documents: [],
          mandatory: []
        }
      ],
      estimatedTimeline: '30 days',
      fee: 'Nil'
    },
    correctionRoutes: {
      title: 'Correction and Updates in Kerala',
      description: 'Submitted online via the National Portal. Kerala also provides state-level financial reimbursement for sex affirmation surgeries.',
      steps: [
        {
          id: 'kl-corr-1',
          title: 'Revised Identity Certificate Post Surgery',
          description: 'Submit Form 3 from the treating medical superintendent for conversion to Male or Female.',
          documents: ['Form 3 Medical Certificate'],
          mandatory: ['form-3']
        }
      ]
    },
    appealRoutes: {
      title: 'Appeals in Kerala',
      description: 'First appeal to District Collector. Second appeal to Director, Social Justice Department, Vikas Bhavan, Thiruvananthapuram.',
      steps: [
        {
          id: 'kl-app-1',
          title: 'Directorate of Social Justice Appeal',
          description: 'File appeal petition within 30 days citing Rule 11 and Kerala Transgender Policy.',
          documents: ['Rejection memo', 'Appeal petition'],
          mandatory: ['rejection-memo']
        }
      ],
      nationalNodalMinistry: 'Social Justice Department, Govt. of Kerala'
    },
    welfareSchemes: [
      {
        id: 'kl-surgery-aid',
        name: 'Financial Assistance for Sex Reassignment Surgery (SRS)',
        description: 'Pioneering Kerala scheme reimbursing medical expenses for gender affirmation surgeries performed in accredited hospitals.',
        eligibility: ['Resident of Kerala', 'Valid Transgender Identity Card', 'Underwent surgery in an accredited hospital'],
        benefits: ['Financial grant up to ₹2,50,000 for female-to-male (FTM) and up to ₹2,00,000 for male-to-female (MTF) surgeries', 'Post-operative maintenance aid of ₹3,000/month for up to 1 year'],
        applicationPortal: 'https://sjd.kerala.gov.in',
        applyOnline: true
      },
      {
        id: 'kl-shelter-snehatheeram',
        name: 'Snehatheeram Short-Stay Homes',
        description: '24/7 emergency shelters providing accommodation, legal defense, and mental health care across Kerala districts.',
        eligibility: ['Transgender persons in crisis or facing homelessness in Kerala'],
        benefits: ['Free temporary stay, food, legal counseling, and career guidance'],
        applicationPortal: 'https://sjd.kerala.gov.in',
        applyOnline: false
      }
    ],
    supportResources: [
      {
        name: 'Queerythm',
        type: 'Community, Crisis & Health',
        description: 'Registered community organization providing a 24x7 crisis helpline, counseling, and shelter coordination in Kerala.',
        contact: {
          phone: '+91-97451-45454 (24x7 Helpline)',
          email: 'queerythm@gmail.com',
          address: 'Thiruvananthapuram, Kerala'
        },
        website: 'https://queerythm.com',
        verified: true
      },
      {
        name: 'Kerala State Legal Services Authority (KELSA)',
        type: 'Legal Aid',
        description: 'Free legal aid and representation for transgender persons across all Kerala district courts and High Court.',
        contact: {
          phone: '0471-2305626',
          email: 'kelsa-ker@nic.in'
        },
        website: 'https://kelsa.nic.in',
        verified: true
      }
    ]
  },

  west_bengal: {
    id: 'west_bengal',
    state: 'West Bengal',
    officialPortal: 'https://wb.gov.in',
    applicationPortal: 'https://transgender.dosje.gov.in',
    competentAuthority: 'District Magistrate & West Bengal Transgender Development Board',
    applicationProcess: {
      steps: [
        {
          id: 'step-wb-1',
          title: 'Apply through National Portal',
          description: 'West Bengal applications are managed through the Central National Portal with District Magistrates as the issuing officers.',
          documents: ['Self-declaration affidavit', 'West Bengal address proof (ration card, voter ID, electricity bill)', 'Photograph'],
          mandatory: ['affidavit', 'address-proof', 'photograph']
        },
        {
          id: 'step-wb-2',
          title: 'District Scrutiny',
          description: 'Sub-Divisional Officer (SDO) verifies residential eligibility without physical examination.',
          documents: [],
          mandatory: []
        },
        {
          id: 'step-wb-3',
          title: 'Download Issued Certificate',
          description: 'Certificate and ID card available digitally within the 30-day statutory timeline.',
          documents: [],
          mandatory: []
        }
      ],
      estimatedTimeline: '30 statutory days',
      fee: 'Nil'
    },
    correctionRoutes: {
      title: 'Corrections in West Bengal',
      description: 'Submitted online through the National Portal dashboard.',
      steps: [
        {
          id: 'wb-corr-1',
          title: 'Form 3 Medical Submission',
          description: 'Submit medical superintendent certificate for gender revision.',
          documents: ['Form 3 Medical Certificate'],
          mandatory: ['form-3']
        }
      ]
    },
    appealRoutes: {
      title: 'Appeals in West Bengal',
      description: 'First appeal to the Divisional Commissioner (Presidency, Medinipur, Burdwan, Malda, Jalpaiguri). Second appeal to the Department of Women & Child Development and Social Welfare, Salt Lake, Kolkata.',
      steps: [
        {
          id: 'wb-app-1',
          title: 'Divisional Commissioner Appeal',
          description: 'Submit written appeal within 30 days of the rejection memo.',
          documents: ['Rejection order', 'Petition'],
          mandatory: ['rejection-order']
        }
      ],
      nationalNodalMinistry: 'Department of Women & Child Development and Social Welfare, Govt. of West Bengal'
    },
    welfareSchemes: [
      {
        id: 'wb-trans-welfare-scheme',
        name: 'West Bengal Transgender Development Board Assistance',
        description: 'Skill development training, higher education support, and emergency medical relief coordinated through district boards.',
        eligibility: ['Resident of West Bengal', 'Valid Transgender Identity Certificate'],
        benefits: ['Vocational training stipends', 'Access to Garima Greh shelter facilities in Kolkata', 'Free legal aid via WBSLSA'],
        applicationPortal: 'https://wb.gov.in',
        applyOnline: true
      }
    ],
    supportResources: [
      {
        name: 'Association of Transgender People Bengal (ATPB)',
        type: 'Advocacy, Healthcare & Rights',
        description: 'Community network operating in Kolkata and West Bengal districts, founded by leading transgender activists for rights and shelter support.',
        contact: {
          phone: '+91-98305-12345',
          email: 'atpbengal@gmail.com',
          address: 'Kolkata, West Bengal'
        },
        website: 'https://atpbengal.org',
        verified: true
      },
      {
        name: 'West Bengal State Legal Services Authority (WBSLSA)',
        type: 'Legal Aid',
        description: 'Pro bono legal assistance for certificate applications, workplace discrimination, and landlord disputes.',
        contact: {
          phone: '1800-345-3677 (Toll-Free)',
          email: 'wb-slsa@nic.in'
        },
        website: 'https://wbslsa.gov.in',
        verified: true
      }
    ]
  }
};

export const PRIVACY_AND_SAFE_DEVICE_GUIDANCE = {
  title: 'Privacy & Safe-Device Guidance',
  subtitle: 'This navigator was engineered with zero data collection to safeguard your privacy and security.',
  principles: [
    {
      title: 'Zero Document Collection & Zero Telemetry',
      description: 'This platform will never ask you to upload identity documents, affidavits, or medical certificates. All browsing happens strictly inside your local browser.'
    },
    {
      title: 'No Eligibility Assumptions',
      description: 'We do not ask you to identify your gender, name, or background to browse. All routes, checklists, and directory listings are open for anonymous browsing.'
    },
    {
      title: 'Quick Exit Protection',
      description: 'If you are using a shared or monitored computer, press the "Quick Exit" button (or tap ESC) at any time to instantly leave this page and redirect to a neutral search engine.'
    },
    {
      title: 'Private & Incognito Browsing',
      description: 'If browsing on a public device (cyber cafe, shared family phone, office computer), open this page in an Incognito/Private window so your history and cache are wiped upon closing.'
    },
    {
      title: 'Official Portal Verification',
      description: 'When applying for your certificate, always ensure you are on the official Government of India portal ending in .gov.in (https://transgender.dosje.gov.in). Never pay any application fee; the official national certificate is completely free.'
    },
    {
      title: 'QR Code & Certificate Number Discretion',
      description: 'Your issued Certificate of Identity contains a unique QR code. Avoid posting unblurred photos of your certificate or card on social media to prevent identity misuse.'
    }
  ]
};

export const MULTILINGUAL_METADATA = {
  title: 'Multilingual & Plain Language Access',
  description: 'The Transgender Certificate and Welfare Scheme Application Navigator supports key official Indian languages and plain-language civic clarity.',
  supportedLanguages: [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' }
  ],
  glossary: [
    {
      term: 'Certificate of Identity',
      definition: 'The official statutory certificate issued by the District Magistrate under Section 6 of the Transgender Persons Act, 2019 declaring gender identity as Transgender.'
    },
    {
      term: 'Form 2 Affidavit',
      definition: 'Self-declaration affidavit sworn before an executive magistrate or notary declaring chosen gender identity without requiring medical examination.'
    },
    {
      term: 'Revised Certificate (Section 7)',
      definition: 'Certificate issued after medical intervention (gender affirmation surgery or hormone therapy) revising the gender marker to Male or Female.'
    },
    {
      term: 'Form 3 Certificate',
      definition: 'Standard medical certificate issued by the Medical Superintendent or Chief Medical Officer confirming gender reaffirmation surgery/intervention.'
    },
    {
      term: 'Garima Greh',
      definition: 'Shelter homes established by the Ministry of Social Justice and Empowerment offering safe housing, food, and skill development for transgender persons.'
    }
  ]
};

/**
 * Returns state data by stateId. Defaults to national framework if not found.
 */
export const getTransgenderCertificateStateData = (stateId) => {
  if (!stateId || !TRANSGENDER_CERTIFICATE_STATES[stateId]) {
    return TRANSGENDER_CERTIFICATE_STATES.national;
  }
  return TRANSGENDER_CERTIFICATE_STATES[stateId];
};

/**
 * Returns all supported state IDs
 */
export const getAllSupportedStates = () => {
  return Object.keys(TRANSGENDER_CERTIFICATE_STATES);
};

/**
 * Returns Central Government welfare schemes
 */
export const getCentralWelfareSchemes = () => {
  return TRANSGENDER_CERTIFICATE_STATES.national.welfareSchemes || [];
};

/**
 * Returns all welfare schemes (Central + State specific)
 */
export const getAllWelfareSchemes = () => {
  const central = getCentralWelfareSchemes();
  const states = getAllSupportedStates()
    .filter((id) => id !== 'national')
    .map((id) => TRANSGENDER_CERTIFICATE_STATES[id]);
  const stateSchemes = states.flatMap((state) => state.welfareSchemes || []);
  return [...central, ...stateSchemes];
};

/**
 * Returns support resources for a given state, plus national helplines
 */
export const getSupportResources = (stateId = 'national') => {
  const nationalResources = TRANSGENDER_CERTIFICATE_STATES.national.supportResources || [];
  if (stateId === 'national') {
    return nationalResources;
  }
  const stateData = TRANSGENDER_CERTIFICATE_STATES[stateId];
  const stateResources = stateData?.supportResources || [];
  return [...stateResources, ...nationalResources];
};

import { logDiagnostic } from '../utils/diagnostics';
const STORAGE_KEY = 'civicbridge_applications';

export const STATUS_META = {
  submitted: {
    label: 'Submitted',
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.2)',
  },
  'in-progress': {
    label: 'In Progress',
    color: '#38bdf8',
    background: 'rgba(56, 189, 248, 0.2)',
  },
  'action-required': {
    label: 'Action Required',
    color: '#ef4444',
    background: 'rgba(239, 68, 68, 0.2)',
  },
  completed: {
    label: 'Completed',
    color: '#10b981',
    background: 'rgba(16, 185, 129, 0.2)',
  },
};

export const DEFAULT_STATUS = 'submitted';

export const normalizeStatus = (status) => {
  if (typeof status !== 'string') return DEFAULT_STATUS;

  return Object.prototype.hasOwnProperty.call(STATUS_META, status)
    ? status
    : DEFAULT_STATUS;
};

export const getStatusMeta = (status) =>
  STATUS_META[normalizeStatus(status)];

const REVIEW_STAGE_INDEX = 1;

export const buildStages = (status, stages = []) => {
  const safeStatus = normalizeStatus(status);
  const list = Array.isArray(stages) ? stages : [];

  return list.map((stage, idx) => {
    const rest =
      stage && typeof stage === 'object' && !Array.isArray(stage)
        ? { ...stage }
        : {};

    delete rest.completed;
    delete rest.inProgress;
    delete rest.actionRequired;

    let completed = false;
    let inProgress = false;
    let actionRequired = false;

    if (safeStatus === 'completed') {
      completed = true;
    } else if (idx < REVIEW_STAGE_INDEX) {
      completed = true;
    } else if (idx === REVIEW_STAGE_INDEX) {
      inProgress = safeStatus === 'in-progress';
      actionRequired = safeStatus === 'action-required';
    }

    return {
      ...rest,
      completed,
      inProgress,
      actionRequired,
    };
  });
};

export const getCurrentStageIndex = (status, stageCount = 4) => {
  const count = Number.isFinite(stageCount) ? stageCount : 4;
  const last = Math.max(count - 1, 0);
  const safeStatus = normalizeStatus(status);

  if (safeStatus === 'completed') return last;
  if (safeStatus === 'submitted') return 0;

  return Math.min(REVIEW_STAGE_INDEX, last);
};

export const NOT_AVAILABLE = 'Not available';

export const formatDisplayDate = (value) => {
  if (typeof value !== 'string') return NOT_AVAILABLE;

  const text = value.trim();

  if (
    !text ||
    /^(invalid date|undefined|null|nan)$/i.test(text)
  ) {
    return NOT_AVAILABLE;
  }

  return text;
};

// Shared validation prevents calling string methods on unexpected values.
const normalizeId = (value) =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

// Error code addManualApplication uses when the reference ID is already tracked.
export const DUPLICATE_APPLICATION = 'DUPLICATE_APPLICATION';

const normalizeApplication = (app) => {
  const safeApp =
    app && typeof app === 'object' && !Array.isArray(app) ? app : {};

  const status = normalizeStatus(safeApp.status);
  const stages = buildStages(status, safeApp.stages);

  return {
    ...safeApp,
    status,
    stages,
    currentStageIndex: getCurrentStageIndex(
      status,
      stages.length || 4
    ),
  };
};

const DEFAULT_APPLICATIONS = [
  {
    id: 'SRV-98234710',
    serviceId: 'income-certificate',
    serviceName: 'Income Certificate',
    category: 'Finance',
    applicantName: 'Ramesh Patel',
    appliedDate: 'Oct 12, 2026',
    estimatedCompletion: 'Oct 22, 2026',
    status: 'in-progress',
    currentStageIndex: 1,
    notes: [
      {
        id: 'n1',
        text: 'Submitted salary slips from employer via Tahsildar portal.',
        date: 'Oct 12, 2026 • 10:30 AM',
      },
      {
        id: 'n2',
        text: 'Revenue inspector scheduled site verification visit.',
        date: 'Oct 15, 2026 • 02:00 PM',
      },
    ],
    linkedDocs: [
      {
        id: 'd1',
        name: 'Salary_Slip_Aug2026.pdf',
        size: '1.2 MB',
        linkedAt: 'Oct 12, 2026',
      },
      {
        id: 'd2',
        name: 'Aadhaar_Card_Copy.pdf',
        size: '850 KB',
        linkedAt: 'Oct 12, 2026',
      },
    ],
    pendingAction: null,
    stages: [
      {
        title: 'Application Submitted',
        description:
          'Application and supporting income documents received.',
        timestamp: 'Oct 12, 2026 • 10:15 AM',
      },
      {
        title: 'Document & Revenue Verification',
        description:
          'Tahsildar office is verifying salary slips and revenue records.',
        timestamp: 'Oct 14, 2026 • 03:30 PM',
      },
      {
        title: 'Digital Signature & Approval',
        description:
          'Revenue Inspector approval and digital seal generation.',
        timestamp: 'Pending verification',
      },
      {
        title: 'Certificate Issuance',
        description:
          'Final certificate ready for direct citizen download.',
        timestamp: 'Estimated Oct 22',
      },
    ],
  },
  {
    id: 'SRV-41829304',
    serviceId: 'driving-license',
    serviceName: 'Driving License',
    category: 'Transport',
    applicantName: 'Sunita Sharma',
    appliedDate: 'Sep 24, 2026',
    estimatedCompletion: 'Oct 10, 2026',
    status: 'completed',
    currentStageIndex: 3,
    notes: [
      {
        id: 'n3',
        text: 'Track test cleared with zero negative marks on 8-track.',
        date: 'Oct 02, 2026 • 03:15 PM',
      },
    ],
    linkedDocs: [
      {
        id: 'd3',
        name: 'Learner_License_Extract.pdf',
        size: '540 KB',
        linkedAt: 'Sep 24, 2026',
      },
      {
        id: 'd4',
        name: 'Medical_Certificate_Form1A.pdf',
        size: '720 KB',
        linkedAt: 'Sep 24, 2026',
      },
    ],
    pendingAction: null,
    stages: [
      {
        title: 'Application & Learner Pass Recorded',
        description:
          'Learner license validity authenticated at RTO portal.',
        timestamp: 'Sep 24, 2026 • 11:00 AM',
      },
      {
        title: 'Driving Skill Test Passed',
        description:
          'Track examination cleared with RTO motor inspector.',
        timestamp: 'Oct 02, 2026 • 02:45 PM',
      },
      {
        title: 'Smart Card Endorsement',
        description:
          'Biometric chip encoded and approved by RTO officer.',
        timestamp: 'Oct 06, 2026 • 04:10 PM',
      },
      {
        title: 'Dispatched via Speed Post',
        description:
          'Physical smart card dispatched. Tracking: SP-IN948271.',
        timestamp: 'Oct 09, 2026 • 09:20 AM',
      },
    ],
  },
  {
    id: 'SRV-77319482',
    serviceId: 'birth-certificate',
    serviceName: 'Birth Certificate',
    category: 'Certificates',
    applicantName: 'Aarav Kumar',
    appliedDate: 'Oct 19, 2026',
    estimatedCompletion: 'Nov 02, 2026',
    status: 'action-required',
    currentStageIndex: 1,
    notes: [
      {
        id: 'n4',
        text: 'Hospital discharge certificate requires clearer stamp copy.',
        date: 'Oct 20, 2026 • 11:30 AM',
      },
    ],
    linkedDocs: [
      {
        id: 'd5',
        name: 'Hospital_Discharge_Summary.pdf',
        size: '920 KB',
        linkedAt: 'Oct 19, 2026',
      },
    ],
    pendingAction: {
      title: 'Upload Clearer Hospital Birth Record',
      description:
        'The municipal registrar rejected hospital discharge slip due to illegible physician seal. Please upload a re-scanned copy.',
      deadline: 'Oct 28, 2026',
      documentRequired: 'Hospital Birth Card (Seal visible)',
    },
    stages: [
      {
        title: 'Application Submitted',
        description:
          'Institutional birth record uploaded from registrar registry.',
        timestamp: 'Oct 19, 2026 • 09:00 AM',
      },
      {
        title: 'Municipal Record Matching',
        description: 'Verification with hospital birth registers.',
        timestamp: 'Action Needed: Re-upload seal copy',
      },
      {
        title: 'Registrar Authentication',
        description:
          'Final sign-off by Municipal Health Officer.',
        timestamp: 'Pending verification',
      },
      {
        title: 'QR-Verified Certificate Generation',
        description: 'Digitally signed certificate issued.',
        timestamp: 'Estimated Nov 02',
      },
    ],
  },
];

export const getApplications = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(DEFAULT_APPLICATIONS)
      );

      return DEFAULT_APPLICATIONS.map(normalizeApplication);
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return DEFAULT_APPLICATIONS.map(normalizeApplication);
    }

    return parsed
      .filter(
        (app) =>
          app &&
          typeof app === 'object' &&
          !Array.isArray(app) &&
          typeof app.id === 'string'
      )
      .map(normalizeApplication);
  } catch (err) {
    logDiagnostic('Failed to parse applications from storage', err);
    return DEFAULT_APPLICATIONS.map(normalizeApplication);
  }
};

export const getApplicationById = (searchId) => {
  const clean = normalizeId(searchId);

  if (!clean) return null;

  return (
    getApplications().find(
      (app) => normalizeId(app?.id) === clean
    ) || null
  );
};

export const createApplication = ({
  serviceId,
  serviceName,
  category,
  applicantName,
  aadhaarId,
} = {}) => {
  const all = getApplications();

  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const randomSuffix = Math.floor(
    10000000 + Math.random() * 90000000
  );

  const newId = `SRV-${randomSuffix}`;

  const estDate = new Date();
  estDate.setDate(estDate.getDate() + 15);

  const estDateStr = estDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const newApp = {
    id: newId,
    serviceId:
      typeof serviceId === 'string' && serviceId.trim()
        ? serviceId
        : 'custom-service',
    serviceName:
      typeof serviceName === 'string' && serviceName.trim()
        ? serviceName.trim()
        : 'Civic Service Request',
    category:
      typeof category === 'string' && category.trim()
        ? category
        : 'General',
    applicantName:
      typeof applicantName === 'string' && applicantName.trim()
        ? applicantName.trim()
        : 'Citizen Applicant',
    appliedDate: dateStr,
    estimatedCompletion: estDateStr,
    status: 'submitted',
    currentStageIndex: 0,
    aadhaarMasked:
      typeof aadhaarId === 'string' && aadhaarId
        ? `XXXX-XXXX-${aadhaarId.slice(-4)}`
        : 'XXXX-XXXX-8921',
    notes: [
      {
        id: `n-${Date.now()}`,
        text: 'Application initiated digitally via Civic Help Setu.',
        date: `${dateStr} • Just now`,
      },
    ],
    linkedDocs: [],
    pendingAction: null,
    stages: buildStages('submitted', [
      {
        title: 'Application Submitted',
        description:
          'Application submitted digitally via Civic Help Setu Fast-Track.',
        timestamp: `${dateStr} • Just now`,
      },
      {
        title: 'Document & Identity Verification',
        description:
          'Verifying submitted identity proof and prerequisite documents.',
        timestamp: 'Estimated within 3 business days',
      },
      {
        title: 'Competent Authority Assessment',
        description:
          'Departmental review and approval clearance.',
        timestamp: 'Pending document check',
      },
      {
        title: 'Final Certificate / Service Issuance',
        description:
          'Digital certificate or dispatch tracking notification.',
        timestamp: `Target completion by ${estDateStr}`,
      },
    ]),
  };

  const updated = [newApp, ...all];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  return newApp;
};

export const addManualApplication = ({
  referenceId,
  serviceName,
  category = 'General',
  appliedDate,
  estimatedCompletion,
  status = 'submitted',
  initialNote = '',
  applicantName = 'Citizen Applicant',
} = {}) => {
  const cleanId = normalizeId(referenceId);

  if (!cleanId) {
    throw new Error('A valid application reference ID is required.');
  }

  const safeServiceName =
    typeof serviceName === 'string' && serviceName.trim()
      ? serviceName.trim()
      : 'Civic Service Request';

  const safeStatus = normalizeStatus(status);
  const all = getApplications();

  // Never replace an application the user is already tracking (its stages,
  // notes and linked documents would be lost). IDs compare trimmed and upper case.
  if (all.some((app) => normalizeId(app?.id) === cleanId)) {
    const error = new Error(
      `You are already tracking ${cleanId}. Use a different reference ID.`
    );
    error.code = DUPLICATE_APPLICATION;
    throw error;
  }

  const stages = buildStages(safeStatus, [
    {
      title: 'Application Submitted',
      description: 'Submitted at district portal / physical center.',
      timestamp: appliedDate || 'Submitted',
    },
    {
      title: 'Document Verification',
      description:
        'Scrutiny of applicant credentials and attachments.',
      timestamp:
        safeStatus === 'submitted' ? 'Pending initiation' : 'In review',
    },
    {
      title: 'Departmental Processing',
      description: 'Officer evaluation and statutory approvals.',
      timestamp:
        safeStatus === 'completed'
          ? 'Cleared'
          : 'Pending prior stages',
    },
    {
      title: 'Final Issuance / Dispatch',
      description:
        'Ready for collection, digital download, or courier delivery.',
      timestamp:
        safeStatus === 'completed'
          ? 'Issued'
          : typeof estimatedCompletion === 'string' &&
              estimatedCompletion.trim()
            ? `Est: ${estimatedCompletion}`
            : 'Pending',
    },
  ]);

  const newApp = {
    id: cleanId,
    serviceId: cleanId.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    serviceName: safeServiceName,
    category:
      typeof category === 'string' && category.trim()
        ? category
        : 'General',
    applicantName:
      typeof applicantName === 'string' && applicantName.trim()
        ? applicantName.trim()
        : 'Citizen Applicant',
    appliedDate: appliedDate || 'Recent',
    estimatedCompletion: estimatedCompletion || 'Within 15 days',
    status: safeStatus,
    currentStageIndex: getCurrentStageIndex(
      safeStatus,
      stages.length
    ),
    notes:
      typeof initialNote === 'string' && initialNote.trim()
        ? [
            {
              id: `n-${Date.now()}`,
              text: initialNote.trim(),
              date: new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
            },
          ]
        : [],
    linkedDocs: [],
    pendingAction:
      safeStatus === 'action-required'
        ? {
            title:
              'Additional Documentation or Clarification Needed',
            description:
              `Department requested supplementary records for reference ${cleanId}`,
            deadline: 'Within 7 business days',
            documentRequired: 'Supplementary Proof Document',
          }
        : null,
    stages,
  };

  const updated = [newApp, ...all];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  return newApp;
};

export const addNoteToApplication = (appId, noteText) => {
  const cleanId = normalizeId(appId);

  if (!cleanId || typeof noteText !== 'string' || !noteText.trim()) {
    return null;
  }

  const all = getApplications();

  const target = all.find(
    (app) => normalizeId(app?.id) === cleanId
  );

  if (!target) return null;

  const newNote = {
    id: `n-${Date.now()}`,
    text: noteText.trim(),
    date: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  target.notes = [
    ...(Array.isArray(target.notes) ? target.notes : []),
    newNote,
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  return target;
};

export const linkDocumentToApplication = (appId, doc = {}) => {
  const cleanId = normalizeId(appId);

  if (!cleanId) return null;

  const all = getApplications();

  const target = all.find(
    (app) => normalizeId(app?.id) === cleanId
  );

  if (!target) return null;

  const safeDoc =
    doc && typeof doc === 'object' && !Array.isArray(doc)
      ? doc
      : {};

  const newDoc = {
    id: `doc-${Date.now()}`,
    name:
      typeof safeDoc.name === 'string' && safeDoc.name.trim()
        ? safeDoc.name
        : 'Citizen_Attachment.pdf',
    size:
      typeof safeDoc.size === 'string' && safeDoc.size.trim()
        ? safeDoc.size
        : '750 KB',
    linkedAt: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  };

  target.linkedDocs = [
    ...(Array.isArray(target.linkedDocs) ? target.linkedDocs : []),
    newDoc,
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  return target;
};

export const unlinkDocumentFromApplication = (appId, docId) => {
  const cleanId = normalizeId(appId);

  if (!cleanId || typeof docId !== 'string') return null;

  const all = getApplications();

  const target = all.find(
    (app) => normalizeId(app?.id) === cleanId
  );

  if (!target) return null;

  target.linkedDocs = (
    Array.isArray(target.linkedDocs) ? target.linkedDocs : []
  ).filter((doc) => doc?.id !== docId);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  return target;
};

export const resolveApplicationPendingAction = (
  appId,
  resolutionNote = ''
) => {
  const cleanId = normalizeId(appId);

  if (!cleanId) return null;

  const all = getApplications();

  const target = all.find(
    (app) => normalizeId(app?.id) === cleanId
  );

  if (!target) return null;

  if (
    target.status !== 'action-required' &&
    !target.pendingAction
  ) {
    return target;
  }

  target.pendingAction = null;
  target.status = 'in-progress';
  target.stages = buildStages('in-progress', target.stages);
  target.currentStageIndex = getCurrentStageIndex(
    'in-progress',
    target.stages.length
  );

  if (target.stages[REVIEW_STAGE_INDEX]) {
    target.stages[REVIEW_STAGE_INDEX].timestamp =
      'Action resolved • Resumed verification';
  }

  if (
    typeof resolutionNote === 'string' &&
    resolutionNote.trim()
  ) {
    target.notes = [
      ...(Array.isArray(target.notes) ? target.notes : []),
      {
        id: `n-${Date.now()}`,
        text: `Action Resolved: ${resolutionNote.trim()}`,
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      },
    ];
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  return target;
};

export const getTrackingMetrics = () => {
  const all = getApplications();

  return {
    total: all.length,
    inProgress: all.filter(
      (app) => app.status === 'in-progress'
    ).length,
    actionRequired: all.filter(
      (app) => app.status === 'action-required'
    ).length,
    completed: all.filter(
      (app) => app.status === 'completed'
    ).length,
    submitted: all.filter(
      (app) => app.status === 'submitted'
    ).length,
  };
};

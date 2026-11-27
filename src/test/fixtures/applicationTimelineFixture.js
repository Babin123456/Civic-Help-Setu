/**
 * Synthetic reviewer data for the application timeline replay and event-difference viewer (#839).
 *
 * All names, departments, reference IDs, timestamps and notes are invented. There is no real
 * citizen, Aadhaar, PAN, contact detail, document content, or official government decision here.
 */

export const REVIEWER_TIMELINE_FIXTURE = Object.freeze({
  applicationId: 'SRV-83900001',
  serviceName: 'Sample Civic Certificate',
  dataVersion: 'fixture839',
  events: [
    {
      eventId: 'evt-839-submission',
      applicationId: 'SRV-83900001',
      category: 'submission',
      sourceType: 'official_portal',
      sourceRef: 'Sample State Services Portal',
      sourceUrl: 'https://services.example.org/sample/application',
      sourceTimestamp: '2026-10-01T09:00:00.000Z',
      ingestedAt: '2026-10-01T09:02:00.000Z',
      status: 'submitted',
      statusTransition: { from: null, to: 'submitted' },
      actorRole: 'citizen',
      payloadVersion: 1,
      payload: {
        title: 'Application received',
        description: 'Sample portal issued a fictional acknowledgement number.',
      },
      isOfficial: true,
      isPrivateGuidance: false,
    },
    {
      eventId: 'evt-839-acknowledgement',
      applicationId: 'SRV-83900001',
      category: 'acknowledgement',
      sourceType: 'official_office',
      sourceRef: 'Sample Municipal Office',
      sourceUrl: 'https://municipal.example.org/sample/records',
      sourceTimestamp: '2026-10-03T11:30:00.000Z',
      ingestedAt: '2026-10-03T11:45:00.000Z',
      status: 'in-progress',
      statusTransition: { from: 'submitted', to: 'in-progress' },
      actorRole: 'reviewer',
      payloadVersion: 1,
      payload: {
        title: 'Acknowledgement recorded',
        description: 'Sample office assigned a fictional file number.',
      },
      isOfficial: true,
      isPrivateGuidance: false,
    },
    {
      eventId: 'evt-839-query',
      applicationId: 'SRV-83900001',
      category: 'query',
      sourceType: 'official_portal',
      sourceRef: 'Sample State Services Portal',
      sourceUrl: 'https://services.example.org/sample/application',
      sourceTimestamp: '2026-10-05T15:10:00.000Z',
      ingestedAt: '2026-10-05T15:12:00.000Z',
      status: 'action-required',
      statusTransition: { from: 'in-progress', to: 'action-required' },
      actorRole: 'reviewer',
      payloadVersion: 2,
      payload: {
        title: 'Clarification requested',
        description: 'Sample office asked for a fictional additional form.',
      },
      isOfficial: true,
      isPrivateGuidance: false,
    },
    {
      eventId: 'evt-839-note',
      applicationId: 'SRV-83900001',
      category: 'query',
      sourceType: 'citizen_note',
      sourceRef: 'Citizen note',
      sourceTimestamp: '2026-10-06T08:20:00.000Z',
      ingestedAt: '2026-10-06T08:21:00.000Z',
      status: null,
      statusTransition: null,
      actorRole: 'citizen',
      payloadVersion: 1,
      payload: {
        text: 'Private reminder to visit the sample office with the additional form.',
        privateGuidance: true,
      },
      isOfficial: false,
      isPrivateGuidance: true,
    },
    {
      eventId: 'evt-839-outcome',
      applicationId: 'SRV-83900001',
      category: 'outcome',
      sourceType: 'official_office',
      sourceRef: 'Sample Municipal Office',
      sourceUrl: 'https://municipal.example.org/sample/records',
      sourceTimestamp: '2026-10-12T16:00:00.000Z',
      ingestedAt: '2026-10-12T16:04:00.000Z',
      status: 'completed',
      statusTransition: { from: 'action-required', to: 'completed' },
      actorRole: 'reviewer',
      payloadVersion: 2,
      payload: {
        title: 'Sample outcome recorded',
        description: 'Fictional office record marks the sample workflow complete.',
      },
      isOfficial: true,
      isPrivateGuidance: false,
    },
  ],
});

export const REVIEWER_TIMELINE_ANOMALY_FIXTURE = Object.freeze({
  ...REVIEWER_TIMELINE_FIXTURE,
  dataVersion: 'fixture839-anomaly',
  anomalies: [
    {
      type: 'out_of_order',
      severity: 'medium',
      eventIds: ['evt-839-acknowledgement'],
      message: 'The acknowledgement was ingested after a later-dated sample event.',
    },
  ],
});

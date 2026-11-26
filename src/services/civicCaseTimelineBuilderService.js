/**
 * @file civicCaseTimelineBuilderService.js
 * @description Extracts, normalizes, and sequences temporal events from unstructured citizen records,
 * receipts, RTI responses, and letters into a verifiable, chronological case timeline.
 */

export class CivicCaseTimelineBuilderService {
  constructor() {
    this.knownDateRegexes = [
      // YYYY-MM-DD
      /\b(\d{4})-(\d{2})-(\d{2})\b/,
      // DD/MM/YYYY or DD-MM-YYYY
      /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/,
      // Month DD, YYYY (e.g. March 15, 2026 or 15 March 2026)
      /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(\d{4})\b/i
    ];
  }

  /**
   * Parses raw citizen documents/records into candidate timeline events with provenance references.
   */
  extractEventsFromRecords(records = []) {
    const events = [];

    records.forEach(record => {
      const text = record.content || '';
      const lines = text.split('\n');

      lines.forEach((line, lineIndex) => {
        const dateMatch = this.detectDate(line);
        if (dateMatch) {
          const eventType = this.classifyEventType(line);
          events.push({
            id: `evt_${record.id}_${lineIndex}`,
            recordId: record.id,
            sourceTitle: record.title || 'Untitled Record',
            rawDateString: dateMatch.raw,
            normalizedDate: dateMatch.normalized,
            description: line.trim(),
            eventType,
            confidence: dateMatch.confidence,
            citation: {
              recordId: record.id,
              sourceReference: record.sourceReference || 'citizen-upload',
              snippet: line.trim()
            }
          });
        }
      });
    });

    return events;
  }

  /**
   * Sorts candidate events chronologically, identifying gaps and inconsistencies.
   */
  buildChronologicalTimeline(records = []) {
    const events = this.extractEventsFromRecords(records);

    // Sort chronologically ascending
    const sorted = [...events].sort((a, b) => {
      return new Date(a.normalizedDate) - new Date(b.normalizedDate);
    });

    // Detect time anomalies or unresolved gaps
    const timelineWithGaps = [];
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      timelineWithGaps.push(current);

      if (i < sorted.length - 1) {
        const next = sorted[i + 1];
        const dayDifference = Math.floor(
          (new Date(next.normalizedDate) - new Date(current.normalizedDate)) / (1000 * 60 * 60 * 24)
        );

        if (dayDifference > 90) {
          timelineWithGaps.push({
            id: `gap_${current.id}_${next.id}`,
            isGapNotice: true,
            elapsedDays: dayDifference,
            description: `Potential documentation gap: ${dayDifference} days elapsed without recorded citizen or authority activity.`
          });
        }
      }
    }

    return {
      caseId: `case_timeline_${Date.now()}`,
      totalEventsFound: events.length,
      chronologicalTimeline: timelineWithGaps,
      dateRange: sorted.length > 0 ? {
        earliest: sorted[0].normalizedDate,
        latest: sorted[sorted.length - 1].normalizedDate
      } : null
    };
  }

  detectDate(text) {
    // 1. Check YYYY-MM-DD
    const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoMatch) {
      return { raw: isoMatch[0], normalized: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, confidence: 0.95 };
    }

    // 2. Check DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return { raw: dmyMatch[0], normalized: `${year}-${month}-${day}`, confidence: 0.9 };
    }

    // 3. Month Name DD, YYYY
    const words = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
    if (words) {
      const monthNames = {
        january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
      };
      const month = monthNames[words[2].toLowerCase()];
      const day = words[1].padStart(2, '0');
      const year = words[3];
      return { raw: words[0], normalized: `${year}-${month}-${day}`, confidence: 0.92 };
    }

    return null;
  }

  classifyEventType(line) {
    const l = line.toLowerCase();
    if (l.includes('ack') || l.includes('receipt') || l.includes('token') || l.includes('filed')) {
      return 'APPLICATION_SUBMISSION';
    }
    if (l.includes('rti') || l.includes('appeal') || l.includes('hearing')) {
      return 'RTI_OR_LEGAL_HEARING';
    }
    if (l.includes('reject') || l.includes('objection') || l.includes('deficit')) {
      return 'AUTHORITY_OBJECTION';
    }
    if (l.includes('approve') || l.includes('sanction') || l.includes('issued')) {
      return 'APPROVAL_OR_DISPATCH';
    }
    return 'CORRESPONDENCE_EVENT';
  }

  /**
   * Generates a formal citizen case summary suitable for ombudsman or court filings
   */
  exportFormalCaseDossier(timelineResult) {
    const lines = [
      '# CITIZEN CIVIC CASE TIMELINE DOSSIER',
      `Generated: ${new Date().toISOString()}`,
      `Recorded Events: ${timelineResult.totalEventsFound}`,
      `Period: ${timelineResult.dateRange?.earliest || 'N/A'} to ${timelineResult.dateRange?.latest || 'N/A'}`,
      '',
      '## CHRONOLOGICAL EVENT LOG'
    ];

    timelineResult.chronologicalTimeline.forEach((item, index) => {
      if (item.isGapNotice) {
        lines.push(`\n[!] GAPS IN RECORD: ${item.description}\n`);
      } else {
        lines.push(
          `${index + 1}. [${item.normalizedDate}] [${item.eventType}] ${item.description} (Source: ${item.sourceTitle})`
        );
      }
    });

    return lines.join('\n');
  }
}

export const defaultTimelineBuilderService = new CivicCaseTimelineBuilderService();

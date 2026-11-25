/**
 * @file civicFormEvidenceBindingService.js
 * @description Assists citizens in completing complex civic forms by binding each field proposal
 * strictly to verifiable evidence excerpts extracted from uploaded citizen identity and address records.
 * Explicitly prevents auto-submission and mandates human review of field-level confidence.
 */

export class CivicFormEvidenceBindingService {
  constructor(options = {}) {
    this.minimumConfidence = options.minimumConfidence || 0.6;
  }

  /**
   * Matches fields in a civic form schema against uploaded verified document records.
   */
  bindFormFieldsToEvidence(formSchema, citizenRecords = []) {
    if (!formSchema || !Array.isArray(formSchema.fields)) {
      throw new Error('Valid form schema with fields array is required');
    }

    const boundFields = formSchema.fields.map(field => {
      const match = this.findBestEvidenceMatch(field, citizenRecords);

      if (match && match.confidence >= this.minimumConfidence) {
        return {
          fieldId: field.id,
          label: field.label,
          fieldType: field.type || 'text',
          proposedValue: match.extractedValue,
          confidence: match.confidence,
          isUserVerified: false,
          evidenceBinding: {
            documentId: match.documentId,
            documentTitle: match.documentTitle,
            excerpt: match.excerpt,
            matchedRule: match.ruleName
          },
          status: 'PROPOSED_PENDING_CONFIRMATION'
        };
      }

      return {
        fieldId: field.id,
        label: field.label,
        fieldType: field.type || 'text',
        proposedValue: '',
        confidence: 0,
        isUserVerified: false,
        evidenceBinding: null,
        status: 'UNRESOLVED_MANUAL_INPUT_REQUIRED'
      };
    });

    const populatedCount = boundFields.filter(f => f.status === 'PROPOSED_PENDING_CONFIRMATION').length;

    return {
      formId: formSchema.id,
      formTitle: formSchema.title,
      totalFields: formSchema.fields.length,
      autoBoundCount: populatedCount,
      unresolvedCount: formSchema.fields.length - populatedCount,
      canAutoSubmit: false, // Strict safety guarantee
      disclaimer: 'All proposed field values require citizen confirmation prior to manual export or official submission.',
      fields: boundFields
    };
  }

  findBestEvidenceMatch(field, records) {
    const fieldKey = field.id.toLowerCase();
    const fieldLabel = (field.label || '').toLowerCase();

    for (const record of records) {
      const content = record.content || '';

      // Rule: Full Name extraction
      if (fieldKey.includes('name') && !fieldKey.includes('father') && !fieldKey.includes('mother')) {
        const nameMatch = content.match(/(?:Name|Full Name|Applicant Name)[:\s]+([A-Za-z\s]+)(?:\n|$)/i);
        if (nameMatch) {
          return {
            extractedValue: nameMatch[1].trim(),
            confidence: 0.95,
            documentId: record.id,
            documentTitle: record.title,
            excerpt: nameMatch[0].trim(),
            ruleName: 'REGEX_APPLICANT_NAME'
          };
        }
      }

      // Rule: Date of Birth extraction
      if (fieldKey.includes('dob') || fieldLabel.includes('birth')) {
        const dobMatch = content.match(/(?:DOB|Date of Birth|Birth Date)[:\s]+(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})/i);
        if (dobMatch) {
          return {
            extractedValue: dobMatch[1].trim(),
            confidence: 0.96,
            documentId: record.id,
            documentTitle: record.title,
            excerpt: dobMatch[0].trim(),
            ruleName: 'REGEX_DOB'
          };
        }
      }

      // Rule: Residential Address extraction
      if (fieldKey.includes('address') || fieldLabel.includes('address')) {
        const addrMatch = content.match(/(?:Address|Permanent Address|Residential Address)[:\s]+([^\n]+)/i);
        if (addrMatch) {
          return {
            extractedValue: addrMatch[1].trim(),
            confidence: 0.88,
            documentId: record.id,
            documentTitle: record.title,
            excerpt: addrMatch[0].trim(),
            ruleName: 'REGEX_ADDRESS'
          };
        }
      }

      // Rule: PIN code extraction
      if (fieldKey.includes('pincode') || fieldKey.includes('pin') || fieldLabel.includes('pin')) {
        const pinMatch = content.match(/\b([1-9][0-9]{5})\b/);
        if (pinMatch) {
          return {
            extractedValue: pinMatch[1].trim(),
            confidence: 0.99,
            documentId: record.id,
            documentTitle: record.title,
            excerpt: pinMatch[0].trim(),
            ruleName: 'REGEX_PINCODE'
          };
        }
      }
    }

    return null;
  }

  /**
   * Citizen user confirms or modifies a proposed field value.
   */
  confirmFieldValue(boundForm, fieldId, userAcceptedValue) {
    const field = boundForm.fields.find(f => f.fieldId === fieldId);
    if (!field) {
      throw new Error(`Field ${fieldId} not found in form`);
    }

    field.proposedValue = userAcceptedValue;
    field.isUserVerified = true;
    field.status = 'CITIZEN_CONFIRMED';

    return boundForm;
  }
}

export const defaultFormEvidenceAgent = new CivicFormEvidenceBindingService();

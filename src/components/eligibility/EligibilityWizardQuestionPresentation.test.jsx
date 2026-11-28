import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EligibilityWizardQuestionPresentation from './EligibilityWizardQuestionPresentation';

describe('EligibilityWizardQuestionPresentation Component (#578)', () => {
  it('renders step indicators, question text, and options cleanly', () => {
    const html = renderToStaticMarkup(
      <EligibilityWizardQuestionPresentation
        currentStepIndex={1}
        totalSteps={5}
        stepTitle="Income &amp; Economic Criteria"
        selectedValue="delhi"
      />
    );

    expect(html).toContain('Step 2 of 5');
    expect(html).toContain('40% Completed');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('What is your current state of permanent residence / domicile?');
    expect(html).toContain('NCT of Delhi');
    expect(html).toContain('Uttar Pradesh');
    expect(html).toContain('checked=""');
  });

  it('displays validation errors when present', () => {
    const html = renderToStaticMarkup(
      <EligibilityWizardQuestionPresentation
        validationError="Please select a valid domicile state to proceed."
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Please select a valid domicile state to proceed.');
  });
});

import { Sparkles } from 'lucide-react';
import FocusModeToggle from '../common/FocusModeToggle';
import CopyServiceInstructions from './CopyServiceInstructions';
import OfficialSourcesList from './OfficialSourcesList';
import ContactDirectory from './ContactDirectory';
import BottleneckFeedbackPrompt from '../feedback/BottleneckFeedbackPrompt';
import NextStepGuide from './NextStepGuide';
import { findJargonTerms } from '../../data/civicGlossary';
import FormFieldExplainer from '../glossary/FormFieldExplainer';
import TermExplainer from '../TermExplainer';
import RequirementNote from '../RequirementNote';
import { getDocumentRequirements } from '../../services/requirementTypes';

const hasItems = (list) => Array.isArray(list) && list.length > 0;

// Full application guide for a service. The same content renders in both
// layouts; focus mode only swaps the presentation class.
const ServiceGuide = ({ service, focusMode = false, onToggleFocusMode, onMakeChecklist }) => {
  const { eligibility, documents, steps, fees, processingTime, warnings, dateGuidance, validityNote } = service;
  const requirements = getDocumentRequirements(service);

  return (
    <section
      className={`service-guide${focusMode ? ' service-guide--focus' : ''}`}
      aria-labelledby="service-guide-heading"
    >
      <div className="service-guide__header">
        <h2 id="service-guide-heading">How to apply</h2>
        <FocusModeToggle enabled={focusMode} onToggle={onToggleFocusMode} />
      </div>

      <CopyServiceInstructions service={service} />

      {hasItems(warnings) && (
        <div className="service-guide__warnings" role="note" aria-label="Important notes">
          <h3>Before you apply</h3>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {hasItems(eligibility) && (
        <div className="service-guide__block">
          <h3>Who can apply</h3>
          <ul>
            {eligibility.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {hasItems(documents) && (
        <div className="service-guide__block">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <h3 style={{ margin: 0 }}>Documents you need</h3>
            {onMakeChecklist && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onMakeChecklist(service)}
                style={{
                  fontSize: '0.82rem',
                  padding: '0.35rem 0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Sparkles size={14} color="var(--accent-main)" />
                Make checklist
              </button>
            )}
          </div>
          <p className="req-intro">
            Each item is labelled as an official requirement, a conditional
            requirement, an optional suggestion, or not verified.
          </p>
          <ul>
            {documents.map((item, i) => {
              const terms = findJargonTerms(item);
              const topTerm = terms[0];
              return (
                <li key={i}>
                  <span>{item}</span>
                  <RequirementNote requirement={requirements[i]} />
                  {topTerm && (
                    <>
                      <FormFieldExplainer
                        term={topTerm.term}
                        label="What is this?"
                        variant="inline"
                      />
                      <TermExplainer
                        term={topTerm.term}
                        label="Explain this term"
                        variant="inline"
                        serviceContext={{
                          serviceName: service.name,
                          serviceDescription: service.description || service.shortDescription || '',
                          section: 'Documents you need',
                        }}
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasItems(steps) && (
        <div className="service-guide__block">
          <h3>Steps</h3>
          <ol className="service-guide__steps">
            {steps.map((step, i) => (
              <li key={i}>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(fees || processingTime) && (
        <div className="service-guide__block">
          <h3>Fees and time</h3>
          <dl className="service-guide__facts">
            {fees && (
              <div>
                <dt>Official fees</dt>
                <dd>{fees}</dd>
              </div>
            )}
            {processingTime && (
              <div>
                <dt>Processing time</dt>
                <dd>{processingTime}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {hasItems(dateGuidance) && (
        <div className="service-guide__block">
          <h3>Important dates to keep track of</h3>
          <dl className="service-guide__facts">
            {dateGuidance.map((item, i) => (
              <div key={item.label || i}>
                <dt>{item.label}</dt>
                <dd>{item.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {validityNote && (
        <div className="service-guide__block" role="note" aria-label="Certificate validity">
          <h3>Validity and use</h3>
          <p>{validityNote}</p>
        </div>
      )}

      <OfficialSourcesList service={service} />

      <ContactDirectory service={service} />

      <NextStepGuide service={service} />

      <BottleneckFeedbackPrompt serviceId={service.id} serviceName={service.name} />
    </section>
  );
};

export default ServiceGuide;

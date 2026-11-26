import { useMemo, useState } from 'react';
import { AlertTriangle, FilePlus2 } from 'lucide-react';
import {
  MICRO_VOLUNTEER_LIMITS,
  SAFETY_ACKNOWLEDGEMENT_KEYS,
  SAFETY_ACKNOWLEDGEMENT_LABELS,
  TASK_CATEGORY_DEFINITIONS,
} from '../../data/microVolunteerContract.js';
import { MicroVolunteerLoadingButton } from './MicroVolunteerStates.jsx';

const todayPlus = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const emptyForm = (category = TASK_CATEGORY_DEFINITIONS[0]) => ({
  categoryId: category.id,
  title: '',
  instructions: '',
  jurisdictionId: 'WARD-042',
  locality: '',
  timeEstimateMinutes: category.estimatedMinutesRange[1],
  dueDate: todayPlus(14),
  capacity: 1,
  evidenceRequirements: category.defaultEvidenceRequirements.join('\n'),
  safetyNote: category.safetyNote,
  source: 'Municipal volunteer desk',
  publish: true,
  safetyAcknowledgements: Object.fromEntries(SAFETY_ACKNOWLEDGEMENT_KEYS.map((key) => [key, false])),
});

export default function MicroVolunteerTaskForm({ onCreate, busy, error }) {
  const [form, setForm] = useState(() => emptyForm());
  const category = useMemo(
    () => TASK_CATEGORY_DEFINITIONS.find((item) => item.id === form.categoryId) || TASK_CATEGORY_DEFINITIONS[0],
    [form.categoryId]
  );

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const chooseCategory = (id) => {
    const nextCategory = TASK_CATEGORY_DEFINITIONS.find((item) => item.id === id);
    setForm((current) => ({
      ...current,
      categoryId: id,
      timeEstimateMinutes: nextCategory.estimatedMinutesRange[1],
      evidenceRequirements: nextCategory.defaultEvidenceRequirements.join('\n'),
      safetyNote: nextCategory.safetyNote,
    }));
  };

  const toggleAcknowledgement = (key) => {
    setForm((current) => ({
      ...current,
      safetyAcknowledgements: {
        ...current.safetyAcknowledgements,
        [key]: !current.safetyAcknowledgements[key],
      },
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    onCreate({
      ...form,
      evidenceRequirements: form.evidenceRequirements
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    });
  };

  return (
    <form className="mv-card" onSubmit={submit} aria-labelledby="mv-create-task-heading">
      <h2 id="mv-create-task-heading">Publish a low-risk micro-task</h2>
      <p className="mv-muted">
        Tasks must be doable from a safe public place and must never ask for identity documents,
        contact details, enforcement or unsafe physical work.
      </p>

      <div className="mv-filters">
        <div className="mv-field">
          <label htmlFor="mv-task-category">Category</label>
          <select
            id="mv-task-category"
            className="mv-select"
            value={form.categoryId}
            onChange={(event) => chooseCategory(event.target.value)}
          >
            {TASK_CATEGORY_DEFINITIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mv-field">
          <label htmlFor="mv-task-jurisdiction">Ward or jurisdiction code</label>
          <input
            id="mv-task-jurisdiction"
            className="mv-input"
            value={form.jurisdictionId}
            onChange={(event) => update('jurisdictionId', event.target.value.toUpperCase())}
            placeholder="WARD-042"
            required
          />
        </div>
        <div className="mv-field">
          <label htmlFor="mv-task-locality">Public locality (no exact address)</label>
          <input
            id="mv-task-locality"
            className="mv-input"
            value={form.locality}
            onChange={(event) => update('locality', event.target.value)}
            maxLength={MICRO_VOLUNTEER_LIMITS.MAX_LOCALITY_LENGTH}
            required
          />
        </div>
      </div>

      <div className="mv-field">
        <label htmlFor="mv-task-title">Task title</label>
        <input
          id="mv-task-title"
          className="mv-input"
          value={form.title}
          onChange={(event) => update('title', event.target.value)}
          minLength={MICRO_VOLUNTEER_LIMITS.MIN_TITLE_LENGTH}
          maxLength={MICRO_VOLUNTEER_LIMITS.MAX_TITLE_LENGTH}
          required
        />
      </div>

      <div className="mv-field">
        <label htmlFor="mv-task-instructions">Instructions</label>
        <textarea
          id="mv-task-instructions"
          className="mv-textarea"
          value={form.instructions}
          onChange={(event) => update('instructions', event.target.value)}
          minLength={MICRO_VOLUNTEER_LIMITS.MIN_INSTRUCTIONS_LENGTH}
          maxLength={MICRO_VOLUNTEER_LIMITS.MAX_INSTRUCTIONS_LENGTH}
          required
        />
        <span className="mv-help">{category.defaultInstructions}</span>
      </div>

      <div className="mv-filters">
        <div className="mv-field">
          <label htmlFor="mv-task-minutes">Estimated minutes</label>
          <input
            id="mv-task-minutes"
            className="mv-input"
            type="number"
            min="5"
            max="240"
            step="5"
            value={form.timeEstimateMinutes}
            onChange={(event) => update('timeEstimateMinutes', Number(event.target.value))}
            required
          />
        </div>
        <div className="mv-field">
          <label htmlFor="mv-task-due">Due date</label>
          <input
            id="mv-task-due"
            className="mv-input"
            type="date"
            value={form.dueDate}
            onChange={(event) => update('dueDate', event.target.value)}
            required
          />
        </div>
        <div className="mv-field">
          <label htmlFor="mv-task-capacity">Places</label>
          <input
            id="mv-task-capacity"
            className="mv-input"
            type="number"
            min="1"
            max={MICRO_VOLUNTEER_LIMITS.MAX_TASK_CLAIMS_PER_TASK}
            value={form.capacity}
            onChange={(event) => update('capacity', Number(event.target.value))}
            required
          />
        </div>
      </div>

      <div className="mv-field">
        <label htmlFor="mv-task-evidence">Evidence requirements (one per line)</label>
        <textarea
          id="mv-task-evidence"
          className="mv-textarea"
          value={form.evidenceRequirements}
          onChange={(event) => update('evidenceRequirements', event.target.value)}
          required
        />
      </div>

      <div className="mv-field">
        <label htmlFor="mv-task-safety">Safety note</label>
        <textarea
          id="mv-task-safety"
          className="mv-textarea"
          value={form.safetyNote}
          onChange={(event) => update('safetyNote', event.target.value)}
          maxLength={500}
        />
      </div>

      <div className="mv-field">
        <label htmlFor="mv-task-source">Public source</label>
        <input
          id="mv-task-source"
          className="mv-input"
          value={form.source}
          onChange={(event) => update('source', event.target.value)}
          maxLength={160}
        />
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 0.9rem' }}>
        <legend style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Safety acknowledgements</legend>
        {SAFETY_ACKNOWLEDGEMENT_KEYS.map((key) => (
          <label key={key} className="mv-small" style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.4rem' }}>
            <input
              type="checkbox"
              checked={form.safetyAcknowledgements[key]}
              onChange={() => toggleAcknowledgement(key)}
            />
            {SAFETY_ACKNOWLEDGEMENT_LABELS[key]}
          </label>
        ))}
      </fieldset>

      <label className="mv-small" style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.9rem' }}>
        <input
          type="checkbox"
          checked={form.publish}
          onChange={(event) => update('publish', event.target.checked)}
        />
        Publish immediately. Uncheck to save a draft that citizens cannot see.
      </label>

      {error && (
        <p className="mv-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </p>
      )}

      <MicroVolunteerLoadingButton className="mv-button" loading={busy} type="submit">
        <FilePlus2 size={16} aria-hidden="true" /> {form.publish ? 'Publish task' : 'Save draft'}
      </MicroVolunteerLoadingButton>
    </form>
  );
}

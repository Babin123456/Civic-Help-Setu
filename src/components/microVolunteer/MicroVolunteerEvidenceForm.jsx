import { useState } from 'react';
import { AlertTriangle, Paperclip, Send, ShieldCheck, X } from 'lucide-react';
import {
  EVIDENCE_FILE_TYPES,
  MICRO_VOLUNTEER_LIMITS,
} from '../../data/microVolunteerContract.js';
import { MicroVolunteerLoadingButton } from './MicroVolunteerStates.jsx';

const MAX_MB = MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILE_BYTES / (1024 * 1024);

export default function MicroVolunteerEvidenceForm({ claim, onSubmit, busy }) {
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const addFiles = (event) => {
    const incoming = Array.from(event.target.files || []);
    const next = [...files];
    for (const file of incoming) {
      if (next.length >= MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILES) {
        setError(`Attach at most ${MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILES} files.`);
        break;
      }
      if (!EVIDENCE_FILE_TYPES.includes(file.type)) {
        setError(`Use a JPEG, PNG, WebP or PDF file. "${file.name}" was not added.`);
        continue;
      }
      if (file.size > MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILE_BYTES) {
        setError(`"${file.name}" is larger than ${MAX_MB} MB and was not added.`);
        continue;
      }
      next.push({ name: file.name.slice(0, 120), mimeType: file.type, sizeBytes: file.size });
    }
    setFiles(next);
    event.target.value = '';
  };

  const removeFile = (index) => setFiles((current) => current.filter((_, i) => i !== index));

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    if (note.trim().length < MICRO_VOLUNTEER_LIMITS.MIN_EVIDENCE_NOTE_LENGTH) {
      setError(`Describe what you did in at least ${MICRO_VOLUNTEER_LIMITS.MIN_EVIDENCE_NOTE_LENGTH} characters.`);
      return;
    }
    onSubmit({ note, link, files });
  };

  return (
    <form className="mv-card" onSubmit={handleSubmit} aria-labelledby={`mv-evidence-${claim.claimPublicRef}`}>
      <h3 id={`mv-evidence-${claim.claimPublicRef}`}>Submit completion evidence</h3>
      <p className="mv-small mv-muted">
        Claim {claim.claimPublicRef}. A moderator will read this and record an outcome. File contents are
        never stored on the public board; only the file name, type and size are kept as metadata.
      </p>

      <div className="mv-field">
        <label htmlFor={`mv-note-${claim.claimPublicRef}`}>What did you do?</label>
        <textarea
          id={`mv-note-${claim.claimPublicRef}`}
          className="mv-textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_NOTE_LENGTH}
          aria-describedby={`mv-note-help-${claim.claimPublicRef}`}
          required
        />
        <span className="mv-help" id={`mv-note-help-${claim.claimPublicRef}`}>
          Include the place, date and result. Do not include phone numbers, Aadhaar, PAN or exact home
          addresses. {note.length}/{MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_NOTE_LENGTH} characters.
        </span>
      </div>

      <div className="mv-field">
        <label htmlFor={`mv-link-${claim.claimPublicRef}`}>Public link (optional)</label>
        <input
          id={`mv-link-${claim.claimPublicRef}`}
          className="mv-input"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={link}
          onChange={(event) => setLink(event.target.value)}
        />
        <span className="mv-help">Only a public https:// address. Never enter a password or OTP.</span>
      </div>

      <div className="mv-field">
        <label htmlFor={`mv-files-${claim.claimPublicRef}`}>Photo or PDF metadata (optional)</label>
        <input
          id={`mv-files-${claim.claimPublicRef}`}
          className="mv-input"
          type="file"
          accept={EVIDENCE_FILE_TYPES.join(',')}
          multiple
          onChange={addFiles}
          aria-describedby={`mv-files-help-${claim.claimPublicRef}`}
        />
        <span className="mv-help" id={`mv-files-help-${claim.claimPublicRef}`}>
          JPEG, PNG, WebP or PDF, up to {MAX_MB} MB each and {MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILES} files.
          Take photos only from a safe public place and do not photograph people or private homes.
        </span>
      </div>

      {files.length > 0 && (
        <ul aria-label="Selected file metadata">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="mv-inline-actions">
              <Paperclip size={14} aria-hidden="true" /> {file.name} ({Math.ceil(file.sizeBytes / 1024)} KB)
              <button
                type="button"
                className="mv-button mv-button-ghost"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mv-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </p>
      )}

      <div className="mv-inline-actions">
        <MicroVolunteerLoadingButton className="mv-button" loading={busy} type="submit">
          <Send size={16} aria-hidden="true" /> Submit for moderation
        </MicroVolunteerLoadingButton>
        <span className="mv-small mv-muted">
          <ShieldCheck size={14} aria-hidden="true" /> A human moderator decides the outcome.
        </span>
      </div>
    </form>
  );
}

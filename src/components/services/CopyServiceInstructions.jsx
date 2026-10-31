import { useEffect, useId, useRef, useState } from 'react';
import { formatServiceInstructions } from '../../services/plainTextServiceFormatter';
import { copyServiceLink } from '../../services/copyLinkService';
import './CopyServiceInstructions.css';

function CopyInstructionsAction({ text }) {
  const [status, setStatus] = useState('idle');
  const pending = useRef(false);
  const mounted = useRef(false);
  const fallback = useRef(null);
  const fieldId = useId();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (status === 'fallback') {
      fallback.current?.focus();
      fallback.current?.select();
    }
  }, [status]);

  const handleCopy = async () => {
    if (pending.current) return;
    pending.current = true;
    setStatus('copying');
    const copied = await copyServiceLink(text);
    if (mounted.current) {
      pending.current = false;
      setStatus(copied ? 'copied' : 'fallback');
    }
  };

  return (
    <div className="service-instructions-copy">
      <button type="button" className="btn btn-outline" onClick={handleCopy} disabled={status === 'copying'}>
        {status === 'copying' ? 'Copying…' : 'Copy instructions'}
      </button>
      <p role="status" aria-live="polite" className="service-instructions-copy__status">
        {status === 'copied' && 'Instructions copied.'}
        {status === 'fallback' && 'Automatic copy is unavailable. Select and copy the instructions below.'}
      </p>
      {status === 'fallback' && (
        <div>
          <label htmlFor={fieldId}>Plain-text service instructions</label>
          <textarea id={fieldId} ref={fallback} readOnly value={text} rows={8} />
        </div>
      )}
    </div>
  );
}

export default function CopyServiceInstructions({ service }) {
  const text = formatServiceInstructions(service);
  // Reset feedback and ignore an old clipboard result when the service changes.
  return <CopyInstructionsAction key={text} text={text} />;
}

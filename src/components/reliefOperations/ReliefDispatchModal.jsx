import { useState } from 'react';
import { Truck, X } from 'lucide-react';
import { RELIEF_ERROR_GUIDANCE } from '../../services/reliefOperationsConstants';

export default function ReliefDispatchModal({ allocation, onClose, onConfirm }) {
  const [teamName, setTeamName] = useState('');
  const [vehicleRef, setVehicleRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(null);
    if (teamName.trim().length < 3) {
      setError('Enter the delivery team name (at least 3 characters). Do not enter personal phone numbers.');
      return;
    }
    try {
      onConfirm(allocation.id, {
        teamName: teamName.trim(),
        vehicleRef: vehicleRef.trim() || null,
        notes: notes.trim() || null,
        siteId: allocation.siteId || null,
      });
    } catch (dispatchError) {
      setError(
        RELIEF_ERROR_GUIDANCE[dispatchError?.code] ||
          dispatchError?.message ||
          'The allocation could not be dispatched.'
      );
    }
  };

  return (
    <div className="relief-modal-backdrop">
      <div
        className="relief-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="relief-dispatch-heading"
      >
        <div className="relief-modal-header">
          <div>
            <h2 id="relief-dispatch-heading">Dispatch reserved stock</h2>
            <p className="relief-muted">
              {allocation.resourceSummary?.name || 'Stock'} · {allocation.quantity}{' '}
              {allocation.resourceSummary?.unit || 'units'} →{' '}
              {allocation.siteSummary?.name || 'selected distribution site'}
            </p>
          </div>
          <button
            type="button"
            className="relief-icon-button"
            onClick={onClose}
            aria-label="Close dispatch dialog"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form className="relief-form" onSubmit={handleSubmit} noValidate>
          <div className="relief-form-grid">
            <div className="relief-field">
              <label htmlFor="dispatch-team">Delivery team</label>
              <input
                id="dispatch-team"
                type="text"
                maxLength={80}
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                aria-describedby="dispatch-team-help"
                required
              />
              <p className="relief-help" id="dispatch-team-help">
                Use a team or role label, not an individual&apos;s contact details.
              </p>
            </div>

            <div className="relief-field">
              <label htmlFor="dispatch-vehicle">Vehicle reference (optional)</label>
              <input
                id="dispatch-vehicle"
                type="text"
                maxLength={40}
                value={vehicleRef}
                onChange={(event) => setVehicleRef(event.target.value)}
              />
            </div>
          </div>

          <div className="relief-field">
            <label htmlFor="dispatch-notes">Dispatch note (optional)</label>
            <textarea
              id="dispatch-notes"
              rows={2}
              maxLength={300}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <p className="relief-help">
            Dispatch moves the allocation from reserved to in transit. The reservation stays linked to the
            stock ledger until the delivery is confirmed or cancelled.
          </p>

          {error && (
            <p className="relief-error-inline" role="alert">
              {error}
            </p>
          )}

          <div className="relief-form-actions">
            <button type="submit" className="relief-button relief-button--primary">
              <Truck size={16} aria-hidden="true" /> Dispatch allocation
            </button>
            <button type="button" className="relief-button relief-button--ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

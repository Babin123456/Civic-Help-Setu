import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { RELIEF_ERROR_GUIDANCE } from '../../services/reliefOperationsConstants';

export default function ReliefDeliveryModal({ allocation, onClose, onConfirm }) {
  const [deliveredQuantity, setDeliveredQuantity] = useState(
    String(allocation.quantity || allocation.deliverySummary?.quantity || 1)
  );
  const [receivedByRole, setReceivedByRole] = useState('Distribution site coordinator');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(null);
    const quantity = Number(deliveredQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Enter a whole-number delivered quantity of at least 1.');
      return;
    }
    if (quantity > allocation.quantity) {
      setError(`Delivered quantity cannot exceed the reserved quantity of ${allocation.quantity}.`);
      return;
    }
    if (!receivedByRole.trim()) {
      setError('Record the receiving role, not a personal name.');
      return;
    }
    try {
      onConfirm(quantity, {
        deliveredQuantity: quantity,
        receivedByRole,
        note,
      });
    } catch (confirmError) {
      setError(RELIEF_ERROR_GUIDANCE[confirmError?.code] || confirmError?.message || 'The delivery could not be confirmed.');
    }
  };

  return (
    <div className="relief-modal-backdrop">
      <div className="relief-modal" role="dialog" aria-modal="true" aria-labelledby="relief-delivery-heading">
        <div className="relief-modal-header">
          <div>
            <h2 id="relief-delivery-heading">Confirm distribution</h2>
            <p className="relief-muted">
              {allocation.resourceSummary?.name} → {allocation.siteSummary?.name || 'selected site'} ·{' '}
              reservation {allocation.quantity} {allocation.resourceSummary?.unit || 'units'}
            </p>
          </div>
          <button type="button" className="relief-icon-button" onClick={onClose} aria-label="Close delivery dialog">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form className="relief-form" onSubmit={handleSubmit} noValidate>
          <div className="relief-form-grid">
            <div className="relief-field">
              <label htmlFor="delivery-quantity">Delivered quantity</label>
              <input
                id="delivery-quantity"
                type="number"
                min="1"
                max={allocation.quantity}
                step="1"
                value={deliveredQuantity}
                onChange={(event) => setDeliveredQuantity(event.target.value)}
                aria-describedby="delivery-quantity-help"
              />
              <p className="relief-help" id="delivery-quantity-help">
                A partial delivery releases the unused reservation automatically. The stock movement is
                recorded in the audit trail.
              </p>
            </div>

            <div className="relief-field">
              <label htmlFor="delivery-receiver">Received by (role only)</label>
              <input
                id="delivery-receiver"
                type="text"
                maxLength={80}
                value={receivedByRole}
                onChange={(event) => setReceivedByRole(event.target.value)}
                aria-describedby="delivery-receiver-help"
              />
              <p className="relief-help" id="delivery-receiver-help">
                Do not enter a person&apos;s name or phone number. Example: “Shelter coordinator”.
              </p>
            </div>
          </div>

          <div className="relief-field">
            <label htmlFor="delivery-note">Confirmation note (optional)</label>
            <textarea
              id="delivery-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {error && (
            <p className="relief-error-inline" role="alert">
              {error}
            </p>
          )}

          <div className="relief-form-actions">
            <button type="submit" className="relief-button relief-button--primary">
              <CheckCircle2 size={16} aria-hidden="true" /> Record confirmed distribution
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

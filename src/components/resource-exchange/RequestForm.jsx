/**
 * RequestForm.jsx
 * Form for requesting an item from a resource listing.
 * Accessible: semantic labels, keyboard operation, screen-reader announcements.
 */

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/toastContext';
import { Icon } from 'lucide-react';

const RequestForm = ({ listing, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    handoverLocation: '',
    handoverWindow: '',
    statusMessage: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) =>
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.handoverLocation || !form.handoverWindow || !form.statusMessage) {
      useToast()(('error', t('fields_required')));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      useToast()(('success', t('request_submitted')));
      onClose();
    } catch (err) {
      useToast()(('error', t('submission_failed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', background: 'var(--bg-surface)', borderRadius: '0.5rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>{t('request_item', { title: listing.title })}</h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <label>{t('handover_location')} <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
          <input
            type="text"
            name="handoverLocation"
            value={form.handoverLocation}
            onChange={handleChange}
            placeholder={t('handover_location_placeholder')}
            style={{
              width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)',
            }}
            required
            aria-describedby="handover-help"
          />
          <p id="handover-help" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {t('handover_location_help')}
          </p>
        </div>

        <div>
          <label>{t('handover_window')} <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
          <select
            name="handoverWindow"
            value={form.handoverWindow}
            onChange={handleChange}
            style={{
              width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)',
            }}
            required
          >
            <option value="">{t('select_window')}</option>
            {AVAILABILITY_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {t(w)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t('status_message')} <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
          <textarea
            name="statusMessage"
            value={form.statusMessage}
            onChange={handleChange}
            placeholder={t('status_message_placeholder')}
            rows={3}
            style={{
              width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)', resize: 'vertical',
            }}
            required
          /></textarea>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '0.6rem 1rem',
            fontSize: '0.85rem',
            fontWeight: '600',
            background: 'var(--primary)',
            color: 'var(--bg-primary)',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? t('submitting') : t('send_request')}
        </button>
      </form>

      <button
        onClick={onClose}
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.85rem',
          background: 'transparent',
          border: '1px solid var(--border-main)',
          color: 'var(--text-primary)',
          borderRadius: '0.375rem',
          cursor: 'pointer',
        }}
      >
        {t('cancel')}
      </button>
    </div>
  );
};

export default RequestForm;
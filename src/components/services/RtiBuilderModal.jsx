import { useState } from 'react';
import { X, Scale, FileText, Check, Plus, Trash2, HelpCircle, Sparkles } from 'lucide-react';
import RtiDraftReviewerModal from './RtiDraftReviewerModal';
import { useModalKeyboard } from '../../hooks/useModalKeyboard';
import { RTI_DEPARTMENT_DIRECTORY } from '../../data/rtiDepartmentDirectory';
import { buildRtiApplication } from '../../services/rtiDraftingEngine';
import RtiPreviewLetter from './RtiPreviewLetter';

export default function RtiBuilderModal({ isOpen, onClose }) {
  const modalRef = useModalKeyboard(isOpen, onClose);

  const [departmentId, setDepartmentId] = useState(RTI_DEPARTMENT_DIRECTORY[0].id);
  const selectedDept = RTI_DEPARTMENT_DIRECTORY.find(d => d.id === departmentId) || RTI_DEPARTMENT_DIRECTORY[0];

  const [applicantName, setApplicantName] = useState('Citizen Applicant');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isBpl, setIsBpl] = useState(false);
  const [bplCardNumber, setBplCardNumber] = useState('');
  const [questions, setQuestions] = useState([selectedDept.commonQueries[0] || '']);
  const [isReviewerOpen, setIsReviewerOpen] = useState(false);

  if (!isOpen) return null;

  const handleAddQuestion = () => {
    setQuestions([...questions, '']);
  };

  const handleUpdateQuestion = (idx, text) => {
    const updated = [...questions];
    updated[idx] = text;
    setQuestions(updated);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const rtiResult = buildRtiApplication({
    departmentId,
    applicantName,
    applicantAddress,
    contactNumber,
    questions,
    isBpl,
    bplCardNumber
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rti-builder-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        style={{
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text-color, #1e293b)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
          padding: '24px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale color="#2563eb" size={24} />
            <h2 id="rti-builder-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Citizen RTI (Right to Information) Request Builder
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step 1: Select Target Department */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
            Target Public Authority / Department
          </label>
          <select
            value={departmentId}
            onChange={(e) => {
              const dId = e.target.value;
              setDepartmentId(dId);
              const dept = RTI_DEPARTMENT_DIRECTORY.find(d => d.id === dId);
              if (dept && dept.commonQueries) {
                setQuestions([dept.commonQueries[0]]);
              }
            }}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
          >
            {RTI_DEPARTMENT_DIRECTORY.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Designated PIO: <strong>{selectedDept.pioDesignation}</strong> | Standard Fee: <strong>{selectedDept.feeMode}</strong>
          </div>
        </div>

        {/* Applicant Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Full Name
            </label>
            <input
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Postal Address for Reply
            </label>
            <input
              type="text"
              placeholder="House, Street, City, PIN"
              value={applicantAddress}
              onChange={(e) => setApplicantAddress(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Phone Number
            </label>
            <input
              type="text"
              placeholder="e.g. 9876543210"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* BPL Exemption Checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <input
            type="checkbox"
            id="bpl-check"
            checked={isBpl}
            onChange={(e) => setIsBpl(e.target.checked)}
          />
          <label htmlFor="bpl-check" style={{ fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            Applicant belongs to Below Poverty Line (BPL) - Exempt from ₹10 fee
          </label>
          {isBpl && (
            <input
              type="text"
              placeholder="BPL Card No."
              value={bplCardNumber}
              onChange={(e) => setBplCardNumber(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', marginLeft: '8px' }}
            />
          )}
        </div>

        {/* Point-wise Questions Form */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              Specific Information Required (Point-wise under Section 6(1))
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setIsReviewerOpen(true)}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3b82f6', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
              >
                <Sparkles size={12} />
                <span>AI Clarity Review</span>
              </button>
              <button
                type="button"
                onClick={handleAddQuestion}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Plus size={12} />
                <span>Add Query</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {questions.map((q, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', width: '20px' }}>
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => handleUpdateQuestion(idx, e.target.value)}
                  placeholder="e.g. Certified copy of tender contract sanctioned for Ward 42..."
                  style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(idx)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Generated Preview */}
        <RtiDraftReviewerModal
          isOpen={isReviewerOpen}
          onClose={() => setIsReviewerOpen(false)}
          initialQuestions={questions}
          defaultAuthority={selectedDept.nodalAuthority}
          onAdoptRewording={(suggested) => {
            setQuestions([suggested]);
            setIsReviewerOpen(false);
          }}
        />

        <RtiPreviewLetter rtiResult={rtiResult} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: '8px', background: '#64748b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

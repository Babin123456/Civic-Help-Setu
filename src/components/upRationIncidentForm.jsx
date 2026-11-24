// UP Ration Incident Form
// Guided form for recording a failed fair-price shop transaction
// District-aware, offline-capable, no PII collection

import React, { useState, useEffect, useRef } from 'react';
import { 
  INCIDENT_FORM_FIELDS, 
  INCIDENT_REASON_CODES, 
  createDefaultIncident, 
  validateIncidentNoPII 
} from '../data/upRationIncident';
import { saveIncident, deleteIncident, getIncidentById, isDuplicateIncident, getIncidentsByDistrict } from '../services/upRationIncidentStorage';
import { UP_DISTRICTS } from '../data/upGrievanceChannels';
import { getGrievanceChannelForDistrict, exportIncidentAsReceipt } from '../data/upRationIncident';
import { getStoredIncidents, getStaleSourceWarning } from '../services/upRationIncidentStorage';
import { generateGrievanceDraft } from '../services/civicGrievanceDraftingService';

const DEFAULT_RATION_MONTH = new Date().toISOString().slice(0, 7).split('T')[0];

// Populate district options from UP districts
const districtOptions = UP_DISTRICTS.map((dist) => ({
  value: dist,
  label: dist,
}));

const INCIDENT_FORM = {
  fields: INCIDENT_FORM_FIELDS.map((field) => ({
    ...field,
    options: field.options || districtOptions.filter((o) => field.name === 'district' ? true : []),
    // Set district options for the first field
    ...(field.name === 'district' && { options: districtOptions }),
  }))
};

const UpRationIncidentForm = ({ initialIncidentId }) => {
  const [incident, setIncident] = useState(() => {
    // Try to load existing incident if ID provided
    if (initialIncidentId) {
      const existing = getIncidentById(initialIncidentId);
      if (existing) return existing;
    }
    return createDefaultIncident();
  });
  const [formErrors, setFormErrors] = useState({});
  const [showReceipt, setShowReceipt] = useState(false);
  const [showGrievanceDraft, setShowGrievanceDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [staleWarning, setStaleWarning] = useState(null);

  // Initialize form field values from incident state
  useEffect(() => {
    // Sync form fields with incident state
    // This is handled by onChange handlers
  }, [incident]);

  // Check stale source warning when component mounts
  useEffect(() => {
    const warning = getStaleSourceWarning();
    if (warning.some((c) => c.stale)) {
      setStaleWarning(warning);
    }
  }, []);

  // Form field change handler
  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    const parsedValue = type === 'number' ? Number(value) : value;
    
    setIncident((prev) => ({
      ...prev,
      [name]: parsedValue,
      updatedAt: new Date().toISOString(),
    }));
    
    // Clear errors for this field
    setFormErrors((prev) => {
      const { [name]: erased, ...rest } = prev;
      return rest;
    });
  };

  // Reason select change
  const handleReasonChange = (reason) => {
    setIncident((prev) => ({
      ...prev,
      reason,
      updatedAt: new Date().toISOString(),
    }));
    setFormErrors((prev) => {
      const { reason: erased, ...rest } = prev;
      return rest;
    });
  };

  // Form submission - save incident
  const handleSave = () => {
    // Validate required fields
    const newErrors = {};
    
    // Check district is selected
    if (!incident.district) {
      newErrors.district = 'District is required';
    }
    
    // Check ration month format
    const monthPattern = /^\d{4}-\d{2}$/;
    if (!monthPattern.test(incident.rationMonth)) {
      newErrors.rationMonth = 'Ration month must be in YYYY-MM format';
    }
    
    // Check quantity values
    if (incident.quantityShowed < 0) {
      newErrors.quantityShowed = 'Quantity shown must be 0 or greater';
    }
    if (incident.quantityReceived < 0) {
      newErrors.quantityReceived = 'Quantity received must be 0 or greater';
    }
    
    // Check that received <= showed (optional validation)
    if (incident.quantityReceived > incident.quantityShowed && incident.quantityShowed > 0) {
      newErrors.quantityReceived = 'Quantity received cannot exceed quantity shown';
    }
    
    setFormErrors(newErrors);
    
    // If no errors, save the incident
    if (Object.keys(newErrors).length === 0) {
      // Check for duplicate
      if (isDuplicateIncident(incident)) {
        if (window.confirm('This incident appears to be a duplicate of an existing record. Do you want to proceed anyway?')) {
          saveIncident(incident);
          setShowReceipt(true);
        }
      } else {
        saveIncident(incident);
        setShowReceipt(true);
      }
    }
  };

  // Print receipt
  const handlePrintReceipt = () => {
    const receiptText = exportIncidentAsReceipt(incident);
    // In a real implementation, this would trigger print
    // For now, just show the receipt in a modal or alert
    if (window.print) {
      window.print();
    } else {
      alert(receiptText);
    }
  };

  // Generate grievance draft
  const handleGenerateGrievance = () => {
    // Build facts object for the grievance drafting service
    const facts = {
      category: 'Public Distribution System (Ration / PDS)',
      issueDescription: `Ration transaction denied at fair-price shop in ${incident.district}. Reason: ${INCIDENT_REASON_CODES[incident.reason]}. Quantity shown: ${incident.quantityShowed}kg, received: ${incident.quantityReceived}kg. Ration month: ${incident.rationMonth}.`,
      departmentName: 'Food & Civil Supplies Department, Uttar Pradesh',
      location: `${incident.district} ${incident.blockOrWard || ''} ${incident.shopName || incident.shopId || ''}`.trim(),
      incidentDate: `${incident.rationMonth}-01`, // First day of ration month
      requestedResolution: 'Review the ration transaction and initiate grievance redressal as per UP PDS guidelines',
      evidenceList: [
        `Incident ID: ${incident.id}`,
        `District: ${incident.district}`,
        `Ration month: ${incident.rationMonth}`,
        `Commodity: ${incident.commodity}`,
        `Quantity shown: ${incident.quantityShowed}kg`,
        `Quantity received: ${incident.quantityReceived}kg`,
        `Reason: ${INCIDENT_REASON_CODES[incident.reason]}`,
        ...(incident.additionalDetails ? [`Additional: ${incident.additionalDetails}`] : [])
      ],
    };
    
    const draft = generateGrievanceDraft(facts);
    if (draft.isValid) {
      setShowGrievanceDraft(true);
    } else {
      alert('Cannot generate grievance draft: ' + (draft.error || 'Please fill required fields'));
    }
  };

  // Delete incident
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this incident record? This cannot be undone.')) {
      isDeleting = true;
      setIsDeleting(true);
      deleteIncident(incident.id);
      setIncident(createDefaultIncident());
      setFormErrors({});
      setShowReceipt(false);
      setShowGrievanceDraft(false);
      setIsDeleting(false);
    }
  };

  // Initialize district options once
  useEffect(() => {
    // District options already set from UP_DISTRICTS
  }, []);

  return (
    <div className="up-ration-incident-form">
      {/* Stale source warning banner */}
      {staleWarning && staleWarning.length > 0 && (
        <div className="stale-warning-banner">
          ⚠️ <strong>Source Freshness Warning:</strong> Some grievance channels haven't been verified recently. 
          <a href="https://fcs.up.gov.in" target="_blank" rel="noopener">Check for updated contacts</a>.
        </div>
      )}

      <header className="form-header">
        <h2>Ration Incident Recording Form</h2>
        <p>Document a failed fair-price shop transaction for grievance preparation</p>
      </header>

      <form className="incident-form">
        {/* District selection */}
        <div className="form-row">
          <label htmlFor="district">District <span className="required">*</span></label>
          <select 
            id="district" 
            name="district" 
            className="form-select"
            onChange={(e) => handleFieldChange(e)}
            required
          >
            <option value="">Select district</option>
            {districtOptions.map((opt) => (
              <option key={opt.value} value={opt.value} 
                selected={incident.district === opt.value}
              >
                {opt.label}
              </option>
            ))}
          </select>
          {formErrors.district && (
            <span className="form-error">{formErrors.district}</span>
          )}
        </div>

        {/* Block / Urban Ward */}
        <div className="form-row">
          <label htmlFor="blockOrWard">Block / Urban Ward</label>
          <input 
            type="text" 
            id="blockOrWard" 
            name="blockOrWard" 
            className="form-input"
            placeholder="e.g., Lucknow Central, Shahjahanpur Tehsil"
            value={incident.blockOrWard || ''}
            onChange={(e) => handleFieldChange(e)}
          />
          {formErrors.blockOrWard && (
            <span className="form-error">{formErrors.blockOrWard}</span>
          )}
        </div>

        {/* Shop identifier */}
        <div className="form-row">
          <label htmlFor="shopId">Fair-Price Shop ID</label>
          <input 
            type="text" 
            id="shopId" 
            name="shopId" 
            className="form-input"
            placeholder="Optional shop ID / license number"
            value={incident.shopId || ''}
            onChange={(e) => handleFieldChange(e)}
          />
          <small>Optional. If known, helps with district-specific routing.</small>
        </div>

        {/* Shop name */}
        <div className="form-row">
          <label htmlFor="shopName">Shop Name</label>
          <input 
            type="text" 
            id="shopName" 
            name="shopName" 
            className="form-input"
            placeholder="e.g., Adarsh Vikas Gramin Udyog Sahakari Samiti"
            value={incident.shopName || ''}
            onChange={(e) => handleFieldChange(e)}
          />
        </div>

        {/* Ration month */}
        <div className="form-row">
          <label htmlFor="rationMonth">Ration Month <span className="required">*</span></label>
          <input 
            type="text" 
            id="rationMonth" 
            name="rationMonth" 
            className="form-input"
            placeholder="YYYY-MM (e.g., 2026-11)"
            value={incident.rationMonth || DEFAULT_RATION_MONTH}
            onChange={(e) => handleFieldChange(e)}
            pattern="^\d{4}-\d{2}$"
            inputMode="text"
          />
          {formErrors.rationMonth && (
            <span className="form-error">{formErrors.rationMonth}</span>
          )}
        </div>

        {/* Commodity */}
        <div className="form-row">
          <label htmlFor="commodity">Commodity <span className="required">*</span></label>
          <select 
            id="commodity" 
            name="commodity" 
            className="form-select"
            onChange={(e) => handleFieldChange(e)}
            required
          >
            <option value="">Select commodity</option>
            <option value="Rice">Rice</option>
            <option value="Wheat">Wheat</option>
            <option value="Coarse Grains">Coarse Grains</option>
            <option value="Sugar">Sugar</option>
            <option value="Kerosene">Kerosene</option>
            <option value="Other">Other</option>
          </select>
          {formErrors.commodity && (
            <span className="form-error">{formErrors.commodity}</span>
          )}
        </div>

        {/* Quantities */}
        <div className="form-row doubled-row">
          <div>
            <label>Quantity Shown (kg)</label>
            <input 
              type="number" 
              id="quantityShowed" 
              name="quantityShowed" 
              className="form-input"
              min="0"
              value={incident.quantityShowed || 0}
              onChange={(e) => handleFieldChange(e)}
            />
          </div>
          <div>
            <label>Quantity Received (kg)</label>
            <input 
              type="number" 
              id="quantityReceived" 
              name="quantityReceived" 
              className="form-input"
              min="0"
              value={incident.quantityReceived || 0}
              onChange={(e) => handleFieldChange(e)}
            />
          </div>
        </div>
        {formErrors.quantityShowed && (
          <span className="form-error">{formErrors.quantityShowed}</span>
        )}
        {formErrors.quantityReceived && (
          <span className="form-error">{formErrors.quantityReceived}</span>
        )}

        {/* Reason communicated */}
        <div className="form-row">
          <label htmlFor="reason">Reason Communicated <span className="required">*</span></label>
          <select 
            id="reason" 
            name="reason" 
            className="form-select"
            onChange={(e) => handleReasonChange(e.target.value)}
            required
          >
            <option value="">Select reason</option>
            {Object.keys(INCIDENT_REASON_CODES).map((key) => (
              <option 
                key={key} 
                value={key}
                selected={incident.reason === key}
              >
                {INCIDENT_REASON_CODES[key]}
              </option>
            ))}
          </select>
          {formErrors.reason && (
            <span className="form-error">{formErrors.reason}</span>
          )}
        </div>

        {/* Additional details */}
        <div className="form-row">
          <label htmlFor="additionalDetails">Additional Details</label>
          <textarea 
            id="additionalDetails" 
            name="additionalDetails" 
            className="form-textarea"
            rows={3}
            placeholder="e.g., e-PoS showed 'out of stock', shop closed early, authentication failed twice"
            value={incident.additionalDetails || ''}
            onChange={(e) => handleFieldChange(e)}
          />
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn-primary"
            onClick={(e) => {
              e.preventDefault();
              handleSave();
            }}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Incident'}
          </button>
          
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => setShowReceipt(true)}
          >
            Print Receipt
          </button>
          
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => setShowGrievanceDraft(true)}
          >
            Generate Grievance Draft
          </button>
        </div>
      </form>

      {/* Incident saved/receipt section */}
      {showReceipt && (
        <div className="receipt-section">
          <h3>Incident Receipt</h3>
          <pre>{exportIncidentAsReceipt(incident)}</pre>
          <button className="btn-secondary" onClick={() => setShowReceipt(false)}>Close</button>
        </div>
      )}

      {/* Grievance draft section */}
      {showGrievanceDraft && (
        <div className="grievance-draft-section">
          <h3>Grievance Draft</h3>
          <pre>{/* Would render the actual draft text from the service */}</pre>
          <button className="btn-secondary" onClick={() => setShowGrievanceDraft(false)}>Close</button>
        </div>
      )}

      {/* Delete incident button (always visible at bottom) */}
      {incident.id && (
        <div className="form-delete-action">
          <button 
            className="btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          >
            Delete Incident Record
          </button>
        </div>
      )}
    </div>
  );
};

export default UpRationIncidentForm;
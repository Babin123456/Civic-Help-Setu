import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Shield,
  EyeOff,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  isVoluntaryProfileOptedIn,
  setVoluntaryProfileOptIn,
  getVoluntaryProfileAttributes,
  saveVoluntaryProfileAttributes,
  clearVoluntaryProfileAttributes,
  getVoluntaryProfileRecommendations,
} from '../../services/voluntaryProfileRecommendationService';

const INDIAN_STATES = [
  'All India / Central',
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Delhi',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
];

const AGE_GROUPS = [
  'Minor (0-17 years)',
  'Youth & Young Adult (18-25 years)',
  'Adult (26-59 years)',
  'Senior Citizen (60+ years)',
];

const OCCUPATIONS = [
  'Farmer / Agriculture',
  'Student / Scholar',
  'Unorganised Worker / Labour',
  'Salaried / Private Employee',
  'Self Employed / Business',
  'Homemaker',
  'Senior Citizen / Retired',
  'Other / Unspecified',
];

const SOCIAL_CATEGORIES = [
  'General',
  'BPL (Below Poverty Line)',
  'EWS (Economically Weaker Section)',
  'OBC (Other Backward Classes)',
  'SC / ST',
  'Person with Disability (Divyangjan)',
];

export default function VoluntaryProfileRecommendationPanel({ onUpdate = () => {} }) {
  const [optedIn, setOptedIn] = useState(() => isVoluntaryProfileOptedIn());
  const [attributes, setAttributes] = useState(() => getVoluntaryProfileAttributes());
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    setOptedIn(isVoluntaryProfileOptedIn());
    setAttributes(getVoluntaryProfileAttributes());
  }, []);

  const handleToggleOptIn = (e) => {
    const nextVal = e.target.checked;
    setVoluntaryProfileOptIn(nextVal);
    setOptedIn(nextVal);
    onUpdate();
  };

  const handleChangeAttr = (field, value) => {
    const updated = saveVoluntaryProfileAttributes({ [field]: value });
    setAttributes(updated);
    onUpdate();
  };

  const handleClearAll = () => {
    clearVoluntaryProfileAttributes();
    setVoluntaryProfileOptIn(false);
    setOptedIn(false);
    setAttributes({});
    onUpdate();
  };

  const results = useMemo(() => {
    return getVoluntaryProfileRecommendations(attributes);
  }, [optedIn, attributes]);

  return (
    <div
      className="glass-panel p-6 rounded-2xl border space-y-6"
      style={{
        backgroundColor: 'var(--bg-surface, #ffffff)',
        borderColor: 'var(--border-color, #e2e8f0)',
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              color: 'var(--accent-main, #0284c7)',
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              Voluntary Service Recommendations
              <span
                className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: optedIn ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                  color: optedIn ? '#059669' : '#64748b',
                }}
              >
                {optedIn ? 'Active (Opted-in)' : 'Anonymous Mode'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Explainable scheme matching based strictly on your voluntarily declared preferences.
            </p>
          </div>
        </div>

        {/* Opt-in switch */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-semibold">
          <input
            type="checkbox"
            checked={optedIn}
            onChange={handleToggleOptIn}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
          />
          <span>Enable Profile-Based Suggestions</span>
        </label>
      </div>

      {/* Privacy Notice */}
      <div
        className="p-3 rounded-xl text-xs flex items-start gap-2.5 border"
        style={{
          backgroundColor: 'rgba(14, 165, 233, 0.05)',
          borderColor: 'rgba(14, 165, 233, 0.2)',
          color: '#0369a1',
        }}
      >
        <Shield size={16} className="shrink-0 mt-0.5 text-sky-600" />
        <div>
          <strong>Privacy Safeguard:</strong> Civic Help Setu never transmits your profiling parameters to any third-party or government server. All matching happens 100% locally in your browser. Anonymous browsing remains primary.
        </div>
      </div>

      {/* Attribute Customization Controls */}
      {optedIn && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-xs font-medium flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
            >
              <SlidersHorizontal size={14} />
              {showConfig ? 'Hide Preference Parameters' : 'Edit Voluntary Profile Parameters'}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <RotateCcw size={12} />
              Opt-out & Clear Parameters
            </button>
          </div>

          {showConfig && (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border bg-slate-50/50"
              style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jurisdiction / State
                </label>
                <select
                  value={attributes.state || ''}
                  onChange={(e) => handleChangeAttr('state', e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-white border-slate-300 text-slate-800"
                >
                  <option value="">Select State (Optional)</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Occupation Group
                </label>
                <select
                  value={attributes.occupation || ''}
                  onChange={(e) => handleChangeAttr('occupation', e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-white border-slate-300 text-slate-800"
                >
                  <option value="">Select Occupation (Optional)</option>
                  {OCCUPATIONS.map((occ) => (
                    <option key={occ} value={occ}>
                      {occ}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Age Bracket
                </label>
                <select
                  value={attributes.ageGroup || ''}
                  onChange={(e) => handleChangeAttr('ageGroup', e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-white border-slate-300 text-slate-800"
                >
                  <option value="">Select Age Group (Optional)</option>
                  {AGE_GROUPS.map((ag) => (
                    <option key={ag} value={ag}>
                      {ag}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Social Category
                </label>
                <select
                  value={attributes.category || ''}
                  onChange={(e) => handleChangeAttr('category', e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border bg-white border-slate-300 text-slate-800"
                >
                  <option value="">Select Category (Optional)</option>
                  {SOCIAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold">{results.reason}</span>
          {results.influencingAttributesUsed?.length > 0 && (
            <span className="text-[11px] text-slate-500">
              Matched attributes: {results.influencingAttributesUsed.join(', ')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {results.recommendations.map((rec) => (
            <div
              key={rec.serviceId}
              className="p-4 rounded-xl border flex flex-col justify-between transition-all hover:shadow-md"
              style={{
                backgroundColor: rec.isFallback
                  ? 'var(--bg-card, #f8fafc)'
                  : 'rgba(56, 189, 248, 0.03)',
                borderColor: rec.isFallback
                  ? 'var(--border-color, #e2e8f0)'
                  : 'rgba(56, 189, 248, 0.3)',
              }}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {rec.serviceName}
                  </h4>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: rec.isFallback
                        ? 'rgba(100, 116, 139, 0.1)'
                        : 'rgba(14, 165, 233, 0.15)',
                      color: rec.isFallback ? '#64748b' : '#0284c7',
                    }}
                  >
                    {rec.isFallback ? 'Baseline' : `${rec.matchScore}% Match`}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {rec.matchReason}
                </p>

                {/* Contributing factors badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {rec.influencingAttributes.map((attr, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600"
                    >
                      {attr}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {rec.department || rec.category}
                </span>
                <Link
                  to={`/services/${rec.serviceId}`}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  View Requirements <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

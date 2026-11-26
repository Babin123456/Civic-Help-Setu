/**
 * src/pages/WardAnalyticsDashboard.jsx
 * Public civic dashboard for Differentially Private Ward Analytics (#1163).
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import WardIssueHeatmap from '../components/analytics/WardIssueHeatmap';

export default function WardAnalyticsDashboard() {
  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Navigation Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#0284c7',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Home
          </Link>
        </nav>

        {/* Page Title & Context Header */}
        <header style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              <BarChart3 size={24} aria-hidden="true" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Municipal Ward Civic Analytics
              </h1>
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '1rem' }}>
                Open civic telemetry protected by mathematical Differential Privacy
              </p>
            </div>
          </div>
        </header>

        {/* Core Heatmap Vertical Slice */}
        <main>
          <WardIssueHeatmap />
        </main>
      </div>
    </div>
  );
}

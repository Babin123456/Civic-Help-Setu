import React, { useState } from 'react';
import SearchBox from '../components/SearchBox';
import { 
  BookOpen, 
  Shield, 
  HelpCircle, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  ShieldAlert, 
  Compass, 
  Pause, 
  Play 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import QuickActionPanel from '../components/QuickActionPanel';
import DisasterReliefHubModal from '../components/emergency/DisasterReliefHubModal';
import LifeEventNavigatorModal from '../components/journey/LifeEventNavigatorModal';
import { useAccessibleTypewriter } from '../hooks/useAccessibleTypewriter';

const Home = () => {
  const typingWords = [
    'Government Services.',
    'Passport Applications.',
    'Birth Certificates.',
    'Public Systems.'
  ];

  const {
    text: typedText,
    isPaused,
    prefersReduced,
    togglePause
  } = useAccessibleTypewriter(typingWords, {
    staticFallback: 'Public Systems.'
  });

  const [isReliefModalOpen, setIsReliefModalOpen] = useState(false);
  const [isLifeEventModalOpen, setIsLifeEventModalOpen] = useState(false);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="bg-grid-dark"></div>
      <div className="glow-blob" style={{ width: '800px', height: '800px', top: '-20%', right: '-10%', background: 'var(--accent-main)' }}></div>
      <div className="glow-blob" style={{ width: '600px', height: '600px', bottom: '10%', left: '-10%', background: 'var(--grad-end)' }}></div>

      {/* Hero Section */}
      <section className="section" style={{ paddingTop: 'clamp(5rem, 8vw, 8rem)', paddingBottom: 'clamp(4rem, 6vw, 6rem)' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '900px', padding: '0 1rem' }}>
          
          {/* Badge */}
          <div 
            className="animate-fade-in" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.4rem 1.25rem', 
              background: 'var(--glass-bg)', 
              borderRadius: '99px', 
              border: '1px solid var(--border-main)', 
              marginBottom: '1.5rem', 
              fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', 
              fontWeight: '500' 
            }}
          >
            <Sparkles size={16} color="var(--accent-main)" />
            <span>The New Standard for Civic Assistance</span>
          </div>
          
          {/* Main Accessible Hero Heading */}
          <h1 
            className="animate-fade-in delay-100" 
            style={{ 
              fontSize: 'clamp(2.25rem, 5.5vw, 4.25rem)', 
              lineHeight: '1.15', 
              fontWeight: '800', 
              marginBottom: '1.25rem',
              letterSpacing: '-0.02em',
              maxWidth: '850px'
            }}
          >
            Simplify Complex <br/>
            <span 
              className="text-gradient" 
              style={{ 
                minHeight: '1.2em', 
                display: 'inline-block',
                position: 'relative'
              }}
              aria-live="polite"
              aria-atomic="true"
            >
              {typedText}
              {!prefersReduced && (
                <span className="typing-cursor" aria-hidden="true"></span>
              )}
            </span>
          </h1>

          {/* Pause / Resume control for animation (shown when animation is supported) */}
          {!prefersReduced && (
            <div style={{ marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={togglePause}
                className="btn-pause-animation"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '99px',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
                aria-label={isPaused ? 'Resume hero text animation' : 'Pause hero text animation'}
                title={isPaused ? 'Resume animation' : 'Pause animation'}
              >
                {isPaused ? <Play size={12} /> : <Pause size={12} />}
                <span>{isPaused ? 'Resume Animation' : 'Pause Animation'}</span>
              </button>
            </div>
          )}
          
          {/* Hero Subtitle */}
          <p 
            className="animate-fade-in delay-200" 
            style={{ 
              fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', 
              color: 'var(--text-secondary)', 
              marginBottom: '2.5rem', 
              maxWidth: '680px', 
              lineHeight: '1.6' 
            }}
          >
            Civic Help Setu translates bureaucratic processes into clear, actionable steps using verified official sources. No jargon, just answers.
          </p>
          
          {/* Primary Search Interaction */}
          <div 
            className="animate-fade-in delay-300" 
            style={{ 
              width: '100%', 
              maxWidth: '680px', 
              marginBottom: '2.5rem' 
            }}
          >
            <SearchBox size="large" placeholder="What do you need help with? (e.g. Lost Aadhaar card)" />
          </div>

          {/* Action CTAs */}
          <div 
            className="animate-fade-in delay-300" 
            style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              flexWrap: 'wrap', 
              justifyContent: 'center',
              width: '100%',
              maxWidth: '750px'
            }}
          >
            <Link to="/services" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
              Explore All Guides
            </Link>
            <button
              type="button"
              onClick={() => setIsLifeEventModalOpen(true)}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'var(--accent-main)',
                color: 'var(--accent-main)',
                padding: '0.75rem 1.25rem',
                fontSize: '0.95rem'
              }}
            >
              <Compass size={16} color="var(--accent-main)" />
              <span>Life-Event Navigator</span>
            </button>
            <Link to="/assistant" className="btn btn-secondary" style={{ padding: '0.75rem 1.25rem', fontSize: '0.95rem' }}>
              Try AI Assistant
            </Link>
            <button
              type="button"
              onClick={() => setIsReliefModalOpen(true)}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#dc2626',
                color: '#dc2626',
                padding: '0.75rem 1.25rem',
                fontSize: '0.95rem'
              }}
            >
              <ShieldAlert size={16} color="#dc2626" />
              <span>Offline Relief Camps &amp; SOS</span>
            </button>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <QuickActionPanel />

      {/* Trust Bar */}
      <section className="section section-bg" style={{ padding: '4rem 0' }}>
        <div className="container grid-4">
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}><Shield size={24} color="var(--accent-main)" /></div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.25rem' }}>Verified Sources</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Official gov links only.</p>
            </div>
          </div>
          <div className="animate-fade-in delay-100" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}><CheckCircle2 size={24} color="var(--accent-main)" /></div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.25rem' }}>Clear Steps</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No confusing legal jargon.</p>
            </div>
          </div>
          <div className="animate-fade-in delay-200" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}><BookOpen size={24} color="var(--accent-main)" /></div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.25rem' }}>Checklists</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Know exactly what to bring.</p>
            </div>
          </div>
          <div className="animate-fade-in delay-300" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}><Users size={24} color="var(--accent-main)" /></div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.25rem' }}>Community</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Free and open-source.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="section">
        <div className="container">
          <div className="animate-fade-in" style={{ textAlign: 'center', marginBottom: '4rem', maxWidth: '800px', margin: '0 auto 4rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem' }}>How Civic Help Setu Works</h2>
            <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>We break down complex bureaucratic processes into clear, actionable steps.</p>
          </div>
          <div className="grid-3">
            <div className="card animate-fade-in delay-100">
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: 'var(--glass-bg)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <HelpCircle size={28} color="var(--accent-main)" />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>1. Ask the AI</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Describe your situation in plain English. Our intelligent assistant will match you with the exact service required.</p>
            </div>
            <div className="card animate-fade-in delay-200">
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: 'var(--glass-bg)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <BookOpen size={28} color="#c084fc" />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>2. Read the Guide</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Review our simplified, step-by-step guides detailing eligibility, processing times, and required documents clearly.</p>
            </div>
            <div className="card animate-fade-in delay-300">
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: 'var(--glass-bg)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <Shield size={28} color="#f472b6" />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>3. Apply Safely</h3>
              <p style={{ color: 'var(--text-secondary)' }}>We never process applications directly. We point you directly to the verified portal so you can apply securely.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <section className="section section-bg">
        <div className="container">
          <div className="flex-between animate-fade-in" style={{ marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>Explore by Category</h2>
              <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>Browse our comprehensive directory of civic guides.</p>
            </div>
            <Link to="/services" className="btn btn-secondary">View Directory <ArrowRight size={20} /></Link>
          </div>
          <div className="grid-4">
            <Link to="/services?cat=Identity" className="card animate-fade-in delay-100" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Identity &amp; Docs</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Aadhaar, Passports, Voter ID, Birth &amp; Death Certificates.</p>
              <div style={{ marginTop: 'auto', width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></div>
            </Link>
            <Link to="/services?cat=Finance" className="card animate-fade-in delay-200" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Finance &amp; Taxes</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>PAN Cards, Income Tax Returns, Provident Fund (EPF).</p>
              <div style={{ marginTop: 'auto', width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></div>
            </Link>
            <Link to="/services?cat=Transport" className="card animate-fade-in delay-300" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Transport &amp; Vehicles</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Driving Licences, Vehicle Registration (RC), Pollution Certificates.</p>
              <div style={{ marginTop: 'auto', width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></div>
            </Link>
            <Link to="/services?cat=Land" className="card animate-fade-in delay-300" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Land &amp; Revenue</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Land Records (RoR), Mutation, Encumbrance, Property Tax.</p>
              <div style={{ marginTop: 'auto', width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></div>
            </Link>
          </div>
        </div>
      </section>

      {/* Emergency & Life Navigator Modals */}
      {isReliefModalOpen && (
        <DisasterReliefHubModal isOpen={isReliefModalOpen} onClose={() => setIsReliefModalOpen(false)} />
      )}
      {isLifeEventModalOpen && (
        <LifeEventNavigatorModal isOpen={isLifeEventModalOpen} onClose={() => setIsLifeEventModalOpen(false)} />
      )}
    </div>
  );
};

export default Home;
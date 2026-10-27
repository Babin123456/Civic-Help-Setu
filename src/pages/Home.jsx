import React, { useState, useEffect } from 'react';
import SearchBox from '../components/SearchBox';
import { BookOpen, Shield, HelpCircle, Users, CheckCircle2, Code, ArrowRight, Sparkles, ShieldAlert, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import QuickActionPanel from '../components/QuickActionPanel';
import DisasterReliefHubModal from '../components/emergency/DisasterReliefHubModal';
import LifeEventNavigatorModal from '../components/journey/LifeEventNavigatorModal';

const useTypewriter = (words, typingSpeed = 80, deletingSpeed = 40, pauseDuration = 2500) => {
  const [text, setText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer;
    const currentWord = words[wordIndex];
    if (isDeleting) {
      if (text === '') {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
        timer = setTimeout(() => {}, 500); 
      } else {
        timer = setTimeout(() => setText(currentWord.substring(0, text.length - 1)), deletingSpeed);
      }
    } else {
      if (text === currentWord) {
        timer = setTimeout(() => setIsDeleting(true), pauseDuration);
      } else {
        timer = setTimeout(() => setText(currentWord.substring(0, text.length + 1)), typingSpeed);
      }
    }
    return () => clearTimeout(timer);
  }, [text, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

  return text;
};

const Home = () => {
  const typingWords = ["Government Services.", "Passport Applications.", "Birth Certificates.", "Public Systems."];
  const typedText = useTypewriter(typingWords);
  const [isReliefModalOpen, setIsReliefModalOpen] = useState(false);
  const [isLifeEventModalOpen, setIsLifeEventModalOpen] = useState(false);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="bg-grid-dark"></div>
      <div className="glow-blob" style={{ width: '800px', height: '800px', top: '-20%', right: '-10%', background: 'var(--accent-main)' }}></div>
      <div className="glow-blob" style={{ width: '600px', height: '600px', bottom: '10%', left: '-10%', background: 'var(--grad-end)' }}></div>

      {/* Hero Section */}
      <section className="section" style={{ paddingTop: '8rem', paddingBottom: '6rem' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '900px' }}>
          <div className="animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', background: 'var(--glass-bg)', borderRadius: '99px', border: '1px solid var(--border-main)', marginBottom: '2rem', fontSize: '0.9rem', fontWeight: '500' }}>
            <Sparkles size={16} color="var(--accent-main)" />
            <span>The New Standard for Civic Assistance</span>
          </div>
          
          <h1 className="animate-fade-in delay-100" style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)', lineHeight: '1.1', fontWeight: '800', marginBottom: '1.5rem' }}>
            Simplify Complex <br/>
            <span className="text-gradient" style={{ minHeight: '1.2em', display: 'inline-block' }}>
              {typedText}
              <span className="typing-cursor"></span>
            </span>
          </h1>
          
          <p className="animate-fade-in delay-200" style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: '700px', lineHeight: '1.6' }}>
            CivicBridge translates bureaucratic processes into clear, actionable steps using verified official sources. No jargon, just answers.
          </p>
          
          <div className="animate-fade-in delay-300" style={{ width: '100%', maxWidth: '700px', marginBottom: '3rem' }}>
            <SearchBox size="large" placeholder="What do you need help with? (e.g. Lost Aadhaar card)" />
          </div>

          <div className="animate-fade-in delay-300" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/services" className="btn btn-primary">Explore All Guides</Link>
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
              }}
            >
              <Compass size={16} color="var(--accent-main)" />
              <span>Life-Event Navigator</span>
            </button>
            <Link to="/assistant" className="btn btn-secondary">Try AI Assistant</Link>
            <button
              type="button"
              onClick={() => setIsReliefModalOpen(true)}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#dc2626',
                color: '#dc2626'
              }}
            >
              <ShieldAlert size={16} color="#dc2626" />
              <span>Offline Relief Camps & SOS</span>
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
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem' }}>How CivicBridge Works</h2>
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
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Identity & Docs</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Aadhaar, Passports, Voter ID, Birth & Death Certificates.</p>
              <div style={{ marginTop: 'auto', width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></div>
            </Link>
            <Link to="/services?cat=Finance" className="card animate-fade-in delay-200" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Finance & Taxes</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>PAN Cards, Income Tax Returns, Provident Fund (EPF).</p>
              <div style={{ marginTop: 'auto', width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></div>
            </Link>
            <Link to="/services?cat=Transport" className="card animate-fade-in delay-300" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Transport</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Driving Licenses, Vehicle Registration, Challan Payments.</p>
              <div style={{ marginTop: 'auto', width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></div>
            </Link>
            <Link to="/services?cat=Health" className="card animate-fade-in delay-300" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Health & Welfare</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Ayushman Bharat, Ration Cards, Pension Schemes.</p>
              <div style={{ marginTop: 'auto', width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={18} /></div>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container animate-fade-in" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', padding: '1.25rem', background: 'var(--glass-bg)', borderRadius: '1.25rem', border: '1px solid var(--border-main)', marginBottom: '2rem' }}>
            <Code size={40} color="var(--text-primary)" />
          </div>
          <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1.5rem' }}>100% Open Source</h2>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-tertiary)', marginBottom: '2.5rem', lineHeight: '1.6' }}>
            Public-service information should belong to the public. Our entire platform is community-maintained on GitHub.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/open-source" className="btn btn-primary">Learn More</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">View on GitHub</a>
          </div>
        </div>
      </section>

      {/* Offline Disaster Relief & Emergency Hub Modal */}
      <DisasterReliefHubModal
        isOpen={isReliefModalOpen}
        onClose={() => setIsReliefModalOpen(false)}
      />

      {/* Civic Life-Event Navigator Modal */}
      <LifeEventNavigatorModal
        isOpen={isLifeEventModalOpen}
        onClose={() => setIsLifeEventModalOpen(false)}
      />
    </div>
  );
};

export default Home;

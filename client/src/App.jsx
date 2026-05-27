import React, { useState } from 'react';
import LandingHero from './components/LandingHero.jsx';
import GeneratorForm from './components/GeneratorForm.jsx';
import PaywallModal from './components/PaywallModal.jsx';
import SuccessBanner from './components/SuccessBanner.jsx';

const FREE_LIMIT = 3;
const STORAGE_KEY = 'haultiall_generations';

function getUsageCount() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementUsage() {
  try {
    const next = getUsageCount() + 1;
    localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

export default function App() {
  const [usageCount, setUsageCount] = useState(getUsageCount);
  const [showPaywall, setShowPaywall] = useState(false);
  const [lastDownload, setLastDownload] = useState(null);

  const isAtLimit = usageCount >= FREE_LIMIT;

  function handleGenerationStart() {
    if (isAtLimit) {
      setShowPaywall(true);
      return false; // block generation
    }
    return true;
  }

  function handleGenerationSuccess(filename) {
    const newCount = incrementUsage();
    setUsageCount(newCount);
    setLastDownload(filename);
    if (newCount >= FREE_LIMIT) {
      // will show paywall next time
    }
  }

  return (
    <div className="app">
      <LandingHero remainingGenerations={Math.max(0, FREE_LIMIT - usageCount)} />

      <main className="main-content">
        {lastDownload && (
          <SuccessBanner filename={lastDownload} onDismiss={() => setLastDownload(null)} />
        )}

        <GeneratorForm
          onBeforeGenerate={handleGenerationStart}
          onSuccess={handleGenerationSuccess}
          remainingGenerations={Math.max(0, FREE_LIMIT - usageCount)}
          isAtLimit={isAtLimit}
          onShowPaywall={() => setShowPaywall(true)}
        />

        <HowItWorks />
        <Features />
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Haultiall · Powered by Claude AI</p>
        <p className="footer-sub">Turn any YouTube video into a print-ready lesson plan in seconds.</p>
      </footer>

      {showPaywall && (
        <PaywallModal
          usageCount={usageCount}
          freeLimit={FREE_LIMIT}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: '🔗', title: 'Paste a YouTube URL', desc: 'Any educational video with closed captions works.' },
    { icon: '🎓', title: 'Select a grade level', desc: 'K–2, 3–5, 6–8, or 9–12. AI adapts everything.' },
    { icon: '⚡', title: 'Get your lesson plan', desc: 'Claude generates a full plan in ~20 seconds.' },
    { icon: '📄', title: 'Download the PDF', desc: 'Print-ready with quiz, test, activity & homework.' },
  ];

  return (
    <section className="section how-it-works">
      <h2 className="section-title">How it works</h2>
      <div className="steps-grid">
        {steps.map((s, i) => (
          <div key={i} className="step-card">
            <div className="step-number">{i + 1}</div>
            <div className="step-icon">{s.icon}</div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: '🎯', title: 'Learning Objectives', desc: 'Standards-aligned goals for every lesson.' },
    { icon: '📚', title: 'Key Vocabulary', desc: 'Grade-appropriate definitions extracted from the video.' },
    { icon: '💬', title: 'Discussion Questions', desc: '5 open-ended questions to spark classroom dialogue.' },
    { icon: '🔬', title: 'Hands-On Activity', desc: 'Step-by-step activity with materials list.' },
    { icon: '✏️', title: 'Quiz & Unit Test', desc: '5-question quiz + 10-question test with answer keys.' },
    { icon: '🏠', title: 'Homework Assignment', desc: 'Clearly written take-home instructions.' },
  ];

  return (
    <section className="section features">
      <h2 className="section-title">What's inside every lesson plan</h2>
      <div className="features-grid">
        {features.map((f, i) => (
          <div key={i} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

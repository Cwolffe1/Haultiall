import React from 'react';

export default function LandingHero({ remainingGenerations }) {
  return (
    <header className="hero">
      <div className="hero-inner">
        <div className="hero-badge">✨ AI-Powered · Free to try</div>
        <h1 className="hero-title">
          Turn any YouTube video<br />
          into a <span className="hero-accent">lesson plan PDF</span>
        </h1>
        <p className="hero-subtitle">
          Paste a URL, pick a grade level, and get a fully structured, print-ready
          lesson plan in seconds — complete with quiz, test, activity, and homework.
        </p>
        <div className="hero-pills">
          <span className="pill pill-blue">📝 Objectives</span>
          <span className="pill pill-purple">📚 Vocabulary</span>
          <span className="pill pill-green">🔬 Activity</span>
          <span className="pill pill-orange">✏️ Quiz + Test</span>
          <span className="pill pill-red">🏠 Homework</span>
        </div>
        {remainingGenerations > 0 && (
          <p className="hero-free-note">
            🎁 <strong>{remainingGenerations} free generation{remainingGenerations !== 1 ? 's' : ''}</strong> remaining
          </p>
        )}
      </div>
    </header>
  );
}

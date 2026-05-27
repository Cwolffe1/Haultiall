import React from 'react';

const PLANS = [
  {
    name: 'Starter',
    price: '$9',
    period: '/month',
    generations: '30 lesson plans/mo',
    highlight: false,
    features: [
      '30 lesson plans per month',
      'All grade levels (K–12)',
      'Full PDF with quiz & test',
      'Email support',
    ],
    cta: 'Get Starter',
  },
  {
    name: 'Teacher Pro',
    price: '$19',
    period: '/month',
    generations: 'Unlimited',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited lesson plans',
      'All grade levels (K–12)',
      'Full PDF with quiz & test',
      'Priority support',
      'Early access to new features',
    ],
    cta: 'Get Teacher Pro',
  },
  {
    name: 'School',
    price: '$49',
    period: '/month',
    generations: 'Unlimited · 10 seats',
    highlight: false,
    features: [
      'Unlimited lesson plans',
      'Up to 10 teacher accounts',
      'All grade levels (K–12)',
      'Admin dashboard',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
  },
];

export default function PaywallModal({ usageCount, freeLimit, onClose }) {
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true">
      <div className="modal-box">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="modal-header">
          <div className="modal-icon">🎓</div>
          <h2 className="modal-title">You've used all {freeLimit} free generations</h2>
          <p className="modal-subtitle">
            Upgrade to keep turning YouTube videos into ready-to-teach lesson plans.
          </p>
        </div>

        <div className="plans-grid">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`plan-card ${plan.highlight ? 'plan-card--highlight' : ''}`}>
              {plan.badge && <div className="plan-badge">{plan.badge}</div>}
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                <span className="plan-amount">{plan.price}</span>
                <span className="plan-period">{plan.period}</span>
              </div>
              <p className="plan-generations">{plan.generations}</p>
              <ul className="plan-features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <span className="check">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                className={`plan-cta ${plan.highlight ? 'plan-cta--highlight' : ''}`}
                onClick={() => {
                  // Stripe integration placeholder
                  alert(`Stripe checkout coming soon!\nPlan: ${plan.name} ${plan.price}/mo`);
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="modal-footer-note">
          🔒 Secure checkout via Stripe · Cancel anytime · No hidden fees
        </p>
      </div>
    </div>
  );
}

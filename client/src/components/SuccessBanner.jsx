import React from 'react';

export default function SuccessBanner({ filename, onDismiss }) {
  return (
    <div className="success-banner" role="status">
      <span className="success-banner-icon">🎉</span>
      <span>
        <strong>{filename}</strong> was downloaded successfully!
      </span>
      <button className="success-banner-close" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

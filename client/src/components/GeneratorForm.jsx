import React, { useState, useRef } from 'react';

const GRADE_LEVELS = [
  { value: 'K-2',  label: 'K–2',  desc: 'Kindergarten – 2nd Grade' },
  { value: '3-5',  label: '3–5',  desc: '3rd – 5th Grade' },
  { value: '6-8',  label: '6–8',  desc: '6th – 8th Grade' },
  { value: '9-12', label: '9–12', desc: '9th – 12th Grade' },
];

const STAGES = {
  IDLE:        'idle',
  TRANSCRIPT:  'transcript',
  GENERATING:  'generating',
  PDF:         'pdf',
  DONE:        'done',
  ERROR:       'error',
};

const STAGE_MESSAGES = {
  [STAGES.TRANSCRIPT]:  '🔍 Fetching video transcript…',
  [STAGES.GENERATING]:  '🧠 Claude is writing your lesson plan…',
  [STAGES.PDF]:         '📄 Building your PDF…',
  [STAGES.DONE]:        '✅ Your lesson plan is ready!',
};

export default function GeneratorForm({
  onBeforeGenerate,
  onSuccess,
  remainingGenerations,
  isAtLimit,
  onShowPaywall,
}) {
  const [url, setUrl] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [stage, setStage] = useState(STAGES.IDLE);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const abortRef = useRef(null);

  const isLoading = [STAGES.TRANSCRIPT, STAGES.GENERATING, STAGES.PDF].includes(stage);

  /** Mirrors the server-side parser — returns true if the string looks like something we can handle */
  function looksLikeYouTube(val) {
    return (
      /[?&]v=([a-zA-Z0-9_-]{11})/.test(val) ||       // ?v=ID
      /youtu\.be\/([a-zA-Z0-9_-]{11})/.test(val) ||   // youtu.be/ID
      /youtube\.com\/(embed|v|shorts|live)\/([a-zA-Z0-9_-]{11})/.test(val) || // embed/v/shorts/live
      /^[a-zA-Z0-9_-]{11}$/.test(val)                 // bare 11-char ID
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setDownloadUrl('');

    if (isAtLimit) {
      onShowPaywall();
      return;
    }

    if (!url.trim()) {
      setError('Please enter a YouTube URL.');
      return;
    }
    if (!looksLikeYouTube(url.trim())) {
      setError(
        'That doesn\'t look like a YouTube URL. Paste the full URL from your browser, e.g. https://youtube.com/watch?v=...'
      );
      return;
    }
    if (!gradeLevel) {
      setError('Please select a grade level.');
      return;
    }

    const allowed = onBeforeGenerate();
    if (!allowed) return;

    // Revoke previous blob URL
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setStage(STAGES.TRANSCRIPT);

      // Small delay to show transcript stage message
      await new Promise((r) => setTimeout(r, 600));
      setStage(STAGES.GENERATING);

      // In dev, Vite proxies /api → localhost:3001.
      // In production (Vercel), VITE_API_URL points to the Render backend.
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: url.trim(), gradeLevel }),
        signal: controller.signal,
      });

      setStage(STAGES.PDF);

      if (!res.ok) {
        let msg = `Server error (${res.status})`;
        try {
          const json = await res.json();
          msg = json.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header
      const cd = res.headers.get('Content-Disposition') || '';
      const nameMatch = cd.match(/filename="?([^"]+)"?/);
      const name = nameMatch ? nameMatch[1] : 'lesson-plan.pdf';

      setDownloadUrl(blobUrl);
      setFileName(name);
      setStage(STAGES.DONE);
      onSuccess(name);

      // Auto-trigger download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      if (err.name === 'AbortError') {
        setStage(STAGES.IDLE);
        return;
      }
      setError(err.message || 'Something went wrong. Please try again.');
      setStage(STAGES.ERROR);
    }
  }

  function handleReset() {
    if (abortRef.current) abortRef.current.abort();
    setStage(STAGES.IDLE);
    setError('');
  }

  return (
    <section className="generator-section">
      <div className="generator-card">
        <h2 className="generator-title">Generate a Lesson Plan</h2>

        {!isAtLimit ? (
          <p className="generator-subtitle">
            {remainingGenerations} free generation{remainingGenerations !== 1 ? 's' : ''} remaining
          </p>
        ) : (
          <p className="generator-subtitle limit-reached">
            You've used all 3 free generations.{' '}
            <button className="link-btn" onClick={onShowPaywall}>Upgrade to continue →</button>
          </p>
        )}

        <form onSubmit={handleSubmit} className="generator-form" noValidate>
          {/* YouTube URL */}
          <div className="field-group">
            <label htmlFor="yt-url" className="field-label">
              YouTube URL
            </label>
            <div className="url-input-wrapper">
              <span className="url-icon">▶</span>
              <input
                id="yt-url"
                type="text"
                className="field-input url-input"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Grade level */}
          <div className="field-group">
            <label className="field-label">Grade Level</label>
            <div className="grade-buttons">
              {GRADE_LEVELS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  className={`grade-btn ${gradeLevel === g.value ? 'grade-btn--active' : ''}`}
                  onClick={() => setGradeLevel(g.value)}
                  disabled={isLoading}
                  title={g.desc}
                >
                  <span className="grade-label">{g.label}</span>
                  <span className="grade-desc">{g.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="error-box" role="alert">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Progress */}
          {isLoading && (
            <div className="progress-box">
              <div className="spinner" aria-hidden="true" />
              <span className="progress-text">{STAGE_MESSAGES[stage]}</span>
              <button type="button" className="cancel-btn" onClick={handleReset}>
                Cancel
              </button>
            </div>
          )}

          {/* Submit */}
          {!isLoading && stage !== STAGES.DONE && (
            <button
              type="submit"
              className={`submit-btn ${isAtLimit ? 'submit-btn--disabled' : ''}`}
              disabled={isAtLimit}
            >
              {isAtLimit ? '🔒 Upgrade to Generate' : '✨ Generate Lesson Plan PDF'}
            </button>
          )}

          {/* Done state */}
          {stage === STAGES.DONE && downloadUrl && (
            <div className="done-box">
              <div className="done-checkmark">✅</div>
              <p className="done-msg">Your lesson plan PDF is ready!</p>
              <a
                href={downloadUrl}
                download={fileName}
                className="download-btn"
              >
                ⬇ Download {fileName}
              </a>
              <button
                type="button"
                className="new-btn"
                onClick={() => {
                  setStage(STAGES.IDLE);
                  setUrl('');
                  setGradeLevel('');
                  setDownloadUrl('');
                  setFileName('');
                }}
              >
                Generate another
              </button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

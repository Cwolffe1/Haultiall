const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');
const { YoutubeTranscript } = require('youtube-transcript');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract YouTube video ID from various URL formats */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Fetch and join YouTube transcript text */
async function fetchTranscript(videoId) {
  const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
  if (!segments || segments.length === 0) {
    throw new Error('No transcript available for this video. Make sure the video has closed captions enabled.');
  }
  return segments.map((s) => s.text).join(' ');
}

/** Call Claude to generate structured lesson plan JSON */
async function generateLessonPlan(transcript, gradeLevel) {
  const client = new Anthropic();

  const gradeDescriptions = {
    'K-2':  'Kindergarten through 2nd Grade (ages 5–8)',
    '3-5':  '3rd through 5th Grade (ages 8–11)',
    '6-8':  '6th through 8th Grade (ages 11–14)',
    '9-12': '9th through 12th Grade (ages 14–18)',
  };

  const gradeDesc = gradeDescriptions[gradeLevel] || gradeLevel;

  const systemPrompt = `You are an expert curriculum developer and master teacher with 20+ years of experience creating engaging, standards-aligned lesson plans. You create developmentally appropriate content tailored to the exact grade band requested.`;

  const userPrompt = `Create a comprehensive, classroom-ready lesson plan for ${gradeDesc} students based on the following YouTube video transcript.

TRANSCRIPT:
"""
${transcript.slice(0, 12000)}
"""

Return ONLY a valid JSON object (no markdown fences, no extra text) with this exact structure:
{
  "title": "Engaging lesson title that captures the video's main topic",
  "subject": "Subject area (e.g., Science, Social Studies, ELA)",
  "gradeLevel": "${gradeLevel}",
  "duration": "Estimated class time (e.g., '45–60 minutes')",
  "standards": "Brief note on relevant standards alignment (e.g., NGSS, CCSS)",
  "overview": "2–3 sentence lesson overview for the teacher",
  "learningObjectives": [
    "Students will be able to...",
    "Students will be able to...",
    "Students will be able to..."
  ],
  "vocabulary": [
    { "term": "word", "definition": "grade-appropriate definition" }
  ],
  "warmUp": {
    "description": "Brief warm-up activity or hook to engage students (5 min)",
    "prompt": "Opening question or activity prompt"
  },
  "discussionQuestions": [
    "Open-ended question 1?",
    "Open-ended question 2?",
    "Open-ended question 3?",
    "Open-ended question 4?",
    "Open-ended question 5?"
  ],
  "activity": {
    "title": "Activity title",
    "description": "Brief description of the main learning activity",
    "materials": ["material 1", "material 2"],
    "steps": [
      "Step 1 instruction",
      "Step 2 instruction",
      "Step 3 instruction"
    ],
    "differentiationTips": "How to support diverse learners"
  },
  "quiz": {
    "instructions": "Quiz instructions for students",
    "questions": [
      { "question": "Question 1?", "answer": "Answer 1" },
      { "question": "Question 2?", "answer": "Answer 2" },
      { "question": "Question 3?", "answer": "Answer 3" },
      { "question": "Question 4?", "answer": "Answer 4" },
      { "question": "Question 5?", "answer": "Answer 5" }
    ]
  },
  "test": {
    "instructions": "Test instructions for students",
    "questions": [
      { "question": "Question 1?", "answer": "Answer 1" },
      { "question": "Question 2?", "answer": "Answer 2" },
      { "question": "Question 3?", "answer": "Answer 3" },
      { "question": "Question 4?", "answer": "Answer 4" },
      { "question": "Question 5?", "answer": "Answer 5" },
      { "question": "Question 6?", "answer": "Answer 6" },
      { "question": "Question 7?", "answer": "Answer 7" },
      { "question": "Question 8?", "answer": "Answer 8" },
      { "question": "Question 9?", "answer": "Answer 9" },
      { "question": "Question 10?", "answer": "Answer 10" }
    ]
  },
  "homework": {
    "title": "Homework assignment title",
    "description": "Clear homework description",
    "instructions": [
      "Instruction 1",
      "Instruction 2",
      "Instruction 3"
    ],
    "dueDate": "Next class session"
  },
  "teacherNotes": "Tips for the teacher, common misconceptions to address, extension ideas"
}

Make all content grade-appropriate in vocabulary, complexity, and cognitive demand. For K-2 use simple language and hands-on activities. For 9-12 use rigorous academic language and higher-order thinking.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = message.content[0].text.trim();

  // Strip markdown code fences if present
  const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  return JSON.parse(jsonText);
}

// ─── PDF Builder ──────────────────────────────────────────────────────────────

function buildPDF(plan, videoUrl) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // ── Color palette ──
    const BRAND_BLUE   = '#2563EB';
    const BRAND_PURPLE = '#7C3AED';
    const DARK         = '#1E293B';
    const GRAY         = '#64748B';
    const LIGHT_GRAY   = '#F1F5F9';
    const WHITE        = '#FFFFFF';

    // ── Helpers ──
    const pageWidth = doc.page.width - 100; // margins

    function sectionHeader(title, color = BRAND_BLUE) {
      doc.moveDown(0.6);
      // Colored left bar
      const y = doc.y;
      doc.rect(50, y, 4, 18).fill(color);
      doc.font('Helvetica-Bold').fontSize(13).fillColor(color).text(title, 62, y);
      doc.moveDown(0.4);
      doc.fillColor(DARK);
    }

    function bulletList(items, indent = 70) {
      doc.font('Helvetica').fontSize(10).fillColor(DARK);
      items.forEach((item) => {
        const text = typeof item === 'string' ? item : JSON.stringify(item);
        doc.text(`• ${text}`, indent, doc.y, { width: pageWidth - (indent - 50) });
      });
    }

    function numberedList(items, indent = 70) {
      doc.font('Helvetica').fontSize(10).fillColor(DARK);
      items.forEach((item, i) => {
        const text = typeof item === 'string' ? item : JSON.stringify(item);
        doc.text(`${i + 1}. ${text}`, indent, doc.y, { width: pageWidth - (indent - 50) });
      });
    }

    function labelValue(label, value, opts = {}) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY).text(label + '  ', {
        continued: true,
        ...opts,
      });
      doc.font('Helvetica').fontSize(10).fillColor(DARK).text(value);
    }

    function addPageIfNeeded(spaceNeeded = 80) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - spaceNeeded) {
        doc.addPage();
      }
    }

    // ════════════════════════════════════════════════════
    // PAGE 1 — COVER / HEADER
    // ════════════════════════════════════════════════════

    // Gradient-style header band
    doc.rect(0, 0, doc.page.width, 130).fill(BRAND_BLUE);

    // App watermark text
    doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.4)')
       .text('HAULTIALL', 50, 16, { align: 'right', width: pageWidth });

    // Lesson title
    doc.font('Helvetica-Bold').fontSize(22).fillColor(WHITE)
       .text(plan.title || 'Lesson Plan', 50, 30, { width: pageWidth });

    // Sub-line
    const subLine = [
      plan.subject,
      `Grade ${plan.gradeLevel}`,
      plan.duration,
    ].filter(Boolean).join('  ·  ');
    doc.font('Helvetica').fontSize(12).fillColor('rgba(255,255,255,0.85)')
       .text(subLine, 50, doc.y + 4);

    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.6)')
       .text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, doc.y);

    doc.y = 150;

    // Standards + overview box
    if (plan.standards || plan.overview) {
      doc.rect(50, doc.y, pageWidth, plan.overview ? 70 : 30).fill(LIGHT_GRAY);
      const boxY = doc.y + 8;
      if (plan.standards) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('STANDARDS ALIGNMENT', 62, boxY);
        doc.font('Helvetica').fontSize(9).fillColor(DARK).text(plan.standards, 62, doc.y + 2, { width: pageWidth - 24 });
      }
      if (plan.overview) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('OVERVIEW', 62, doc.y + (plan.standards ? 8 : 0));
        doc.font('Helvetica').fontSize(9).fillColor(DARK).text(plan.overview, 62, doc.y + 2, { width: pageWidth - 24 });
      }
      doc.y += plan.overview ? 80 : 42;
    }

    // Source URL
    if (videoUrl) {
      doc.font('Helvetica').fontSize(8).fillColor(GRAY)
         .text(`Source: ${videoUrl}`, 50, doc.y, { width: pageWidth });
      doc.moveDown(0.5);
    }

    // ── Learning Objectives ──
    if (plan.learningObjectives?.length) {
      sectionHeader('Learning Objectives', BRAND_BLUE);
      bulletList(plan.learningObjectives);
    }

    // ── Vocabulary ──
    if (plan.vocabulary?.length) {
      addPageIfNeeded(100);
      sectionHeader('Key Vocabulary', BRAND_PURPLE);
      doc.font('Helvetica').fontSize(10).fillColor(DARK);
      plan.vocabulary.forEach((v) => {
        doc.font('Helvetica-Bold').text(`${v.term}: `, 70, doc.y, { continued: true });
        doc.font('Helvetica').text(v.definition, { width: pageWidth - 20 });
      });
    }

    // ── Warm-Up ──
    if (plan.warmUp) {
      addPageIfNeeded(80);
      sectionHeader('Warm-Up / Hook (5 min)', '#059669');
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
         .text(plan.warmUp.description, 70, doc.y, { width: pageWidth - 20 });
      if (plan.warmUp.prompt) {
        doc.moveDown(0.3);
        doc.font('Helvetica-BoldOblique').fontSize(10).fillColor(GRAY)
           .text(`"${plan.warmUp.prompt}"`, 70, doc.y, { width: pageWidth - 20 });
      }
    }

    // ── Discussion Questions ──
    if (plan.discussionQuestions?.length) {
      addPageIfNeeded(120);
      sectionHeader('Discussion Questions', BRAND_BLUE);
      numberedList(plan.discussionQuestions);
    }

    // ════════════════════════════════════════════════════
    // ACTIVITY
    // ════════════════════════════════════════════════════
    if (plan.activity) {
      addPageIfNeeded(150);
      sectionHeader(`Activity: ${plan.activity.title || 'Classroom Activity'}`, '#D97706');
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
         .text(plan.activity.description, 70, doc.y, { width: pageWidth - 20 });

      if (plan.activity.materials?.length) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY).text('Materials:', 70, doc.y);
        bulletList(plan.activity.materials);
      }

      if (plan.activity.steps?.length) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY).text('Steps:', 70, doc.y);
        numberedList(plan.activity.steps);
      }

      if (plan.activity.differentiationTips) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY).text('Differentiation: ', 70, doc.y, { continued: true });
        doc.font('Helvetica').fontSize(10).fillColor(DARK).text(plan.activity.differentiationTips);
      }
    }

    // ════════════════════════════════════════════════════
    // QUIZ
    // ════════════════════════════════════════════════════
    if (plan.quiz?.questions?.length) {
      doc.addPage();

      // Quiz header
      doc.rect(0, 0, doc.page.width, 50).fill(BRAND_BLUE);
      doc.font('Helvetica-Bold').fontSize(18).fillColor(WHITE).text('📝  Quiz', 50, 15);
      doc.y = 65;

      if (plan.quiz.instructions) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(GRAY)
           .text(plan.quiz.instructions, 50, doc.y, { width: pageWidth });
        doc.moveDown(0.5);
      }

      doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Questions', 50, doc.y);
      doc.moveDown(0.3);
      plan.quiz.questions.forEach((q, i) => {
        addPageIfNeeded(60);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
           .text(`${i + 1}. ${q.question}`, 50, doc.y, { width: pageWidth });
        doc.rect(50, doc.y + 4, pageWidth, 20).stroke(LIGHT_GRAY);
        doc.moveDown(1.5);
      });

      // Answer key
      doc.moveDown(1);
      doc.rect(50, doc.y, pageWidth, 20).fill(LIGHT_GRAY);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND_BLUE).text('Answer Key', 50, doc.y + 4);
      doc.y += 28;
      plan.quiz.questions.forEach((q, i) => {
        addPageIfNeeded(30);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text(`${i + 1}. `, 50, doc.y, { continued: true });
        doc.font('Helvetica').fontSize(9).fillColor(DARK).text(q.answer, { width: pageWidth - 20 });
      });
    }

    // ════════════════════════════════════════════════════
    // TEST
    // ════════════════════════════════════════════════════
    if (plan.test?.questions?.length) {
      doc.addPage();

      doc.rect(0, 0, doc.page.width, 50).fill(BRAND_PURPLE);
      doc.font('Helvetica-Bold').fontSize(18).fillColor(WHITE).text('📋  Unit Test', 50, 15);
      doc.y = 65;

      if (plan.test.instructions) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(GRAY)
           .text(plan.test.instructions, 50, doc.y, { width: pageWidth });
        doc.moveDown(0.5);
      }

      doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Questions', 50, doc.y);
      doc.moveDown(0.3);

      plan.test.questions.forEach((q, i) => {
        addPageIfNeeded(70);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
           .text(`${i + 1}. ${q.question}`, 50, doc.y, { width: pageWidth });
        doc.rect(50, doc.y + 4, pageWidth, 30).stroke(LIGHT_GRAY);
        doc.moveDown(2.5);
      });

      // Answer key
      doc.moveDown(1);
      doc.rect(50, doc.y, pageWidth, 20).fill(LIGHT_GRAY);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND_PURPLE).text('Answer Key', 50, doc.y + 4);
      doc.y += 28;
      plan.test.questions.forEach((q, i) => {
        addPageIfNeeded(30);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text(`${i + 1}. `, 50, doc.y, { continued: true });
        doc.font('Helvetica').fontSize(9).fillColor(DARK).text(q.answer, { width: pageWidth - 20 });
      });
    }

    // ════════════════════════════════════════════════════
    // HOMEWORK
    // ════════════════════════════════════════════════════
    if (plan.homework) {
      doc.addPage();

      doc.rect(0, 0, doc.page.width, 50).fill('#059669');
      doc.font('Helvetica-Bold').fontSize(18).fillColor(WHITE)
         .text(`🏠  Homework: ${plan.homework.title || 'Assignment'}`, 50, 15);
      doc.y = 65;

      if (plan.homework.description) {
        doc.font('Helvetica').fontSize(10).fillColor(DARK)
           .text(plan.homework.description, 50, doc.y, { width: pageWidth });
        doc.moveDown(0.5);
      }

      if (plan.homework.instructions?.length) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Instructions:', 50, doc.y);
        doc.moveDown(0.3);
        numberedList(plan.homework.instructions, 50);
      }

      if (plan.homework.dueDate) {
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY).text('Due: ', 50, doc.y, { continued: true });
        doc.font('Helvetica').fontSize(10).fillColor(DARK).text(plan.homework.dueDate);
      }

      // Student submission box
      doc.moveDown(1.5);
      doc.rect(50, doc.y, pageWidth, 120).stroke(LIGHT_GRAY);
      doc.font('Helvetica').fontSize(9).fillColor(GRAY).text('Student Name: ________________________    Date: ________________', 60, doc.y + 10);
    }

    // ════════════════════════════════════════════════════
    // TEACHER NOTES (last page)
    // ════════════════════════════════════════════════════
    if (plan.teacherNotes) {
      addPageIfNeeded(100);
      sectionHeader('Teacher Notes & Extension Ideas', GRAY);
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
         .text(plan.teacherNotes, 70, doc.y, { width: pageWidth - 20 });
    }

    // ── Footer on each page ──
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor(GRAY)
         .text(
           `Haultiall • Lesson Plan Generator • Page ${i + 1} of ${pageCount}`,
           50,
           doc.page.height - 35,
           { align: 'center', width: pageWidth },
         );
    }

    doc.end();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/generate */
router.post('/generate', async (req, res) => {
  try {
    const { youtubeUrl, gradeLevel } = req.body;

    if (!youtubeUrl || !gradeLevel) {
      return res.status(400).json({ error: 'youtubeUrl and gradeLevel are required.' });
    }

    const validGrades = ['K-2', '3-5', '6-8', '9-12'];
    if (!validGrades.includes(gradeLevel)) {
      return res.status(400).json({ error: `gradeLevel must be one of: ${validGrades.join(', ')}` });
    }

    // 1. Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL. Please provide a valid YouTube video link.' });
    }

    // 2. Fetch transcript
    let transcript;
    try {
      transcript = await fetchTranscript(videoId);
    } catch (err) {
      return res.status(422).json({
        error: `Could not fetch transcript: ${err.message}`,
      });
    }

    if (transcript.split(' ').length < 30) {
      return res.status(422).json({ error: 'Transcript is too short to generate a lesson plan.' });
    }

    // 3. Generate lesson plan via Claude
    let plan;
    try {
      plan = await generateLessonPlan(transcript, gradeLevel);
    } catch (err) {
      console.error('Claude error:', err);
      return res.status(502).json({ error: `AI generation failed: ${err.message}` });
    }

    // 4. Build PDF
    let pdfBuffer;
    try {
      pdfBuffer = await buildPDF(plan, youtubeUrl);
    } catch (err) {
      console.error('PDF error:', err);
      return res.status(500).json({ error: `PDF generation failed: ${err.message}` });
    }

    // 5. Return PDF
    const safeTitle = (plan.title || 'lesson-plan').replace(/[^a-z0-9]/gi, '-').slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});

/** GET /api/validate — lightweight check that API key is set */
router.get('/validate', (req, res) => {
  res.json({ apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY });
});

module.exports = router;

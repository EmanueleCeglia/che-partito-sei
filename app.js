/* ============================================
   CHE PARTITO SEI? — App Logic (v2 Optimized)
   Distance-based scoring with neutral questions
   ============================================ */

// ── Party colors ──
const PARTY_COLORS = {
  'AVS': '#E8452C',
  'M5S': '#F5C518',
  'PD': '#E2001A',
  'Piueuropa': '#0047AB',
  'italia Viva': '#EB5D80',
  'Azione': '#1C4DA1',
  'Liberaldemocratico': '#7C3AED',
  'Forza italia': '#0077CC',
  "Fratelli d'italia": '#003D7A',
  'Lega': '#008C45',
  'Futuro nazionale': '#64748b',
};

// ── State ──
let quizData = null;       // raw JSON data
let questions = [];        // flat array of all questions in order
let answers = [];          // user answers (1-7), indexed same as questions
let currentIndex = 0;      // current question index
let isTransitioning = false;

// ── DOM References ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  loadingOverlay: $('#loading-overlay'),
  screenLanding: $('#screen-landing'),
  screenQuiz: $('#screen-quiz'),
  screenResults: $('#screen-results'),
  catTransition: $('#category-transition'),
  catTransIcon: $('#cat-trans-icon'),
  catTransName: $('#cat-trans-name'),
  catTransInfo: $('#cat-trans-info'),
  catTransDots: $('#cat-trans-dots'),
  btnStart: $('#btn-start'),
  btnContinue: $('#btn-continue'),
  btnCatContinue: $('#btn-cat-continue'),
  btnPrev: $('#btn-prev'),
  btnNext: $('#btn-next'),
  btnRestart: $('#btn-restart'),
  btnQuizBack: $('#btn-quiz-back'),
  progressFill: $('#quiz-progress-fill'),
  quizCurrentNum: $('#quiz-current-num'),
  quizTotalNum: $('#quiz-total-num'),
  quizCategoryBadge: $('#quiz-category-badge'),
  quizThemeName: $('#quiz-theme-name'),
  quizStatement: $('#quiz-statement'),
  quizStatementText: $('#quiz-statement-text'),
  ratingButtons: $('#rating-buttons'),
  winnerName: $('#winner-name'),
  winnerScore: $('#winner-score'),
  overallRanking: $('#overall-ranking'),
  categoryBreakdown: $('#category-breakdown'),
};

// ── Utility functions ──

/** Show a screen by id */
function showScreen(screenId) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${screenId}`).classList.add('active');
  // Scroll to top when changing screens
  window.scrollTo(0, 0);
}

/** Save progress to localStorage */
function saveProgress() {
  const data = {
    answers,
    currentIndex,
    timestamp: Date.now(),
  };
  localStorage.setItem('chePartito_progress_v2', JSON.stringify(data));
}

/** Load progress from localStorage */
function loadProgress() {
  try {
    const raw = localStorage.getItem('chePartito_progress_v2');
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Only allow resume if less than 7 days old
    if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem('chePartito_progress_v2');
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Clear saved progress */
function clearProgress() {
  localStorage.removeItem('chePartito_progress_v2');
  // Also clear old v1 progress
  localStorage.removeItem('chePartito_progress');
}

// ── Data Loading ──

async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    quizData = await response.json();
  } catch (err) {
    console.error('Failed to load data.json:', err);
    dom.loadingOverlay.innerHTML = `
      <p style="color: var(--accent-rose); text-align: center; padding: 24px;">
        Errore nel caricamento dei dati.<br>
        <small style="color: var(--text-tertiary);">Assicurati di servire l'app tramite un server locale (es. Live Server).</small>
      </p>
    `;
    return false;
  }
  return true;
}

// ── Build Questions Array ──

function buildQuestions() {
  questions = [];

  quizData.categories.forEach((cat, ci) => {
    cat.questions.forEach((q, qi) => {
      questions.push({
        categoryIndex: ci,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.color,
        questionIndex: qi,
        id: q.id,
        themeName: q.theme,
        text: q.text,
        scores: q.scores, // pre-assigned party scores
      });
    });
  });

  // Initialize answers array if not resuming
  if (answers.length !== questions.length) {
    answers = new Array(questions.length).fill(null);
  }
}

// ── Quiz Flow ──

function startQuiz(resumeFrom = null) {
  buildQuestions();

  if (resumeFrom) {
    answers = resumeFrom.answers;
    // Pad/trim answers if data changed
    while (answers.length < questions.length) answers.push(null);
    answers = answers.slice(0, questions.length);
    currentIndex = Math.min(resumeFrom.currentIndex, questions.length - 1);
  } else {
    answers = new Array(questions.length).fill(null);
    currentIndex = 0;
    clearProgress();
  }

  dom.quizTotalNum.textContent = questions.length;
  showScreen('screen-quiz');

  // Show category transition for first category
  if (!resumeFrom) {
    showCategoryTransition(0);
  } else {
    renderQuestion();
  }
}

function showCategoryTransition(categoryIndex) {
  const cat = quizData.categories[categoryIndex];
  if (!cat) return;

  dom.catTransIcon.textContent = cat.icon;
  dom.catTransIcon.style.background = cat.color;
  dom.catTransName.textContent = cat.name;
  dom.catTransInfo.textContent = `${cat.questions.length} domande`;

  // Build category progress dots
  dom.catTransDots.innerHTML = '';
  quizData.categories.forEach((c, i) => {
    const dot = document.createElement('div');
    dot.className = 'cat-dot';
    if (i < categoryIndex) dot.classList.add('completed');
    if (i === categoryIndex) dot.classList.add('current');
    dom.catTransDots.appendChild(dot);
  });

  dom.catTransition.classList.add('active');
}

function hideCategoryTransition() {
  dom.catTransition.classList.remove('active');
}

function renderQuestion() {
  if (currentIndex >= questions.length) {
    showResults();
    return;
  }

  const q = questions[currentIndex];

  // Update header
  dom.quizCategoryBadge.textContent = `${q.categoryIcon} ${q.categoryName}`;
  dom.quizCategoryBadge.style.background = q.categoryColor;
  dom.quizThemeName.textContent = q.themeName;

  // Update counter & progress
  dom.quizCurrentNum.textContent = currentIndex + 1;
  const progress = ((currentIndex) / questions.length) * 100;
  dom.progressFill.style.width = `${progress}%`;

  // Update statement text
  dom.quizStatementText.textContent = q.text;

  // Update rating buttons selection
  const selectedValue = answers[currentIndex];
  dom.ratingButtons.querySelectorAll('.rating-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.value) === selectedValue);
  });

  // Update navigation
  dom.btnPrev.disabled = currentIndex === 0;
  dom.btnQuizBack.disabled = currentIndex === 0;

  // Update next button text
  if (currentIndex === questions.length - 1) {
    dom.btnNext.textContent = 'Vedi Risultati →';
  } else {
    dom.btnNext.textContent = 'Successiva →';
  }
}

function goToQuestion(index, direction = 'forward') {
  if (index < 0 || index > questions.length || isTransitioning) return;

  if (index >= questions.length) {
    showResults();
    return;
  }

  // Check if we're entering a new category
  const prevCatIndex = currentIndex < questions.length ? questions[currentIndex].categoryIndex : -1;
  const nextCatIndex = questions[index].categoryIndex;

  isTransitioning = true;

  const animOut = direction === 'forward' ? 'slide-out-left' : 'slide-out-right';
  const animIn = direction === 'forward' ? 'slide-in-right' : 'slide-in-left';

  dom.quizStatement.classList.add(animOut);

  setTimeout(() => {
    currentIndex = index;

    if (direction === 'forward' && nextCatIndex !== prevCatIndex && nextCatIndex > 0) {
      // Show category transition
      dom.quizStatement.classList.remove(animOut);
      showCategoryTransition(nextCatIndex);
      saveProgress();
      isTransitioning = false;
      return;
    }

    renderQuestion();
    dom.quizStatement.classList.remove(animOut);
    dom.quizStatement.classList.add(animIn);

    setTimeout(() => {
      dom.quizStatement.classList.remove(animIn);
      isTransitioning = false;
    }, 300);
  }, 250);
}

function selectRating(value) {
  answers[currentIndex] = value;

  // Visual feedback
  dom.ratingButtons.querySelectorAll('.rating-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.value) === value);
  });

  // Auto-advance after brief delay
  saveProgress();

  setTimeout(() => {
    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1, 'forward');
    } else {
      // Last question — check if all answered
      if (answers.every(a => a !== null)) {
        showResults();
      }
    }
  }, 350);
}

// ── Scoring (Distance-based) ──

function calculateScores() {
  // For each party, calculate alignment on each question:
  // alignment = 7 - |user_answer - party_score|
  // Then average all alignments per party.

  const partyAlignments = {};
  quizData.parties.forEach(p => {
    partyAlignments[p] = { total: 0, count: 0 };
  });

  // Per-category per-party
  const categoryAlignments = {};
  quizData.categories.forEach(cat => {
    categoryAlignments[cat.name] = {};
    quizData.parties.forEach(p => {
      categoryAlignments[cat.name][p] = { total: 0, count: 0 };
    });
  });

  // Calculate alignments
  questions.forEach((q, i) => {
    const userAnswer = answers[i];
    if (userAnswer === null) return;

    quizData.parties.forEach(party => {
      const partyScore = q.scores[party];
      if (partyScore === undefined) return;

      // Alignment: 7 when perfect match, 1 when max distance (6)
      const distance = Math.abs(userAnswer - partyScore);
      const alignment = 7 - distance;

      partyAlignments[party].total += alignment;
      partyAlignments[party].count += 1;

      categoryAlignments[q.categoryName][party].total += alignment;
      categoryAlignments[q.categoryName][party].count += 1;
    });
  });

  // Calculate averages and sort
  const overallRanking = quizData.parties.map(p => ({
    party: p,
    avg: partyAlignments[p].count > 0
      ? partyAlignments[p].total / partyAlignments[p].count
      : 0,
    color: PARTY_COLORS[p] || '#6366f1',
  })).sort((a, b) => b.avg - a.avg);

  const categoryRankings = {};
  quizData.categories.forEach(cat => {
    categoryRankings[cat.name] = quizData.parties.map(p => ({
      party: p,
      avg: categoryAlignments[cat.name][p].count > 0
        ? categoryAlignments[cat.name][p].total / categoryAlignments[cat.name][p].count
        : 0,
      color: PARTY_COLORS[p] || '#6366f1',
    })).sort((a, b) => b.avg - a.avg);
  });

  return { overallRanking, categoryRankings };
}

// ── Results Rendering ──

function showResults() {
  clearProgress();

  // Set progress bar to 100%
  dom.progressFill.style.width = '100%';

  const { overallRanking, categoryRankings } = calculateScores();

  // Winner card
  const winner = overallRanking[0];
  dom.winnerName.textContent = winner.party;
  dom.winnerScore.textContent = winner.avg.toFixed(1);

  // Overall ranking list
  dom.overallRanking.innerHTML = '';
  overallRanking.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'ranking-item';
    el.style.animationDelay = `${i * 60}ms`;

    let posClass = '';
    let posContent = i + 1;
    if (i === 0) { posClass = 'ranking-item__position--1'; posContent = '🥇'; }
    else if (i === 1) { posClass = 'ranking-item__position--2'; posContent = '🥈'; }
    else if (i === 2) { posClass = 'ranking-item__position--3'; posContent = '🥉'; }

    const barWidth = (item.avg / 7 * 100).toFixed(1);

    el.innerHTML = `
      <div class="ranking-item__position ${posClass}">${posContent}</div>
      <div class="ranking-item__info">
        <div class="ranking-item__name">${item.party}</div>
        <div class="ranking-item__bar-container">
          <div class="ranking-item__bar" style="background: ${item.color};" data-width="${barWidth}%"></div>
        </div>
      </div>
      <div class="ranking-item__score">${item.avg.toFixed(1)}</div>
    `;

    dom.overallRanking.appendChild(el);
  });

  // Category breakdown
  dom.categoryBreakdown.innerHTML = '';
  quizData.categories.forEach((cat, catIdx) => {
    const ranking = categoryRankings[cat.name];

    const block = document.createElement('div');
    block.className = 'category-block';

    const listHTML = ranking.map((item, i) => {
      let posClass = '';
      if (i === 0) posClass = 'cat-rank-item__pos--1';
      else if (i === 1) posClass = 'cat-rank-item__pos--2';
      else if (i === 2) posClass = 'cat-rank-item__pos--3';

      const barWidth = (item.avg / 7 * 100).toFixed(1);

      return `
        <div class="cat-rank-item">
          <div class="cat-rank-item__pos ${posClass}">${i + 1}</div>
          <div class="cat-rank-item__name">${item.party}</div>
          <div class="cat-rank-item__bar-wrap">
            <div class="cat-rank-item__bar" style="background: ${item.color};" data-width="${barWidth}%"></div>
          </div>
          <div class="cat-rank-item__score">${item.avg.toFixed(1)}</div>
        </div>
      `;
    }).join('');

    block.innerHTML = `
      <div class="category-block__header" data-cat-idx="${catIdx}">
        <div class="category-block__icon" style="background: ${cat.color};">${cat.icon}</div>
        <div class="category-block__name">${cat.name}</div>
        <div class="category-block__chevron">▼</div>
      </div>
      <div class="category-block__content">
        <div class="category-block__list">${listHTML}</div>
      </div>
    `;

    dom.categoryBreakdown.appendChild(block);
  });

  // Show results screen
  showScreen('screen-results');

  // Animate bars after a brief delay
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('[data-width]').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    }, 200);
  });
}

// ── Event Handlers ──

function initEventHandlers() {
  // Start quiz
  dom.btnStart.addEventListener('click', () => {
    startQuiz();
  });

  // Continue quiz
  dom.btnContinue.addEventListener('click', () => {
    const saved = loadProgress();
    if (saved) {
      startQuiz(saved);
    }
  });

  // Category transition continue
  dom.btnCatContinue.addEventListener('click', () => {
    hideCategoryTransition();
    renderQuestion();
  });

  // Rating buttons
  dom.ratingButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.rating-btn');
    if (!btn || isTransitioning) return;
    const value = parseInt(btn.dataset.value);
    selectRating(value);
  });

  // Previous button
  dom.btnPrev.addEventListener('click', () => {
    if (currentIndex > 0) {
      goToQuestion(currentIndex - 1, 'backward');
    }
  });

  // Quiz back button (same as prev)
  dom.btnQuizBack.addEventListener('click', () => {
    if (currentIndex > 0) {
      goToQuestion(currentIndex - 1, 'backward');
    }
  });

  // Next button
  dom.btnNext.addEventListener('click', () => {
    if (answers[currentIndex] === null) {
      // Shake the rating buttons to prompt selection
      dom.ratingButtons.style.animation = 'none';
      dom.ratingButtons.offsetHeight; // force reflow
      dom.ratingButtons.style.animation = 'shake 0.4s ease';
      return;
    }

    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1, 'forward');
    } else if (answers.every(a => a !== null)) {
      showResults();
    }
  });

  // Restart
  dom.btnRestart.addEventListener('click', () => {
    clearProgress();
    showScreen('screen-landing');
    // Reset continue button visibility
    dom.btnContinue.classList.add('hidden');
  });

  // Category block toggles
  dom.categoryBreakdown.addEventListener('click', (e) => {
    const header = e.target.closest('.category-block__header');
    if (!header) return;
    const block = header.closest('.category-block');
    block.classList.toggle('open');
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (!dom.screenQuiz.classList.contains('active')) return;
    if (dom.catTransition.classList.contains('active')) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        hideCategoryTransition();
        renderQuestion();
      }
      return;
    }

    const num = parseInt(e.key);
    if (num >= 1 && num <= 7) {
      selectRating(num);
    } else if (e.key === 'ArrowLeft') {
      if (currentIndex > 0) goToQuestion(currentIndex - 1, 'backward');
    } else if (e.key === 'ArrowRight') {
      if (answers[currentIndex] !== null && currentIndex < questions.length - 1) {
        goToQuestion(currentIndex + 1, 'forward');
      }
    }
  });
}

// ── Initialization ──

async function init() {
  const loaded = await loadData();
  if (!loaded) return;

  // Hide loading
  dom.loadingOverlay.classList.add('fade-out');
  setTimeout(() => {
    dom.loadingOverlay.style.display = 'none';
  }, 400);

  // Check for saved progress
  const savedProgress = loadProgress();
  if (savedProgress) {
    dom.btnContinue.classList.remove('hidden');
  }

  // Show landing
  showScreen('screen-landing');

  // Init event handlers
  initEventHandlers();
}

// Add shake animation dynamically (for prompting rating selection)
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-6px); }
    80% { transform: translateX(6px); }
  }
`;
document.head.appendChild(shakeStyle);

// Launch
document.addEventListener('DOMContentLoaded', init);

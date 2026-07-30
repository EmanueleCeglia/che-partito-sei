/* ============================================
   CHE PARTITO SEI? — App Logic
   Quiz engine, scoring & results
   ============================================ */

// ── Category metadata ──
const CATEGORY_META = {
  'Economia, Fisco e Lavoro':       { icon: '💰', color: '#10b981' },
  'Welfare, Salute e Istruzione':   { icon: '🏥', color: '#f59e0b' },
  'Diritti Civili, Etica e Società': { icon: '⚖️', color: '#ec4899' },
  'Esteri':                          { icon: '🌍', color: '#3b82f6' },
  'Trans.Ecologica ed Energia':     { icon: '🌱', color: '#22c55e' },
  'Sicurezza':                       { icon: '🛡️', color: '#ef4444' },
  'Istituzioni, Democrazia e PA':   { icon: '🏛️', color: '#8b5cf6' },
};

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

/** Fisher-Yates shuffle (returns a new array) */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Show a screen by id */
function showScreen(screenId) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${screenId}`).classList.add('active');
}

/** Save progress to localStorage */
function saveProgress() {
  const data = {
    answers,
    currentIndex,
    timestamp: Date.now(),
    // Save the question order so resume uses same shuffle
    questionOrder: questions.map(q => `${q.categoryIndex}-${q.themeIndex}-${q.originalStatementIndex}`),
  };
  localStorage.setItem('chePartito_progress', JSON.stringify(data));
}

/** Load progress from localStorage */
function loadProgress() {
  try {
    const raw = localStorage.getItem('chePartito_progress');
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Only allow resume if less than 7 days old
    if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem('chePartito_progress');
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Clear saved progress */
function clearProgress() {
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

function buildQuestions(savedOrder = null) {
  questions = [];

  quizData.categories.forEach((cat, ci) => {
    cat.themes.forEach((theme, ti) => {
      let statementsWithIdx = theme.statements.map((s, si) => ({
        ...s,
        originalStatementIndex: si,
      }));

      if (savedOrder) {
        // Restore the exact order from saved progress
        const relevantOrder = savedOrder
          .filter(key => key.startsWith(`${ci}-${ti}-`))
          .map(key => parseInt(key.split('-')[2]));

        if (relevantOrder.length === statementsWithIdx.length) {
          statementsWithIdx = relevantOrder.map(idx =>
            statementsWithIdx.find(s => s.originalStatementIndex === idx)
          );
        } else {
          statementsWithIdx = shuffle(statementsWithIdx);
        }
      } else {
        // Shuffle statements within each theme for anonymity
        statementsWithIdx = shuffle(statementsWithIdx);
      }

      statementsWithIdx.forEach(stmt => {
        questions.push({
          categoryIndex: ci,
          categoryName: cat.name,
          themeIndex: ti,
          themeName: theme.name,
          party: stmt.party,
          text: stmt.text,
          originalStatementIndex: stmt.originalStatementIndex,
        });
      });
    });
  });

  // Initialize answers array
  if (!savedOrder) {
    answers = new Array(questions.length).fill(null);
  }
}

// ── Quiz Flow ──

function startQuiz(resumeFrom = null) {
  if (resumeFrom) {
    buildQuestions(resumeFrom.questionOrder);
    answers = resumeFrom.answers;
    // Pad answers if needed
    while (answers.length < questions.length) answers.push(null);
    currentIndex = resumeFrom.currentIndex;
  } else {
    buildQuestions();
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

  const meta = CATEGORY_META[cat.name] || { icon: '📌', color: '#6366f1' };
  const themeCount = cat.themes.length;
  const questionCount = themeCount * quizData.parties.length;

  dom.catTransIcon.textContent = meta.icon;
  dom.catTransIcon.style.background = meta.color;
  dom.catTransName.textContent = cat.name;
  dom.catTransInfo.textContent = `${themeCount} temi · ${questionCount} domande`;

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
  const meta = CATEGORY_META[q.categoryName] || { icon: '📌', color: '#6366f1' };

  // Update header
  dom.quizCategoryBadge.textContent = `${meta.icon} ${q.categoryName}`;
  dom.quizCategoryBadge.style.setProperty('--cat-color', meta.color);
  dom.quizCategoryBadge.style.background = meta.color;
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

// ── Scoring ──

function calculateScores() {
  // Overall per-party scores
  const partyScores = {};
  quizData.parties.forEach(p => {
    partyScores[p] = { total: 0, count: 0 };
  });

  // Per-category per-party scores
  const categoryScores = {};
  quizData.categories.forEach(cat => {
    categoryScores[cat.name] = {};
    quizData.parties.forEach(p => {
      categoryScores[cat.name][p] = { total: 0, count: 0 };
    });
  });

  // Aggregate scores
  questions.forEach((q, i) => {
    const score = answers[i];
    if (score === null) return;

    partyScores[q.party].total += score;
    partyScores[q.party].count += 1;

    categoryScores[q.categoryName][q.party].total += score;
    categoryScores[q.categoryName][q.party].count += 1;
  });

  // Calculate averages
  const overallRanking = quizData.parties.map(p => ({
    party: p,
    avg: partyScores[p].count > 0 ? partyScores[p].total / partyScores[p].count : 0,
    color: PARTY_COLORS[p] || '#6366f1',
  })).sort((a, b) => b.avg - a.avg);

  const categoryRankings = {};
  quizData.categories.forEach(cat => {
    categoryRankings[cat.name] = quizData.parties.map(p => ({
      party: p,
      avg: categoryScores[cat.name][p].count > 0
        ? categoryScores[cat.name][p].total / categoryScores[cat.name][p].count
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
    const meta = CATEGORY_META[cat.name] || { icon: '📌', color: '#6366f1' };
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
        <div class="category-block__icon" style="background: ${meta.color};">${meta.icon}</div>
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

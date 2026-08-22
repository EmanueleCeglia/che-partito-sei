/* ============================================
   CHE PARTITO SEI? — App Logic (v2 Optimized)
   Distance-based scoring with neutral questions
   ============================================ */

// ── Party colors ──
const PARTY_COLORS = {
  'AVS': '#E8452C',
  'M5S': '#F5C518',
  'PD': '#E2001A',
  '+Europa': '#0047AB',
  'Italia Viva': '#EB5D80',
  'Azione': '#1C4DA1',
  'Liberaldemocratico': '#7C3AED',
  'Forza Italia': '#0077CC',
  "Fratelli d'Italia": '#003D7A',
  'Lega': '#008C45',
  'Futuro Nazionale': '#64748b',
};

// ── State ──
const QUIZ_VERSION = 'v2.2'; // bump on every data/logic change: also busts caches

// ── Supabase ──
const SUPABASE_URL = 'https://cqeugyowkbaghccpgvna.supabase.co';
const SUPABASE_TABLE = 'quiz_responses';
// Safe to ship in a public repo: the anon key is meant to live in browsers. What
// guards the data are the RLS policies in supabase_schema.sql (insert, no read).
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZXVneW93a2JhZ2hjY3Bndm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMTQ2MTksImV4cCI6MjEwMjg5MDYxOX0.TDmCPDGf-aFa06QU6V7Dpd_a3MGMpGCFWDeC8SPsxa8';
const PENDING_KEY = 'chePartito_pending';

let quizData = null;       // raw JSON data
let questions = [];        // flat array of all questions in order
let answers = [];          // user answers (1-7), indexed same as questions
let currentIndex = 0;      // current question index
let isTransitioning = false;
let autoAdvanceTimer = null;
let pendingDemographics = null; // filled by the form, used after the ranking

// Self-ranking state
let rankPool = [];       // still to place
let rankOrder = [];      // placed, closest first
let rankUnknown = [];    // declared unknown
let rankPresented = [];  // the shuffled order actually shown, kept for the analysis
let rankStartedAt = 0;
let noticeTimer = null;

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
  quizNotice: $('#quiz-notice'),
  ratingButtons: $('#rating-buttons'),
  
  // Banner
  infoBanner: $('#info-banner'),
  btnBannerDismiss: $('#btn-banner-dismiss'),

  // Form Screen
  screenForm: $('#screen-form'),
  demographicForm: $('#demographic-form'),
  fieldEta: $('#field-eta'),
  fieldSesso: $('#field-sesso'),
  fieldRegione: $('#field-regione'),
  fieldProvincia: $('#field-provincia'),
  fieldComune: $('#field-comune'),
  filterRegione: $('#filter-regione'),
  filterProvincia: $('#filter-provincia'),
  filterComune: $('#filter-comune'),
  fieldIstruzione: $('#field-istruzione'),
  fieldOccupazione: $('#field-occupazione'),
  fieldReddito: $('#field-reddito'),
  fieldCittadinanza: $('#field-cittadinanza'),
  formError: $('#form-error'),

  // Self-ranking Screen
  screenRanking: $('#screen-ranking'),
  rankingOrder: $('#ranking-order'),
  rankingPool: $('#ranking-pool'),
  rankingPoolLabel: $('#ranking-pool-label'),
  rankingUnknown: $('#ranking-unknown'),
  rankingUnknownWrap: $('#ranking-unknown-wrap'),
  rankingHint: $('#ranking-hint'),
  rankingCount: $('#ranking-count'),
  rankingTotal: $('#ranking-total'),
  rankingProgressFill: $('#ranking-progress-fill'),
  rankingError: $('#ranking-error'),
  btnRankingSubmit: $('#btn-ranking-submit'),

  // Results Screen
  winnerName: $('#winner-name'),
  winnerScore: $('#winner-score'),
  overallRanking: $('#overall-ranking'),
  categoryBreakdown: $('#category-breakdown'),
};

// ── Comuni Data ──
let comuniData = null;

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
    const [quizRes, comuniRes] = await Promise.all([
      fetch(`data.json?v=${QUIZ_VERSION}`),
      fetch(`comuni.json?v=${QUIZ_VERSION}`)
    ]);
    
    if (!quizRes.ok) throw new Error(`HTTP ${quizRes.status} on data.json`);
    if (!comuniRes.ok) throw new Error(`HTTP ${comuniRes.status} on comuni.json`);
    
    quizData = await quizRes.json();
    comuniData = await comuniRes.json();
  } catch (err) {
    console.error('Failed to load data:', err);
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

  // Show banner the first time the user ever sees the quiz (resume included)
  if (!localStorage.getItem('chePartito_banner_seen')) {
    dom.infoBanner.classList.add('active');
  }

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

/** Flash a short message over the quiz */
function showQuizNotice(message) {
  dom.quizNotice.textContent = message;
  dom.quizNotice.classList.add('active');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => dom.quizNotice.classList.remove('active'), 2800);
}

/**
 * End of the quiz. A skipped question used to leave the last "Vedi Risultati"
 * doing nothing at all, so send the user back to the gap instead.
 */
function finishQuiz() {
  const missing = answers.findIndex(a => a === null);
  if (missing !== -1) {
    showQuizNotice(`Manca la risposta alla domanda ${missing + 1} di ${questions.length}`);
    goToQuestion(missing, missing < currentIndex ? 'backward' : 'forward');
    return;
  }
  showFormScreen();
}

function renderQuestion() {
  if (currentIndex >= questions.length) {
    finishQuiz();
    return;
  }

  const q = questions[currentIndex];

  // Update header
  dom.quizCategoryBadge.textContent = `${q.categoryIcon} ${q.categoryName}`;
  dom.quizCategoryBadge.style.background = q.categoryColor;
  dom.quizThemeName.textContent = q.themeName;

  // Update counter & progress
  dom.quizCurrentNum.textContent = currentIndex + 1;
  const answered = answers.filter(a => a !== null).length;
  const progress = (answered / questions.length) * 100;
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
    finishQuiz();
    return;
  }

  // A deliberate move cancels the auto-advance still pending from a rating
  clearTimeout(autoAdvanceTimer);

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
  // Mid-slide the index is about to change: the click would land on the wrong one
  if (isTransitioning) return;

  answers[currentIndex] = value;

  // Visual feedback
  dom.ratingButtons.querySelectorAll('.rating-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.value) === value);
  });

  // Auto-advance after brief delay
  saveProgress();

  clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = setTimeout(() => {
    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1, 'forward');
    } else {
      finishQuiz();
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

// ── Form Screen & Supabase Prep ──

function showFormScreen() {
  clearProgress();
  
  // Populate regions if not done yet
  if (dom.fieldRegione.options.length <= 1 && comuniData) {
    const regioni = Object.keys(comuniData).sort();
    regioni.forEach(reg => {
      const opt = document.createElement('option');
      opt.value = reg;
      opt.textContent = reg;
      dom.fieldRegione.appendChild(opt);
    });
  }

  showScreen('screen-form');
}

/** Fold case and strip accents, so a typed "forli" still matches "Forli" */
function normalizeForSearch(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Empty a search box and bring back every option it had hidden */
function clearSelectFilter(input, select) {
  input.value = '';
  input.classList.remove('no-results');
  [...select.options].forEach(opt => { opt.hidden = false; });
}

/** Let a search box narrow down the options of the select below it */
function attachSelectFilter(input, select) {
  // Enter inside a form submits it; here it should just do nothing
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });

  input.addEventListener('input', () => {
    const query = normalizeForSearch(input.value.trim());
    let visible = 0;

    [...select.options].forEach(opt => {
      if (!opt.value) return; // the "Seleziona..." placeholder always stays
      const match = !query || normalizeForSearch(opt.textContent).includes(query);
      opt.hidden = !match;
      if (match) visible++;
    });

    // Drop a choice the filter just hid, so it can't be submitted unseen
    const chosen = select.selectedOptions[0];
    if (chosen && chosen.hidden) {
      select.selectedIndex = 0;
      select.dispatchEvent(new Event('change'));
    }

    input.classList.toggle('no-results', visible === 0);
  });
}

/** Clear the demographic form so a replay starts from a blank sheet */
function resetDemographicForm() {
  dom.demographicForm.reset();
  dom.fieldProvincia.innerHTML = '<option value="" disabled selected>Prima seleziona la regione</option>';
  dom.fieldProvincia.disabled = true;
  dom.fieldComune.innerHTML = '<option value="" disabled selected>Prima seleziona la provincia</option>';
  dom.fieldComune.disabled = true;
  clearSelectFilter(dom.filterRegione, dom.fieldRegione);
  clearSelectFilter(dom.filterProvincia, dom.fieldProvincia);
  clearSelectFilter(dom.filterComune, dom.fieldComune);
  dom.filterProvincia.disabled = true;
  dom.filterComune.disabled = true;
  dom.formError.classList.add('hidden');
  dom.demographicForm.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

/** Shape a submission the way the quiz_responses table expects it */
function buildResponseRow(demographics, results, selfRanking) {
  return {
    quiz_version: QUIZ_VERSION,
    eta: demographics.eta,
    sesso: demographics.sesso,
    regione: demographics.regione,
    provincia: demographics.provincia,
    comune: demographics.comune,
    istruzione: demographics.istruzione,
    occupazione: demographics.occupazione,
    reddito: demographics.reddito,
    cittadinanza: demographics.cittadinanza,
    answers,
    results,
    self_ranking: selfRanking.order,
    self_ranking_unknown: selfRanking.unknown,
    self_ranking_presented: selfRanking.presented,
    self_ranking_ms: selfRanking.ms,
    client_timestamp: new Date().toISOString(),
  };
}

/** POST one row to Supabase; throws unless it was accepted */
async function postRow(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

/** Submissions that have not gone through yet, kept until they do */
function readPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePending(rows) {
  if (rows.length) localStorage.setItem(PENDING_KEY, JSON.stringify(rows));
  else localStorage.removeItem(PENDING_KEY);
}

/** Send one submission, parking it locally if network or Supabase fails */
async function sendResponse(row) {
  try {
    await postRow(row);
  } catch (err) {
    console.warn('Invio a Supabase fallito, riprovo al prossimo avvio:', err);
    const pending = readPending();
    pending.push(row);
    writePending(pending.slice(-20)); // bounded: never fill up localStorage
  }
}

/** Retry what is parked; whatever still fails stays queued for next time */
async function flushPending() {
  const pending = readPending();
  if (!pending.length) return;

  const stillPending = [];
  for (const row of pending) {
    try {
      await postRow(row);
    } catch {
      stillPending.push(row);
    }
  }
  writePending(stillPending);
}

// ── Self-ranking ──

/** Fisher-Yates: every presentation order has to be equally likely */
function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One party as a tappable chip; `variant` decides which actions it carries */
function buildPartyChip(party, variant, position) {
  const chip = document.createElement('li');
  chip.className = `party-chip party-chip--${variant}`;

  if (variant === 'ranked') {
    const rank = document.createElement('span');
    rank.className = 'party-chip__rank';
    rank.textContent = position;
    chip.appendChild(rank);
  }

  const dot = document.createElement('span');
  dot.className = 'party-chip__dot';
  dot.style.background = PARTY_COLORS[party] || 'var(--accent-indigo)';
  chip.appendChild(dot);

  const name = document.createElement('span');
  name.className = 'party-chip__name';
  name.textContent = party;   // textContent, so apostrophes need no escaping
  chip.appendChild(name);

  if (variant === 'pool') {
    // The whole chip picks the party; the small button parks it as unknown
    chip.classList.add('party-chip--tappable');
    chip.dataset.pick = party;
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');

    const unknown = document.createElement('button');
    unknown.type = 'button';
    unknown.className = 'party-chip__action';
    unknown.dataset.unknown = party;
    unknown.textContent = 'non lo conosco';
    chip.appendChild(unknown);
  } else {
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'party-chip__action';
    undo.dataset.undo = party;
    undo.setAttribute('aria-label', `Rimetti ${party} tra i partiti da collocare`);
    undo.textContent = 'annulla';
    chip.appendChild(undo);
  }

  return chip;
}

function renderRanking() {
  const total = rankPresented.length;
  const placed = rankOrder.length + rankUnknown.length;

  dom.rankingOrder.innerHTML = '';
  rankOrder.forEach((party, i) => {
    dom.rankingOrder.appendChild(buildPartyChip(party, 'ranked', i + 1));
  });

  dom.rankingPool.innerHTML = '';
  rankPool.forEach(party => {
    dom.rankingPool.appendChild(buildPartyChip(party, 'pool'));
  });

  dom.rankingUnknown.innerHTML = '';
  rankUnknown.forEach(party => {
    dom.rankingUnknown.appendChild(buildPartyChip(party, 'unknown'));
  });

  dom.rankingUnknownWrap.classList.toggle('hidden', rankUnknown.length === 0);
  dom.rankingPoolLabel.classList.toggle('hidden', rankPool.length === 0);
  dom.rankingHint.classList.toggle('hidden', rankOrder.length > 0);

  dom.rankingCount.textContent = placed;
  dom.rankingProgressFill.style.width = `${(placed / total) * 100}%`;

  // Every party has to be either ranked or declared unknown, and a ranking made
  // only of "non lo conosco" would carry no information at all
  dom.btnRankingSubmit.disabled = rankPool.length > 0 || rankOrder.length === 0;
  if (!dom.btnRankingSubmit.disabled) dom.rankingError.classList.add('hidden');
}

/** Put a party back among the ones to place, in the order it was shown in */
function returnToPool(party) {
  rankOrder = rankOrder.filter(p => p !== party);
  rankUnknown = rankUnknown.filter(p => p !== party);
  rankPool.push(party);
  rankPool.sort((a, b) => rankPresented.indexOf(a) - rankPresented.indexOf(b));
  renderRanking();
}

function showRankingScreen() {
  // Reshuffled per visit: the order shown must not favour any party, and it is
  // saved with the answer so the effect can be checked in the analysis
  rankPresented = shuffle(quizData.parties);
  rankPool = [...rankPresented];
  rankOrder = [];
  rankUnknown = [];
  rankStartedAt = Date.now();

  dom.rankingTotal.textContent = rankPresented.length;
  dom.rankingError.classList.add('hidden');
  renderRanking();
  showScreen('screen-ranking');
}

function handleRankingSubmit() {
  if (rankPool.length > 0) {
    dom.rankingError.textContent = 'Colloca tutti i partiti: ordina quelli che conosci e segna gli altri come "non lo conosco".';
    dom.rankingError.classList.remove('hidden');
    return;
  }
  if (rankOrder.length === 0) {
    dom.rankingError.textContent = 'Ordina almeno un partito prima di continuare.';
    dom.rankingError.classList.remove('hidden');
    return;
  }

  const selfRanking = {
    order: [...rankOrder],         // closest first
    unknown: [...rankUnknown],
    presented: [...rankPresented], // to control for presentation-order effects
    ms: Date.now() - rankStartedAt // a few seconds for 11 parties means noise
  };

  finishSubmission(pendingDemographics, selfRanking);
}

function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!dom.demographicForm.checkValidity()) {
    dom.formError.classList.remove('hidden');
    // Add invalid class to inputs that are empty
    dom.demographicForm.querySelectorAll('input, select').forEach(el => {
      if (!el.validity.valid) el.classList.add('invalid');
      else el.classList.remove('invalid');
    });
    return;
  }

  dom.formError.classList.add('hidden');

  // Collect data
  const demographics = {
    eta: parseInt(dom.fieldEta.value, 10),
    sesso: dom.fieldSesso.value,
    regione: dom.fieldRegione.value,
    provincia: dom.fieldProvincia.value,
    comune: dom.fieldComune.value,
    istruzione: dom.fieldIstruzione.value,
    occupazione: dom.fieldOccupazione.value,
    reddito: dom.fieldReddito.value,
    cittadinanza: dom.fieldCittadinanza.value === 'si'
  };

  // The self-ranking comes next, and it has to be asked before the results are
  // shown: afterwards it would measure what the quiz said, not what the user thinks
  pendingDemographics = demographics;
  showRankingScreen();
}

/** Last step: score, show, and ship the whole submission */
function finishSubmission(demographics, selfRanking) {
  const { overallRanking, categoryRankings } = calculateScores();

  const fullData = {
    demographics,
    answers,
    selfRanking,
    results: {
      winner: overallRanking[0].party,
      ranking: overallRanking.map(r => ({ party: r.party, score: parseFloat(r.avg.toFixed(1)) }))
    },
    timestamp: new Date().toISOString(),
    quizVersion: QUIZ_VERSION
  };

  // Keep the last submission at hand for debugging
  localStorage.setItem('chePartito_lastSubmission', JSON.stringify(fullData));

  // Results first: the upload must never keep the user waiting, and a failed
  // one is queued rather than lost
  showResults(overallRanking, categoryRankings);
  sendResponse(buildResponseRow(demographics, fullData.results, selfRanking));
}

// ── Results Rendering ──

function showResults(overallRanking, categoryRankings) {
  // Set progress bar to 100%
  dom.progressFill.style.width = '100%';

  // If we came directly here (e.g. testing), calculate scores if missing
  if (!overallRanking || !categoryRankings) {
    const scores = calculateScores();
    overallRanking = scores.overallRanking;
    categoryRankings = scores.categoryRankings;
  }

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
    } else {
      finishQuiz();
    }
  });

  // Banner dismiss
  dom.btnBannerDismiss.addEventListener('click', () => {
    dom.infoBanner.classList.remove('active');
    localStorage.setItem('chePartito_banner_seen', 'true');
  });

  // Search boxes over the residence selects
  attachSelectFilter(dom.filterRegione, dom.fieldRegione);
  attachSelectFilter(dom.filterProvincia, dom.fieldProvincia);
  attachSelectFilter(dom.filterComune, dom.fieldComune);

  // Form cascading selects
  dom.fieldRegione.addEventListener('change', () => {
    const reg = dom.fieldRegione.value;
    dom.fieldProvincia.innerHTML = '<option value="" disabled selected>Seleziona provincia...</option>';
    dom.fieldComune.innerHTML = '<option value="" disabled selected>Prima seleziona la provincia</option>';
    dom.fieldComune.disabled = true;
    clearSelectFilter(dom.filterProvincia, dom.fieldProvincia);
    clearSelectFilter(dom.filterComune, dom.fieldComune);
    // Locked again until a region is picked; the branch below reopens them
    dom.fieldProvincia.disabled = true;
    dom.filterProvincia.disabled = true;
    dom.filterComune.disabled = true;

    if (reg && comuniData[reg]) {
      const province = Object.keys(comuniData[reg]).sort();
      province.forEach(prov => {
        const opt = document.createElement('option');
        opt.value = prov;
        opt.textContent = prov;
        dom.fieldProvincia.appendChild(opt);
      });
      dom.fieldProvincia.disabled = false;
      dom.filterProvincia.disabled = false;
    }
    dom.fieldRegione.classList.remove('invalid');
  });

  dom.fieldProvincia.addEventListener('change', () => {
    const reg = dom.fieldRegione.value;
    const prov = dom.fieldProvincia.value;
    dom.fieldComune.innerHTML = '<option value="" disabled selected>Seleziona comune...</option>';
    clearSelectFilter(dom.filterComune, dom.fieldComune);
    dom.fieldComune.disabled = true;
    dom.filterComune.disabled = true;

    if (reg && prov && comuniData[reg][prov]) {
      const comuni = comuniData[reg][prov].sort();
      comuni.forEach(com => {
        const opt = document.createElement('option');
        opt.value = com;
        opt.textContent = com;
        dom.fieldComune.appendChild(opt);
      });
      dom.fieldComune.disabled = false;
      dom.filterComune.disabled = false;
    }
    dom.fieldProvincia.classList.remove('invalid');
  });

  // Remove invalid class on input for other form fields
  dom.demographicForm.addEventListener('input', (e) => {
    if (e.target.validity.valid) {
      e.target.classList.remove('invalid');
    }
  });

  // Form submit
  dom.demographicForm.addEventListener('submit', handleFormSubmit);

  // Self-ranking: one delegated handler for pick / unknown / undo
  dom.screenRanking.addEventListener('click', (e) => {
    const undo = e.target.closest('[data-undo]');
    if (undo) return returnToPool(undo.dataset.undo);

    const unknown = e.target.closest('[data-unknown]');
    if (unknown) {
      rankPool = rankPool.filter(p => p !== unknown.dataset.unknown);
      rankUnknown.push(unknown.dataset.unknown);
      return renderRanking();
    }

    const pick = e.target.closest('[data-pick]');
    if (pick) {
      rankPool = rankPool.filter(p => p !== pick.dataset.pick);
      rankOrder.push(pick.dataset.pick);
      renderRanking();
    }
  });

  // Same, from the keyboard
  dom.screenRanking.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pick = e.target.closest('[data-pick]');
    if (!pick) return;
    e.preventDefault();
    rankPool = rankPool.filter(p => p !== pick.dataset.pick);
    rankOrder.push(pick.dataset.pick);
    renderRanking();
  });

  dom.btnRankingSubmit.addEventListener('click', handleRankingSubmit);

  // Restart
  dom.btnRestart.addEventListener('click', () => {
    clearProgress();
    resetDemographicForm();
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
    // Banner overlays everything: swallow keys while it is up
    if (dom.infoBanner.classList.contains('active')) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dom.btnBannerDismiss.click();
      }
      return;
    }
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

  // Deliver anything an earlier session could not send
  flushPending();
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

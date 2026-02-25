const DATA_URL = './data/oxford-5000-words.json';
const LEVELS = ['B2', 'C1'];
const QUESTIONS_PER_ROUND = 10;

// DOM
const wordDisplay = document.getElementById('word-display');
const definitionDisplay = document.getElementById('definition-display');
const optionsContainer = document.getElementById('options');
const feedbackEl = document.getElementById('feedback');
const levelPill = document.getElementById('level-pill');
const posPill = document.getElementById('pos-pill');
const scoreEl = document.getElementById('score');
const nextBtn = document.getElementById('next-btn');
const skipBtn = document.getElementById('skip-btn');
const toastEl = document.getElementById('toast');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const streakDisplay = document.getElementById('streak-display');
const streakCountEl = document.getElementById('streak-count');
const cardEl = document.getElementById('card');
const gameoverEl = document.getElementById('gameover');
const gameoverScoreEl = document.getElementById('gameover-score');
const gameoverAccuracyEl = document.getElementById('gameover-accuracy');
const gameoverStreakEl = document.getElementById('gameover-streak');
const gameoverStarsEl = document.getElementById('gameover-stars');
const playAgainBtn = document.getElementById('play-again-btn');

// State
let words = [];
let currentQuestion = null;
let score = 0;
let roundAsked = 0;
let streak = 0;
let bestStreak = 0;
let lockOptions = false;

// ─── Utilities ──────────────────────────────────────────────────────────────

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function haptic(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('toast--visible');
  window.setTimeout(() => toastEl.classList.remove('toast--visible'), 1800);
}

// ─── State updaters ──────────────────────────────────────────────────────────

function updateProgress() {
  const pct = (roundAsked / QUESTIONS_PER_ROUND) * 100;
  progressFill.style.width = `${pct}%`;
  progressLabel.textContent = `${roundAsked} / ${QUESTIONS_PER_ROUND}`;
}

function updateScore() {
  scoreEl.textContent = `${score} / ${roundAsked}`;
}

function updateStreak() {
  if (streak >= 2) {
    streakCountEl.textContent = streak;
    streakDisplay.hidden = false;
    streakDisplay.classList.toggle('streak--mega', streak >= 5);
    // Re-trigger bump animation
    streakDisplay.classList.remove('streak--bump');
    void streakDisplay.offsetWidth;
    streakDisplay.classList.add('streak--bump');
    streakDisplay.addEventListener('animationend', () => {
      streakDisplay.classList.remove('streak--bump');
    }, { once: true });
  } else {
    streakDisplay.hidden = true;
  }
}

function setNextBtn(label, disabled) {
  nextBtn.textContent = label;
  nextBtn.disabled = disabled;
  nextBtn.classList.toggle('button--disabled', disabled);
}

function clearFeedback() {
  feedbackEl.textContent = '';
  feedbackEl.className = 'card__feedback';
}

// ─── Question logic ──────────────────────────────────────────────────────────

function pickQuestion() {
  const base = words[Math.floor(Math.random() * words.length)];
  const others = shuffle(words.filter((w) => w.word !== base.word)).slice(0, 3);
  const all = shuffle([base, ...others]);
  return {
    word: base.word,
    definition: base.definition,
    level: base.level,
    pos: base.pos || '',
    options: all.map((w) => w.thai),
    correctIndex: all.findIndex((w) => w.word === base.word),
  };
}

function animateCardIn() {
  cardEl.classList.remove('card--enter');
  void cardEl.offsetWidth;
  cardEl.classList.add('card--enter');
}

function renderQuestion() {
  if (!words.length) return;
  currentQuestion = pickQuestion();
  lockOptions = false;

  wordDisplay.textContent = currentQuestion.word;
  definitionDisplay.textContent = currentQuestion.definition || '';
  levelPill.textContent = currentQuestion.level;

  if (currentQuestion.pos) {
    posPill.textContent = currentQuestion.pos;
    posPill.hidden = false;
  } else {
    posPill.hidden = true;
  }

  clearFeedback();
  optionsContainer.innerHTML = '';

  currentQuestion.options.forEach((text, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.dataset.index = String(index);

    const idxSpan = document.createElement('span');
    idxSpan.className = 'option__index';
    idxSpan.textContent = String(index + 1);

    const txtSpan = document.createElement('span');
    txtSpan.className = 'option__text';
    txtSpan.textContent = text;

    btn.append(idxSpan, txtSpan);
    btn.addEventListener('click', () => handleAnswer(index, btn));
    optionsContainer.appendChild(btn);
  });

  setNextBtn('Next →', true);
  animateCardIn();
}

// ─── Answer handling ─────────────────────────────────────────────────────────

function handleAnswer(selectedIndex, selectedButton) {
  if (lockOptions || !currentQuestion) return;
  lockOptions = true;

  const allBtns = [...optionsContainer.querySelectorAll('.option')];
  allBtns.forEach((btn, i) => {
    btn.classList.add('option--disabled');
    if (i === currentQuestion.correctIndex) btn.classList.add('option--correct');
  });

  roundAsked++;
  updateProgress();

  if (selectedIndex === currentQuestion.correctIndex) {
    score++;
    streak++;
    if (streak > bestStreak) bestStreak = streak;
    updateStreak();
    updateScore();
    feedbackEl.className = 'card__feedback card__feedback--correct';
    feedbackEl.textContent =
      streak >= 3 ? `🔥 Correct! ${streak} in a row!` : '✅ Correct!';
    haptic(40);
    if (streak >= 5) showToast(`On fire! 🔥 ${streak} in a row!`);
  } else {
    streak = 0;
    updateStreak();
    updateScore();
    selectedButton.classList.add('option--wrong', 'option--shake');
    selectedButton.addEventListener('animationend', () => {
      selectedButton.classList.remove('option--shake');
    }, { once: true });
    feedbackEl.className = 'card__feedback card__feedback--wrong';
    feedbackEl.textContent = `❌ Answer: ${currentQuestion.options[currentQuestion.correctIndex]}`;
    haptic([30, 30, 60]);
  }

  const isLast = roundAsked >= QUESTIONS_PER_ROUND;
  setNextBtn(isLast ? '🏆 See Results' : 'Next →', false);
}

// ─── Game over ────────────────────────────────────────────────────────────────

function getStars(pct) {
  if (pct >= 90) return '⭐⭐⭐';
  if (pct >= 70) return '⭐⭐☆';
  if (pct >= 40) return '⭐☆☆';
  return '☆☆☆';
}

function showGameOver() {
  const pct = Math.round((score / QUESTIONS_PER_ROUND) * 100);
  gameoverStarsEl.textContent = getStars(pct);
  gameoverScoreEl.textContent = `${score} / ${QUESTIONS_PER_ROUND}`;
  gameoverAccuracyEl.textContent = `${pct}% accurate`;
  gameoverStreakEl.textContent = `Best streak 🔥 ${bestStreak}`;
  gameoverEl.hidden = false;
  void gameoverEl.offsetWidth;
  gameoverEl.classList.add('gameover--visible');
  haptic([50, 30, 50, 30, 100]);
}

function startNewRound() {
  score = 0;
  roundAsked = 0;
  streak = 0;
  bestStreak = 0;
  lockOptions = false;
  gameoverEl.classList.remove('gameover--visible');
  gameoverEl.hidden = true;
  streakDisplay.hidden = true;
  updateProgress();
  updateScore();
  renderQuestion();
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function setupControls() {
  nextBtn.addEventListener('click', () => {
    if (roundAsked >= QUESTIONS_PER_ROUND && lockOptions) {
      showGameOver();
    } else {
      renderQuestion();
    }
  });

  skipBtn.addEventListener('click', () => {
    if (roundAsked >= QUESTIONS_PER_ROUND) return;
    streak = 0;
    updateStreak();
    renderQuestion();
    showToast('Skipped');
  });

  playAgainBtn.addEventListener('click', startNewRound);
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (!gameoverEl.hidden) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startNewRound(); }
      return;
    }
    if (['1', '2', '3', '4'].includes(e.key)) {
      const btns = optionsContainer.querySelectorAll('.option:not(.option--disabled)');
      const idx = parseInt(e.key, 10) - 1;
      if (btns[idx]) btns[idx].click();
    }
    if ((e.key === 'Enter' || e.key === ' ') && !nextBtn.disabled) {
      e.preventDefault();
      nextBtn.click();
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function loadWords() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = await res.json();
    words = all.filter((w) => LEVELS.includes(w.level));
    if (!words.length) {
      wordDisplay.textContent = 'No words loaded';
      return;
    }
    showToast(`${words.length} words loaded 🎯`);
    renderQuestion();
  } catch (err) {
    console.error(err);
    wordDisplay.textContent = 'Error loading data';
    definitionDisplay.textContent = 'Check console for details.';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  updateProgress();
  updateScore();
  setupControls();
  setupKeyboard();
  loadWords();
});

const DATA_URL = './data/oxford-b1-c1-sample.json';
const LEVELS = ['B1', 'B2', 'C1'];

// DOM
const wordDisplay = document.getElementById('word-display');
const definitionDisplay = document.getElementById('definition-display');
const optionsContainer = document.getElementById('options');
const levelPill = document.getElementById('level-pill');
const posPill = document.getElementById('pos-pill');
const scoreEl = document.getElementById('score');
const skipBtn = document.getElementById('skip-btn');
const toastEl = document.getElementById('toast');
const streakDisplay = document.getElementById('streak-display');
const streakCountEl = document.getElementById('streak-count');
const cardEl = document.getElementById('card');

const resultModal = document.getElementById('result-modal');
const resultModalTitle = document.getElementById('result-modal-title');
const resultModalWord = document.getElementById('result-modal-word');
const resultModalMeaning = document.getElementById('result-modal-meaning');
const resultModalDefinition = document.getElementById('result-modal-definition');
const resultModalNextBtn = document.getElementById('result-modal-next');

// State
let words = [];
let wordDeck = [];      // shuffled queue: ใช้จับทีละคำ ไม่ซ้ำจนครบ deck
let deckIndex = 0;
let currentQuestion = null;
let score = 0;
let totalAnswered = 0;
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

function updateScore() {
  scoreEl.textContent = `${score} / ${totalAnswered}`;
}

function updateStreak() {
  if (streak >= 2) {
    streakCountEl.textContent = streak;
    streakDisplay.hidden = false;
    streakDisplay.classList.toggle('streak--mega', streak >= 5);
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

function showResultModal(isCorrect, word, correctMeaning, definition) {
  resultModalTitle.textContent = isCorrect ? '✅ ถูกต้อง' : '❌ ยังไม่ถูก';
  resultModalTitle.className = 'result-modal__title ' +
    (isCorrect ? 'result-modal__title--correct' : 'result-modal__title--wrong');
  resultModalWord.textContent = word;
  resultModalMeaning.textContent = correctMeaning;
  resultModalDefinition.textContent = definition || '';
  resultModalDefinition.style.display = definition ? 'block' : 'none';

  resultModal.hidden = false;
  resultModal.setAttribute('data-visible', 'true');
  resultModalNextBtn.focus();
}

function hideResultModal() {
  resultModal.setAttribute('data-visible', 'false');
  resultModal.hidden = true;
}

// ─── Question logic ──────────────────────────────────────────────────────────

// สร้าง deck ใหม่จาก words (สับทั้งลิสต์) ใช้จับทีละคำจนครบแล้วค่อยสับใหม่
function refillDeck() {
  wordDeck = shuffle([...words]);
  deckIndex = 0;
}

// เลือกคำหลักจาก deck (ลำดับสุ่มทั้งชุด ไม่วนแค่ช่วง A–E)
function drawBaseFromDeck() {
  if (deckIndex >= wordDeck.length || wordDeck.length === 0) refillDeck();
  if (wordDeck.length === 0) return null;
  return wordDeck[deckIndex++];
}

// เลือกตัวเลือกผิด 3 คำ จากคนละช่วงของลิสต์ (ต้น-กลาง-ท้าย) ให้กระจาย
function pickDistractors(baseWord, count = 3) {
  const rest = words.filter((w) => w.word !== baseWord);
  if (rest.length <= count) return shuffle(rest);
  const n = rest.length;
  const t = Math.max(1, Math.floor(n / 3));
  const segments = [[0, t], [t, t * 2], [t * 2, n]];
  const picked = [];
  const usedIndex = new Set();
  for (let s = 0; s < segments.length && picked.length < count; s++) {
    const [start, end] = segments[s];
    const len = end - start;
    if (len <= 0) continue;
    let idx = start + Math.floor(Math.random() * len);
    let tries = 0;
    while (usedIndex.has(idx) && tries < len * 2) {
      idx = start + Math.floor(Math.random() * len);
      tries++;
    }
    if (!usedIndex.has(idx)) {
      usedIndex.add(idx);
      picked.push(rest[idx]);
    }
  }
  while (picked.length < count) {
    const idx = Math.floor(Math.random() * n);
    if (!usedIndex.has(idx)) {
      usedIndex.add(idx);
      picked.push(rest[idx]);
    }
  }
  return shuffle(picked).slice(0, count);
}

function pickQuestion() {
  const base = drawBaseFromDeck();
  if (!base) return null;
  const others = pickDistractors(base.word, 3);
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
  if (!currentQuestion) return;
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

  totalAnswered++;
  const correctMeaning = currentQuestion.options[currentQuestion.correctIndex];
  const isCorrect = selectedIndex === currentQuestion.correctIndex;

  if (isCorrect) {
    score++;
    streak++;
    if (streak > bestStreak) bestStreak = streak;
    haptic(40);
    if (streak >= 5) showToast(`🔥 ${streak} คำติด!`);
  } else {
    streak = 0;
    selectedButton.classList.add('option--wrong', 'option--shake');
    selectedButton.addEventListener('animationend', () => {
      selectedButton.classList.remove('option--shake');
    }, { once: true });
    haptic([30, 30, 60]);
  }

  updateStreak();
  updateScore();

  showResultModal(
    isCorrect,
    currentQuestion.word,
    correctMeaning,
    currentQuestion.definition
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function setupControls() {
  resultModalNextBtn.addEventListener('click', () => {
    hideResultModal();
    renderQuestion();
  });

  resultModal.querySelector('.result-modal__backdrop').addEventListener('click', () => {
    hideResultModal();
    renderQuestion();
  });

  skipBtn.addEventListener('click', () => {
    streak = 0;
    updateStreak();
    renderQuestion();
    showToast('ข้ามแล้ว');
  });
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (resultModal.getAttribute('data-visible') === 'true') {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        hideResultModal();
        renderQuestion();
      }
      return;
    }
    if (['1', '2', '3', '4'].includes(e.key)) {
      const btns = optionsContainer.querySelectorAll('.option:not(.option--disabled)');
      const idx = parseInt(e.key, 10) - 1;
      if (btns[idx]) btns[idx].click();
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
    refillDeck();
    showToast(`โหลด ${words.length} คำ โหมดสุ่มทั้งชุด 🎯`);
    renderQuestion();
  } catch (err) {
    console.error(err);
    wordDisplay.textContent = 'Error loading data';
    definitionDisplay.textContent = 'Check console for details.';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  updateScore();
  setupControls();
  setupKeyboard();
  loadWords();
});

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
let wordsByLetter = {};  // { a: [word,...], b: [...], ... } ใช้ตัวอักษรเป็นหลัก
let letters = [];        // ['a','b',...,'z'] ที่มีคำอยู่
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

// สร้าง index แยกคำตามตัวอักษรตัวแรก (a–z)
function buildLetterIndex(wordList) {
  const index = {};
  for (const w of wordList) {
    const first = (w.word && w.word.trim()[0] || '').toLowerCase();
    if (first >= 'a' && first <= 'z') {
      if (!index[first]) index[first] = [];
      index[first].push(w);
    }
  }
  return index;
}

// สุ่มคำโดย: 1) สุ่มตัวอักษรก่อน 2) ค่อยสุ่มคำที่ขึ้นต้นด้วยตัวนั้น → กระจายทั้ง A–Z
function pickQuestion() {
  if (letters.length === 0) return null;

  const letter = letters[Math.floor(Math.random() * letters.length)];
  const bucket = wordsByLetter[letter];
  if (!bucket || bucket.length === 0) return null;

  const base = bucket[Math.floor(Math.random() * bucket.length)];

  const otherLetters = letters.filter((l) => l !== letter);
  const usedWords = new Set([base.word]);
  const distractors = [];

  const shuffledLetters = shuffle([...otherLetters]);
  for (const L of shuffledLetters) {
    if (distractors.length >= 3) break;
    const b = wordsByLetter[L];
    if (!b || b.length === 0) continue;
    const candidates = b.filter((w) => !usedWords.has(w.word));
    if (candidates.length === 0) continue;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    distractors.push(pick);
    usedWords.add(pick.word);
  }

  while (distractors.length < 3) {
    const w = words[Math.floor(Math.random() * words.length)];
    if (!usedWords.has(w.word)) {
      distractors.push(w);
      usedWords.add(w.word);
    }
  }

  const all = shuffle([base, ...distractors]);
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
    wordsByLetter = buildLetterIndex(words);
    letters = Object.keys(wordsByLetter).filter((l) => wordsByLetter[l].length > 0).sort();
    showToast(`โหลด ${words.length} คำ (${letters.length} ตัวอักษร) สุ่มตาม A–Z 🎯`);
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

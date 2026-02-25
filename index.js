#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_PATH = path.join(__dirname, 'data', 'oxford-5000-words.json');
const LEVELS = ['B2', 'C1'];
const QUESTIONS_PER_GAME = 10;

function loadWords() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const words = JSON.parse(raw);
  return words.filter((w) => LEVELS.includes(w.level));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pickQuestion(words) {
  const base = words[Math.floor(Math.random() * words.length)];

  const distractors = shuffle(
    words.filter((w) => w.word !== base.word)
  ).slice(0, 3);

  const options = shuffle([base, ...distractors]);

  const correctIndex = options.findIndex((opt) => opt.word === base.word);

  return {
    questionWord: base.word,
    optionsThai: options.map((opt) => opt.thai),
    correctIndex,
    definition: base.definition,
    level: base.level,
  };
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function runGame() {
  const words = loadWords();
  if (!words.length) {
    console.log('No words found in data file. Please add some entries first.');
    return;
  }

  const rl = createInterface();

  console.log('===========================================');
  console.log('   Oxford 5000 B1–C1 Flashcard (CLI)   ');
  console.log('===========================================');
  console.log('โหมด: อังกฤษ → ไทย (multiple choice)');
  console.log('พิมพ์หมายเลขคำตอบ หรือพิมพ์ q เพื่อออกจากเกม\n');

  let score = 0;
  let asked = 0;

  while (asked < QUESTIONS_PER_GAME) {
    const { questionWord, optionsThai, correctIndex, definition, level } =
      pickQuestion(words);

    console.log(`คำถามที่ ${asked + 1}/${QUESTIONS_PER_GAME}`);
    console.log(`คำศัพท์: ${questionWord} (ระดับ ${level})`);
    console.log('');

    optionsThai.forEach((opt, idx) => {
      console.log(`  ${idx + 1}. ${opt}`);
    });

    const answer = await askQuestion(
      rl,
      '\nคำตอบของคุณ (1-4 หรือ q เพื่อออก): '
    );

    if (answer.toLowerCase() === 'q') {
      console.log('\nออกจากเกมแล้ว ขอบคุณที่เล่นครับ 🙌');
      break;
    }

    const choiceIndex = Number.parseInt(answer, 10) - 1;

    if (
      Number.isNaN(choiceIndex) ||
      choiceIndex < 0 ||
      choiceIndex >= optionsThai.length
    ) {
      console.log('กรุณากรอกหมายเลข 1-4 หรือ q เพื่ิอออก\n');
      // ไม่เพิ่ม asked เพื่อให้คำถามเดิมเล่นใหม่
      continue;
    }

    asked += 1;

    if (choiceIndex === correctIndex) {
      score += 1;
      console.log('✅ ถูกต้อง! เก่งมาก\n');
    } else {
      console.log('❌ ยังไม่ถูกนะ');
      console.log(
        `คำตอบที่ถูกคือ: ${questionWord} → ${optionsThai[correctIndex]}`
      );
      if (definition) {
        console.log(`ความหมายอังกฤษ: ${definition}`);
      }
      console.log('');
    }
  }

  rl.close();

  if (asked > 0) {
    console.log('======================');
    console.log('   สรุปผลการเล่น   ');
    console.log('======================');
    console.log(`ตอบถูก: ${score} / ${asked}`);
    const percent = Math.round((score / asked) * 100);
    console.log(`คิดเป็น: ${percent}%`);

    if (percent >= 80) {
      console.log('สุดยอด! ระดับ B1–C1 ของคุณโหดมาก 🔥');
    } else if (percent >= 50) {
      console.log('ดีเลย! ฝึกอีกนิดเดียวก็เทพแล้ว 💪');
    } else {
      console.log('ยังไม่เป็นไร ลองเล่นซ้ำบ่อยๆ เดี๋ยวก็เก่งเอง 😄');
    }
  }
}

runGame().catch((err) => {
  console.error('เกิดข้อผิดพลาดในเกม:', err);
});


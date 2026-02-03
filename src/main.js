import "./style.css";
import * as PIXI from "pixi.js";
import { parseABC } from "./parser";

// --- CONFIGURATION ---
const WIDTH = 1000;
const HEIGHT = 600;
const NOTE_SPEED = 4; // Pixels per frame
const KEY_HEIGHT = 150;
const BPM = 100; // Speed of the song

// --- ABC MELODY DEFINITION ---
// Notation: C,D,E = Octave 4 | c,d,e = Octave 5 | ^ = Sharp | Number = Duration multiplier

// 1. Define the fallback melody ("Ode to Joy")
const DEFAULT_MELODY = `
  E E F G | G F E D | C C D E | E3/2 D/2 D2 |
  E E F G | G F E D | C C D E | D3/2 C/2 C2 |
  D D E C | D E/2 F/2 E C | D E/2 F/2 E D | C D G,2 |
  E E F G | G F E D | C C D E | D3/2 C/2 C2
`;

// 2. Logic to grab melody from URL Parameter (?abc=...)
const getMelody = () => {
  const params = new URLSearchParams(window.location.search);
  const urlABC = params.get("abc");

  if (urlABC) {
    console.log("Custom ABC Melody loaded from URL");
    // decodeURIComponent ensures encoded characters like %20 (space) or %2F (/) are read correctly
    return decodeURIComponent(urlABC);
  }

  return DEFAULT_MELODY;
};

const MELODY_ABC = getMelody();

// Notes definition
const NOTES_DATA = [
  { id: "F3", freq: 174.61, type: "white" },
  { id: "F#3", freq: 185.0, type: "black" },
  { id: "G3", freq: 196.0, type: "white" },
  { id: "G#3", freq: 207.65, type: "black" },
  { id: "A3", freq: 220.0, type: "white" },
  { id: "A#3", freq: 233.08, type: "black" },
  { id: "B3", freq: 246.94, type: "white" },

  { id: "C4", freq: 261.63, type: "white" },
  { id: "C#4", freq: 277.18, type: "black" },
  { id: "D4", freq: 293.66, type: "white" },
  { id: "D#4", freq: 311.13, type: "black" },
  { id: "E4", freq: 329.63, type: "white" },
  { id: "F4", freq: 349.23, type: "white" },
  { id: "F#4", freq: 369.99, type: "black" },
  { id: "G4", freq: 392.0, type: "white" },
  { id: "G#4", freq: 415.3, type: "black" },
  { id: "A4", freq: 440.0, type: "white" },
  { id: "A#4", freq: 466.16, type: "black" },
  { id: "B4", freq: 493.88, type: "white" },

  { id: "C5", freq: 523.25, type: "white" },
  { id: "C#5", freq: 554.37, type: "black" },
  { id: "D5", freq: 587.33, type: "white" },
  { id: "D#5", freq: 622.25, type: "black" },
  { id: "E5", freq: 659.25, type: "white" },
];

// --- DYNAMIC DIMENSIONS ---
const TOTAL_WHITE_KEYS = NOTES_DATA.filter((n) => n.type === "white").length;
const AVAILABLE_WIDTH = WIDTH * 0.95;
const START_X = (WIDTH - AVAILABLE_WIDTH) / 2;
const WHITE_KEY_WIDTH = AVAILABLE_WIDTH / TOTAL_WHITE_KEYS;
const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;

// --- SETUP PIXI & STATE ---
const app = new PIXI.Application();
const gameContainer = new PIXI.Container();
const keysContainer = new PIXI.Container();
const notesContainer = new PIXI.Container();
const uiContainer = new PIXI.Container();

const pianoKeys = [];
const activeNotes = [];
let score = 0;
let scoreText;

// Sequencer State
let parsedMelody = [];
let melodyIndex = 0;
let timeSinceLastNote = 0;
let timeUntilNextNote = 0; // frames
let isGameActive = false;

// --- AUDIO SYSTEM ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

// --- PIANO GENERATION ---
function createPiano() {
  let whiteKeyIndex = 0;
  const yPos = HEIGHT - KEY_HEIGHT - 20;

  // 1. Draw White Keys
  NOTES_DATA.forEach((note, index) => {
    if (note.type === "white") {
      const x = START_X + whiteKeyIndex * WHITE_KEY_WIDTH;
      const rect = new PIXI.Graphics();
      rect.rect(0, 0, WHITE_KEY_WIDTH, KEY_HEIGHT);
      rect.fill(0xffffff);
      rect.stroke({ width: 2, color: 0x000000 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";
      rect.on("pointerdown", () => triggerKey(index));

      // Tint setup: White keys default to white
      rect.tint = 0xffffff;

      keysContainer.addChild(rect);
      pianoKeys[index] = {
        graphic: rect,
        originalColor: 0xffffff,
        x: x + WHITE_KEY_WIDTH / 2,
        y: yPos,
        width: WHITE_KEY_WIDTH,
        data: note,
      };
      whiteKeyIndex++;
    }
  });

  // 2. Draw Black Keys
  let currentWhiteIndex = 0;
  NOTES_DATA.forEach((note, index) => {
    if (note.type === "white") {
      currentWhiteIndex++;
    } else {
      const x =
        START_X + currentWhiteIndex * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
      const rect = new PIXI.Graphics();
      rect.roundRect(0, 0, BLACK_KEY_WIDTH, KEY_HEIGHT * 0.6, 3);

      // Fill with WHITE so PIXI.tint works (multiplying by black 0x000000 always results in black)
      rect.fill(0xffffff);
      // Set visual color to BLACK via tint
      rect.tint = 0x000000;

      rect.stroke({ width: 1, color: 0x555555 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";
      rect.on("pointerdown", () => triggerKey(index));

      keysContainer.addChild(rect);
      pianoKeys[index] = {
        graphic: rect,
        originalColor: 0x000000, // We return to black tint after pressing
        x: x + BLACK_KEY_WIDTH / 2,
        y: yPos,
        width: BLACK_KEY_WIDTH,
        data: note,
      };
    }
  });
}

function createUI() {
  scoreText = new PIXI.Text({
    text: "Score: 0\nTap to Start Audio",
    style: {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffffff,
      align: "center",
    },
  });
  scoreText.x = WIDTH / 2;
  scoreText.y = 50;
  scoreText.anchor.set(0.5);
  scoreText.eventMode = "static";
  scoreText.cursor = "pointer";
  scoreText.on("pointerdown", () => {
    if (!isGameActive) {
      isGameActive = true;
      audioCtx.resume();
      scoreText.text = "Score: 0";
    }
  });

  uiContainer.addChild(scoreText);
}

// --- GAME LOGIC ---
function spawnNote(noteData) {
  // Find key index by note ID (e.g., "C4")
  const index = NOTES_DATA.findIndex((n) => n.id === noteData.id);

  if (index === -1) {
    // If the URL contains a note not in our range, we ignore it silently or log it
    // console.warn("Note out of range:", noteData.id);
    return;
  }

  const targetKey = pianoKeys[index];
  const note = new PIXI.Graphics();
  const color = targetKey.data.type === "white" ? 0x00ffff : 0xff00ff;
  const width = targetKey.width - 4;

  note.roundRect(-width / 2, 0, width, 40, 4);
  note.fill(color);

  note.x = targetKey.x;
  note.y = -100; // Start off screen
  note.targetIndex = index;
  note.active = true;
  note.id = noteData.id;

  notesContainer.addChild(note);
  activeNotes.push(note);
}

function updateScoreDisplay() {
  scoreText.text = `Score: ${score}`;
}

function triggerKey(index) {
  if (!isGameActive) {
    isGameActive = true;
    audioCtx.resume();
    scoreText.text = "Score: 0";
  }

  const keyObj = pianoKeys[index];
  if (!keyObj) return;

  // Visual feedback
  keyObj.graphic.tint = 0xffa500; // Highlight Orange

  // Reset to the key's specific original color (White or Black)
  setTimeout(() => {
    keyObj.graphic.tint = keyObj.originalColor;
  }, 150);

  // Play audio
  playTone(keyObj.data.freq);

  // Hit detection
  const hitLineY = keyObj.y;
  const hitZone = 60;
  let hit = false;

  for (let i = activeNotes.length - 1; i >= 0; i--) {
    const n = activeNotes[i];
    if (n.targetIndex === index && n.active) {
      const dist = Math.abs(n.y - hitLineY);
      if (dist < hitZone) {
        // Scoring
        score += 100;
        if (dist < 15) score += 50; // Perfect hit

        showHitEffect(keyObj.x, hitLineY);
        notesContainer.removeChild(n);
        activeNotes.splice(i, 1);
        hit = true;
        break; // Only hit one note per tap
      }
    }
  }

  if (!hit) {
    score = Math.max(0, score - 10);
  }
  updateScoreDisplay();
}

function showHitEffect(x, y) {
  const burst = new PIXI.Graphics();
  burst.circle(0, 0, 30);
  burst.fill({ color: 0xffffff, alpha: 0.6 });
  burst.x = x;
  burst.y = y;
  gameContainer.addChild(burst);

  let tick = 0;
  const animate = () => {
    tick++;
    burst.scale.set(1 + tick / 10);
    burst.alpha -= 0.1;
    if (burst.alpha <= 0) {
      gameContainer.removeChild(burst);
      app.ticker.remove(animate);
    }
  };
  app.ticker.add(animate);
}

// --- INITIALIZATION ---
async function initGame() {
  await app.init({
    resizeTo: window,
    backgroundColor: 0x111111,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  document.body.appendChild(app.canvas);

  app.stage.addChild(gameContainer);
  gameContainer.addChild(notesContainer);
  gameContainer.addChild(keysContainer);
  gameContainer.addChild(uiContainer);

  createPiano();
  createUI();

  // Parse Melody using the imported function
  // Now uses the MELODY_ABC derived from URL or Default
  parsedMelody = parseABC(MELODY_ABC);

  // Calculate frames per beat
  // 60 BPM = 1 beat per sec = 60 frames.
  const framesPerBeat = (60 / BPM) * 60;

  // Resize Logic
  const resize = () => {
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;
    const scale = Math.min(screenWidth / WIDTH, screenHeight / HEIGHT);
    gameContainer.scale.set(scale);
    gameContainer.x = (screenWidth - WIDTH * scale) / 2;
    gameContainer.y = (screenHeight - HEIGHT * scale) / 2;
  };
  window.addEventListener("resize", resize);
  resize();

  // Game Loop
  app.ticker.add((ticker) => {
    if (!isGameActive) return;

    // 1. Melody Sequencer
    if (parsedMelody.length > 0 && melodyIndex < parsedMelody.length) {
      timeSinceLastNote += ticker.deltaTime;

      // If we are waiting for the next note
      if (timeSinceLastNote >= timeUntilNextNote) {
        const noteData = parsedMelody[melodyIndex];

        // Spawn the note (unless it's a rest)
        if (noteData.id !== null) {
          spawnNote(noteData);
        }

        // Set wait time for the *next* note based on *current* note's duration
        timeUntilNextNote = noteData.duration * framesPerBeat;
        timeSinceLastNote = 0;

        melodyIndex++;

        // Loop song
        if (melodyIndex >= parsedMelody.length) {
          setTimeout(() => {
            melodyIndex = 0;
          }, 2000);
        }
      }
    }

    // 2. Physics (Falling Notes)
    for (let i = activeNotes.length - 1; i >= 0; i--) {
      const n = activeNotes[i];
      n.y += NOTE_SPEED * ticker.deltaTime;

      if (n.y > HEIGHT) {
        notesContainer.removeChild(n);
        activeNotes.splice(i, 1);
        score = Math.max(0, score - 20);
        updateScoreDisplay();
      }
    }
  });
}

initGame();

import "./style.css";
import * as PIXI from "pixi.js";
import { parseABC } from "./parser";
import { playTone, resumeAudio } from "./audio";

// --- CONFIGURATION ---
const WIDTH = 1000;
const HEIGHT = 500;
const KEY_HEIGHT = 150;

const urlParams = new URLSearchParams(window.location.search);
const BPM = parseInt(urlParams.get("bpm")) || 100;
const SPEED = parseInt(urlParams.get("speed")) || 4; // Pixels per frame

// --- COLORS ---
const COLOR_WHITE_KEY = 0xf0f0f0; // Off-white/Light Gray
const COLOR_BLACK_KEY = 0x202020; // Not pure black

// --- ABC MELODY DEFINITION ---
// Notation: C,D,E = Octave 4 | c,d,e = Octave 5 | ^ = Sharp | Number = Duration multiplier

// 1. Define the fallback melody ("Ode to Joy")
const DEFAULT_MELODY = `
  E E F G | G F E D | C C D E | E3/2 D/2 D2 |
  E E F G | G F E D | C C D E | D3/2 C/2 C2 |
  D D E C | D E/2 F/2 E C | D E/2 F/2 E D | C D G,2 |
  E E F G | G F E D | C C D E | D3/2 C/2 C2
`;

// 2. Logic to grab melody from URL Parameter (?melody=...)
const getMelody = () => {
  const urlMelody = urlParams.get("melody");

  if (urlMelody) {
    console.log("Custom melody loaded from URL");
    return decodeURIComponent(urlMelody);
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
let startText;

// Sequencer State
let parsedMelody = [];
let melodyIndex = 0;
let timeSinceLastNote = 0;
let timeUntilNextNote = 0; // frames
let isGameActive = false;

// --- PIANO GENERATION ---
function createPiano() {
  let whiteKeyIndex = 0;
  const yPos = HEIGHT - KEY_HEIGHT - 20;

  // 0. Draw Visual Hit Line (Judgment Line)
  const hitLine = new PIXI.Graphics();
  hitLine.moveTo(START_X, yPos + 2);
  hitLine.lineTo(START_X + AVAILABLE_WIDTH, yPos + 2);
  hitLine.stroke({ width: 6, color: 0xcc0000 });
  uiContainer.addChild(hitLine);

  // 1. Draw White Keys
  NOTES_DATA.forEach((note, index) => {
    if (note.type === "white") {
      const x = START_X + whiteKeyIndex * WHITE_KEY_WIDTH;
      const rect = new PIXI.Graphics();
      rect.roundRect(0, 0, WHITE_KEY_WIDTH, KEY_HEIGHT, 6);

      // Use pure white for fill so Tinting works correctly
      rect.fill(0xffffff);
      rect.stroke({ width: 2, color: 0x000000 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";
      rect.on("pointerdown", () => triggerKey(index));

      // Tint setup: Off-white
      rect.tint = COLOR_WHITE_KEY;

      keysContainer.addChild(rect);
      pianoKeys[index] = {
        graphic: rect,
        originalColor: COLOR_WHITE_KEY,
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

      // Fill with WHITE so PIXI.tint works
      rect.fill(0xffffff);

      // Set visual color to Charcoal via tint
      rect.tint = COLOR_BLACK_KEY;

      rect.stroke({ width: 1, color: 0x555555 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";
      rect.on("pointerdown", () => triggerKey(index));

      // Define a hit area wider than the visual key
      // and centered relative to the visual drawing.
      // x is negative to extend to the left of the drawing origin.
      const hitWidth = WHITE_KEY_WIDTH * 0.9;
      const hitHeight = KEY_HEIGHT * 0.6;
      const hitX = (BLACK_KEY_WIDTH - hitWidth) / 2;
      rect.hitArea = new PIXI.Rectangle(hitX, 0, hitWidth, hitHeight);

      keysContainer.addChild(rect);
      pianoKeys[index] = {
        graphic: rect,
        originalColor: COLOR_BLACK_KEY,
        x: x + BLACK_KEY_WIDTH / 2,
        y: yPos,
        width: BLACK_KEY_WIDTH,
        data: note,
      };
    }
  });
}

function createUI() {
  startText = new PIXI.Text({
    text: "Tap to Start",
    style: {
      fontFamily: "Arial",
      fontSize: 36,
      fill: 0xffffff,
      align: "center",
      fontWeight: "bold",
    },
  });
  startText.x = WIDTH / 2;
  startText.y = HEIGHT / 2 - 100;
  startText.anchor.set(0.5);
  startText.eventMode = "static";
  startText.cursor = "pointer";
  startText.on("pointerdown", () => {
    if (!isGameActive) {
      isGameActive = true;
      resumeAudio();
      startText.visible = false;
    }
  });

  uiContainer.addChild(startText);
}

// --- GAME LOGIC ---
function spawnNote(noteData) {
  // Find key index by note ID (e.g., "C4")
  const index = NOTES_DATA.findIndex((n) => n.id === noteData.id);

  if (index === -1) {
    return;
  }

  const targetKey = pianoKeys[index];
  const note = new PIXI.Graphics();
  const color = targetKey.data.type === "white" ? 0x00ffff : 0xff00ff;

  // Visual width of the note matches the visual width of the key
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

function triggerKey(index) {
  if (!isGameActive) {
    isGameActive = true;
    resumeAudio();
    startText.visible = false;
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

  // Hit detection (Visual effect only, no scoring)
  const hitLineY = keyObj.y;
  const hitZone = 60; // How far below the line is valid

  for (let i = activeNotes.length - 1; i >= 0; i--) {
    const n = activeNotes[i];
    if (n.targetIndex === index && n.active) {
      const dist = Math.abs(n.y - hitLineY);
      if (dist < hitZone) {
        // Success Hit (White)
        showHitEffect(keyObj.x, hitLineY, 0xffffff);
        notesContainer.removeChild(n);
        activeNotes.splice(i, 1);
        break; // Only hit one note per tap
      }
    }
  }
}

function showHitEffect(x, y, color) {
  const burst = new PIXI.Graphics();
  burst.circle(0, 0, 30);
  burst.fill({ color: color, alpha: 0.6 });
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
      burst.destroy();
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
  // Important: Notes are added BEFORE Keys, so they render BEHIND keys.
  gameContainer.addChild(notesContainer);
  gameContainer.addChild(keysContainer);
  gameContainer.addChild(uiContainer);

  createPiano();
  createUI();

  // Parse Melody using the imported function
  parsedMelody = parseABC(MELODY_ABC);

  // Calculate frames per beat
  const framesPerBeat = (60 / BPM) * 60;

  // Resize Logic
  const resize = () => {
    // Pixi v8 "resizeTo" automatically updates app.screen.width/height
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;

    // Safety check to prevent 0 scale
    if (screenWidth === 0 || screenHeight === 0) return;

    const scale = Math.min(screenWidth / WIDTH, screenHeight / HEIGHT);
    gameContainer.scale.set(scale);

    // Center the container
    gameContainer.x = (screenWidth - WIDTH * scale) / 2;
    gameContainer.y = (screenHeight - HEIGHT * scale) / 2;
  };

  // Important: Listen to app.renderer 'resize', not window 'resize'.
  // This ensures Pixi has finished updating the canvas size before we scale the container.
  app.renderer.on("resize", resize);

  // Call once manually to set initial position
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
      n.y += SPEED * ticker.deltaTime;

      const targetKey = pianoKeys[n.targetIndex];

      // "Miss" Threshold Calculation:
      // The Hit Line is at targetKey.y.
      // The valid Hit Zone is approx 20px below that.
      // Once the note passes targetKey.y + 20, it is unhittable and "hidden" behind the key.
      const missThreshold = targetKey.y + 20;

      if (n.y > missThreshold) {
        // Show Miss Effect (Red Burst)
        showHitEffect(targetKey.x, targetKey.y, 0xff0000);

        // Remove note
        notesContainer.removeChild(n);
        activeNotes.splice(i, 1);
      }
    }
  });
}

initGame();

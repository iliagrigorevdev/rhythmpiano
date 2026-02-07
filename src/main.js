import "./style.css";
import * as PIXI from "pixi.js";
import { parseABC } from "./parser";
import {
  initAudio,
  cacheAllNoteSounds,
  playNote,
  stopNote,
  generateNoteRange,
} from "./audio";

// --- CONFIGURATION ---
const WIDTH = 1000;
const HEIGHT = 400;
const KEY_HEIGHT = 150;

const urlParams = new URLSearchParams(window.location.search);
const BPM = parseInt(urlParams.get("bpm")) || 100;
const SPEED = parseInt(urlParams.get("speed")) || 4; // Pixels per frame

// --- COLORS ---
const COLOR_WHITE_KEY = 0xf0f0f0; // Off-white/Light Gray
const COLOR_BLACK_KEY = 0x202020; // Not pure black

// --- ABC MELODY DEFINITION ---
const getMelody = () => {
  const urlMelody = urlParams.get("melody");
  if (urlMelody) {
    console.log("Custom melody loaded from URL");
    return decodeURIComponent(urlMelody);
  }
  return "";
};

const MELODY_ABC = getMelody();

// Notes definition - generated dynamically
const NOTES_DATA = Object.values(generateNoteRange("F3", "E5")).map((note) => ({
  id: note,
  type: note.includes("#") ? "black" : "white",
}));

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

// UI Elements
let startText;
let resultText;
let loadingText;

// Sequencer State
let parsedMelody = [];
let melodyIndex = 0;
let timeSinceLastNote = 0;
let timeUntilNextNote = 0; // frames
let isGameActive = false;
let isSongFinished = false;

// Scoring State
let notesHit = 0;
let totalSpawned = 0;

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

      rect.fill(0xffffff);
      rect.stroke({ width: 2, color: 0x000000 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";

      // Bind events
      rect.on("pointerdown", () => pressKey(index));
      rect.on("pointerup", () => releaseKey(index));
      rect.on("pointerupoutside", () => releaseKey(index));
      rect.on("pointerleave", () => releaseKey(index));

      rect.tint = COLOR_WHITE_KEY;

      keysContainer.addChild(rect);
      pianoKeys[index] = {
        graphic: rect,
        originalColor: COLOR_WHITE_KEY,
        x: x + WHITE_KEY_WIDTH / 2,
        y: yPos,
        width: WHITE_KEY_WIDTH,
        data: note,
        audioNode: null, // Store reference to playing sound
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
      rect.fill(0xffffff);
      rect.tint = COLOR_BLACK_KEY;
      rect.stroke({ width: 1, color: 0x555555 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";

      // Bind events
      rect.on("pointerdown", () => pressKey(index));
      rect.on("pointerup", () => releaseKey(index));
      rect.on("pointerupoutside", () => releaseKey(index));
      rect.on("pointerleave", () => releaseKey(index));

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
        audioNode: null,
      };
    }
  });
}

function createUI() {
  const style = {
    fontFamily: "Arial",
    fontSize: 36,
    fill: 0xffffff,
    align: "center",
    fontWeight: "bold",
    stroke: { color: 0x000000, width: 4 },
  };

  // Loading Text
  loadingText = new PIXI.Text({ text: "Loading Sounds...", style });
  loadingText.x = WIDTH / 2;
  loadingText.y = HEIGHT / 2;
  loadingText.anchor.set(0.5);
  uiContainer.addChild(loadingText);

  // Start Text
  const textContent =
    parsedMelody.length > 0 ? "Tap to Start" : "Tap for Free Play";
  startText = new PIXI.Text({ text: textContent, style });
  startText.x = WIDTH / 2;
  startText.y = HEIGHT / 2 - 100;
  startText.anchor.set(0.5);
  startText.eventMode = "static";
  startText.cursor = "pointer";
  startText.visible = false; // Hidden until loaded
  startText.on("pointerdown", () => {
    resetGame();
  });

  uiContainer.addChild(startText);

  // Result Text
  resultText = new PIXI.Text({ text: "", style });
  resultText.x = WIDTH / 2;
  resultText.y = HEIGHT / 2 - 100;
  resultText.anchor.set(0.5);
  resultText.visible = false;
  resultText.eventMode = "static";
  resultText.cursor = "pointer";
  resultText.on("pointerdown", () => {
    resetGame();
  });

  uiContainer.addChild(resultText);
}

// --- GAME LOGIC ---
function resetGame() {
  melodyIndex = 0;
  timeSinceLastNote = 0;
  timeUntilNextNote = 0;
  notesHit = 0;
  totalSpawned = 0;
  isSongFinished = false;

  for (const note of activeNotes) {
    notesContainer.removeChild(note);
  }
  activeNotes.length = 0;

  startText.visible = false;
  resultText.visible = false;

  initAudio();
  isGameActive = true;
}

function showResults() {
  isGameActive = false;

  let percentage = 0;
  if (totalSpawned > 0) {
    percentage = Math.round((notesHit / totalSpawned) * 100);
  }

  resultText.text = `Melody Finished!\nScore: ${percentage}%\n\nTap to Restart`;
  resultText.visible = true;
}

function spawnNote(noteData) {
  const index = NOTES_DATA.findIndex((n) => n.id === noteData.id);
  if (index === -1) return;

  const targetKey = pianoKeys[index];
  const note = new PIXI.Graphics();
  const color = targetKey.data.type === "white" ? 0x00ffff : 0xff00ff;

  const width = targetKey.width - 4;

  note.roundRect(-width / 2, 0, width, 40, 4);
  note.fill(color);

  note.x = targetKey.x;
  note.y = -100;
  note.targetIndex = index;
  note.active = true;
  note.id = noteData.id;

  notesContainer.addChild(note);
  activeNotes.push(note);
}

function pressKey(index) {
  // If game isn't active, first tap starts it
  if (!isGameActive && !resultText.visible && !loadingText.visible) {
    resetGame();
    return;
  }

  const keyObj = pianoKeys[index];
  if (!keyObj) return;

  // Visual feedback (Press down)
  keyObj.graphic.tint = 0xffa500;

  // Stop previous sound if any (re-triggering)
  if (keyObj.audioNode) {
    stopNote(keyObj.audioNode);
  }

  // Play audio (Sample)
  keyObj.audioNode = playNote(keyObj.data.id);

  if (!isGameActive) return;

  // Hit detection
  const hitLineY = keyObj.y;
  const hitZone = 60;

  for (let i = activeNotes.length - 1; i >= 0; i--) {
    const n = activeNotes[i];
    if (n.targetIndex === index && n.active) {
      const dist = Math.abs(n.y - hitLineY);
      if (dist < hitZone) {
        showHitEffect(keyObj.x, hitLineY);
        notesHit++;
        notesContainer.removeChild(n);
        activeNotes.splice(i, 1);
        break;
      }
    }
  }
}

function releaseKey(index) {
  const keyObj = pianoKeys[index];
  if (!keyObj) return;

  // Revert visual
  keyObj.graphic.tint = keyObj.originalColor;

  // Stop audio (Release)
  if (keyObj.audioNode) {
    stopNote(keyObj.audioNode, 1.0);
    keyObj.audioNode = null;
  }
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

  // --- Native Event blocking for Android ---
  const canvas = app.canvas;
  document.body.appendChild(canvas);

  // Prevent default browser gestures (Long press, Zoom, Pan) on the canvas
  // This specifically stops the Android "context menu" vibration.
  // Note: PIXI uses Pointer Events, so blocking 'touchstart' prevents
  // browser emulation but still allows PIXI to function.
  const preventDefault = (e) => e.preventDefault();
  canvas.addEventListener("touchstart", preventDefault, { passive: false });
  canvas.addEventListener("touchmove", preventDefault, { passive: false });
  canvas.addEventListener("touchend", preventDefault, { passive: false });
  canvas.addEventListener("contextmenu", preventDefault, { passive: false });

  app.stage.addChild(gameContainer);
  gameContainer.addChild(notesContainer);
  gameContainer.addChild(keysContainer);
  gameContainer.addChild(uiContainer);

  parsedMelody = parseABC(MELODY_ABC);

  createPiano();
  createUI();

  // Setup Resize Listener
  const resize = () => {
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;

    if (screenWidth === 0 || screenHeight === 0) return;

    const scale = Math.min(screenWidth / WIDTH, screenHeight / HEIGHT);
    gameContainer.scale.set(scale);

    gameContainer.x = (screenWidth - WIDTH * scale) / 2;
    gameContainer.y = (screenHeight - HEIGHT * scale) / 2;
  };

  app.renderer.on("resize", resize);
  resize();

  // Load Sounds
  // initAudio() is intentionally not called here to avoid blocking execution
  // waiting for user gesture (Autoplay Policy). It is called on first interaction.
  await cacheAllNoteSounds();

  // Ready to play
  loadingText.visible = false;
  startText.visible = true;

  const framesPerBeat = (60 / BPM) * 60;

  app.ticker.add((ticker) => {
    if (!isGameActive) return;

    // 1. Melody Sequencer
    if (parsedMelody.length > 0 && melodyIndex < parsedMelody.length) {
      timeSinceLastNote += ticker.deltaTime;

      if (timeSinceLastNote >= timeUntilNextNote) {
        const noteData = parsedMelody[melodyIndex];

        if (noteData.id !== null) {
          spawnNote(noteData);
          totalSpawned++;
        }

        timeUntilNextNote = noteData.duration * framesPerBeat;
        timeSinceLastNote = 0;

        melodyIndex++;
      }
    } else if (parsedMelody.length > 0 && melodyIndex >= parsedMelody.length) {
      if (!isSongFinished) {
        isSongFinished = true;
        setTimeout(() => {
          showResults();
        }, 3000);
      }
    }

    // 2. Physics (Falling Notes)
    for (let i = activeNotes.length - 1; i >= 0; i--) {
      const n = activeNotes[i];
      n.y += SPEED * ticker.deltaTime;
      const targetKey = pianoKeys[n.targetIndex];
      const missThreshold = targetKey.y + 20;

      if (n.y > missThreshold) {
        notesContainer.removeChild(n);
        activeNotes.splice(i, 1);
      }
    }
  });
}

initGame();

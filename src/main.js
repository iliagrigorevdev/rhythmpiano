import "./style.css";
import * as PIXI from "pixi.js";
import { parseABC } from "./parser";
import { convertMidiToUrlData } from "./converter";
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

const urlParams = new URLSearchParams(window.location.search);
const BPM = parseInt(urlParams.get("bpm")) || 100;
const SPEED = parseInt(urlParams.get("speed")) || 4; // Pixels per frame

// Feature Flag: Wait for Input
// Default: true. If set to false (?wait=false), notes will fall past the line without stopping.
const WAIT_MODE = urlParams.get("wait") !== "false";

// Calculate frames per beat globally for visual spacing calculations
// BPM = Beats per minute. 60 FPS assumed.
// Duration 1 in parser = 1/8th note.
// Standard beat (quarter note) = 2 units of duration.
const FRAMES_PER_BEAT = ((60 / BPM) * 60) / 2;

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
// Range F3 (index 0) to E5 (index 23)
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
const WHITE_KEY_HEIGHT = 160;
const BLACK_KEY_HEIGHT = WHITE_KEY_HEIGHT * 0.55;

// --- KEYBOARD MAPPING ---
// Maps computer keyboard keys to the index in NOTES_DATA/pianoKeys
const KEY_TO_NOTE_INDEX = {
  // F3 Group
  // F3-G3 (Indices 0-2) are not mapped to keyboard
  q: 3, // G#3

  // A3 Group
  a: 4, // A3
  w: 5, // A#3
  s: 6, // B3

  // C4 Group
  d: 7, // C4
  r: 8, // C#4
  f: 9, // D4
  t: 10, // D#4
  g: 11, // E4

  // F4 Group
  h: 12, // F4
  u: 13, // F#4
  j: 14, // G4
  i: 15, // G#4
  k: 16, // A4
  o: 17, // A#4
  l: 18, // B4

  // C5 Group
  ";": 19, // C5
  "[": 20, // C#5
  "'": 21, // D5
  "]": 22, // D#5
  "\\": 23, // E5
};

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
let loadingText;
let uploadButton;

// Sequencer State
let parsedMelody = [];
let melodyIndex = 0;
let timeSinceLastNote = 0;
let timeUntilNextNote = 0; // frames
let isGameActive = false;
let isSongFinished = false;

// Input Wait State
let isWaitingForInput = false;

// Constants
const NOTE_HEIGHT = 40;
const NOTE_GAP = 5;
const NOTE_CLEARANCE = NOTE_HEIGHT + NOTE_GAP;
const HIT_ZONE = 2 * NOTE_HEIGHT;

// --- FILE UPLOAD LOGIC ---
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".mid,.midi";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (uploadButton) {
    uploadButton.visible = false;
  }
  loadingText.text = "Parsing MIDI...";
  loadingText.visible = true;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const { bpm, melody } = await convertMidiToUrlData(arrayBuffer);

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("bpm", bpm);
    newUrl.searchParams.set("melody", melody);
    window.location.href = newUrl.toString();
  } catch (err) {
    console.error(err);
    alert(
      "Failed to parse MIDI file. Make sure it has notes in the first track.",
    );
    loadingText.visible = false;
    startText.visible = true;
  }
});

// --- PIANO GENERATION ---
function createPiano() {
  let whiteKeyIndex = 0;
  const yPos = HEIGHT - WHITE_KEY_HEIGHT - 20;

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
      rect.roundRect(0, 0, WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT, 6);

      rect.fill(0xffffff);
      rect.stroke({ width: 2, color: 0x000000 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";
      rect.tint = COLOR_WHITE_KEY;

      // Bind events
      rect.on("pointerdown", () => pressKey(index));
      rect.on("pointerup", () => releaseKey(index));
      rect.on("pointerupoutside", () => releaseKey(index));
      rect.on("pointerleave", () => releaseKey(index));

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
      rect.roundRect(0, 0, BLACK_KEY_WIDTH, BLACK_KEY_HEIGHT, 3);
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
      const hitHeight = BLACK_KEY_HEIGHT;
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
  loadingText.y = HEIGHT / 2 - 50;
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

  // --- Upload Button (Container) ---
  uploadButton = new PIXI.Container();
  uploadButton.x = WIDTH / 2;
  uploadButton.y = HEIGHT / 2 - 50;
  uploadButton.visible = false;
  uploadButton.eventMode = "static";
  uploadButton.cursor = "pointer";

  // 1. Text Object
  const btnStyle = {
    ...style,
    fontSize: 24,
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 2 },
  };
  const btnText = new PIXI.Text({
    text: "📂 Open MIDI File",
    style: btnStyle,
  });
  btnText.anchor.set(0.5);

  // 2. Background Object (Based on text size)
  const bg = new PIXI.Graphics();
  const paddingX = 40;
  const paddingY = 20;
  bg.roundRect(
    -btnText.width / 2 - paddingX / 2,
    -btnText.height / 2 - paddingY / 2,
    btnText.width + paddingX,
    btnText.height + paddingY,
    10,
  );
  bg.fill({ color: 0x000000, alpha: 0.8 });
  bg.stroke({ width: 2, color: 0xffffff });

  // 3. Add to Container (Order matters: Background first, then Text)
  uploadButton.addChild(bg);
  uploadButton.addChild(btnText);

  // 4. Events
  uploadButton.on("pointerdown", (e) => {
    e.stopPropagation();
    fileInput.click();
    resetToMenu();
  });

  uiContainer.addChild(uploadButton);
}

function setupKeyboardListeners() {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return; // Prevent machine-gun effect if key is held
    const key = e.key.toLowerCase();

    if (KEY_TO_NOTE_INDEX.hasOwnProperty(key)) {
      // Prevent browser default for mapped keys (e.g. Quick Find on ',')
      e.preventDefault();
      const index = KEY_TO_NOTE_INDEX[key];
      // Check if index is valid
      if (pianoKeys[index]) {
        pressKey(index);
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    if (KEY_TO_NOTE_INDEX.hasOwnProperty(key)) {
      const index = KEY_TO_NOTE_INDEX[key];
      if (pianoKeys[index]) {
        releaseKey(index);
      }
    }
  });
}

// --- GAME LOGIC ---
function resetGame() {
  melodyIndex = 0;
  timeSinceLastNote = 0;
  timeUntilNextNote = 0;
  isSongFinished = false;
  isWaitingForInput = false;

  for (const note of activeNotes) {
    notesContainer.removeChild(note);
  }
  activeNotes.length = 0;

  startText.visible = false;
  uploadButton.visible = false;

  initAudio();
  isGameActive = true;
}

function resetToMenu() {
  isGameActive = false;
  startText.text = "Tap to Start";
  startText.visible = true;
  uploadButton.visible = false;
}

function spawnNote(noteData) {
  const index = NOTES_DATA.findIndex((n) => n.id === noteData.id);
  if (index === -1) return;

  const targetKey = pianoKeys[index];
  const note = new PIXI.Graphics();
  const color = targetKey.data.type === "white" ? 0x00ffff : 0xff00ff;

  const width = targetKey.width - 4;

  // Visual Gap Logic:
  // We want a fixed 40px height note.
  // However, if the NEXT note is coming too soon (close), we need to create a visual gap.
  // The 'Next' note physically spawns ABOVE this one (since notes fall down).
  // Therefore, the collision point is the TOP of THIS note vs the BOTTOM of the NEXT note.
  // To make a gap, we shave height off the TOP of THIS note.

  const distToNext = noteData.duration * FRAMES_PER_BEAT * SPEED;

  let topOffset = 0;

  // Logic: We need at least (NOTE_HEIGHT + NOTE_GAP) space.
  // 'distToNext' is the physical distance between the start (anchor) of this note and the next.
  if (distToNext < NOTE_CLEARANCE) {
    // If distance is too small, we start drawing lower (offset from top)
    topOffset = NOTE_CLEARANCE - distToNext;
  }

  // Ensure we don't erase the whole note. Min height 5px.
  topOffset = Math.min(topOffset, NOTE_HEIGHT - 5);

  const finalHeight = NOTE_HEIGHT - topOffset;

  // Draw rectangle with offset on the Y-axis (top)
  note.roundRect(-width / 2, topOffset, width, finalHeight, 4);
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
  if (!isGameActive && !loadingText.visible && !uploadButton.visible) {
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

  // 1. Find the ABSOLUTE closest distance among ALL active notes (any column)
  let minGlobalDistance = Infinity;

  for (const n of activeNotes) {
    if (n.active) {
      const dist = Math.abs(n.y - hitLineY);
      if (dist < minGlobalDistance) {
        minGlobalDistance = dist;
      }
    }
  }

  // If the closest note on screen is outside the hit zone, we can't hit anything.
  if (minGlobalDistance > HIT_ZONE) return;

  // 2. Find if the pressed key has a note that matches this global timing
  // We allow a small tolerance (e.g., 10px) to handle chords where multiple notes
  // are basically at the same distance.
  const CHORD_TOLERANCE = 10;

  let noteToHitIndex = -1;
  let minColDistance = Infinity;

  for (let i = 0; i < activeNotes.length; i++) {
    const n = activeNotes[i];

    // Check if note is in the pressed column
    if (n.targetIndex === index && n.active) {
      const dist = Math.abs(n.y - hitLineY);

      // It must be within the Hit Zone
      if (dist < HIT_ZONE) {
        // CRITICAL CHECK:
        // The note in this column must be roughly as close as the closest note on the ENTIRE screen.
        // If Global Closest is 5px away (Note B), and this note is 100px away (Note A),
        // 100 <= 5 + 10 is False. We do not hit Note A.
        if (dist <= minGlobalDistance + CHORD_TOLERANCE) {
          // Standard closest-in-column check
          if (dist < minColDistance) {
            minColDistance = dist;
            noteToHitIndex = i;
          }
        }
      }
    }
  }

  // If a valid note was found that matches the global timing context
  if (noteToHitIndex !== -1) {
    const noteToRemove = activeNotes[noteToHitIndex];
    showHitEffect(keyObj.x, hitLineY);
    notesContainer.removeChild(noteToRemove);
    activeNotes.splice(noteToHitIndex, 1);
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

  // --- Long Press Logic ---
  let longPressTimer = null;
  let startX = 0;
  let startY = 0;
  const LONG_PRESS_DURATION = 800; // ms
  const MOVE_THRESHOLD = 20; // px

  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handlePointerDown = (e) => {
    if (!e.isPrimary) return;
    startX = e.clientX;
    startY = e.clientY;
    cancelLongPress();

    longPressTimer = setTimeout(() => {
      // Show upload button only if we are in menu state
      if (!isGameActive) {
        uploadButton.visible = true;
        startText.visible = false;
        uiContainer.zIndex = 100;
      }
      longPressTimer = null;
    }, LONG_PRESS_DURATION);
  };

  const handlePointerMove = (e) => {
    if (!longPressTimer) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      cancelLongPress();
    }
  };

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", cancelLongPress);
  canvas.addEventListener("pointercancel", cancelLongPress);
  canvas.addEventListener("pointermove", handlePointerMove);

  const preventDefault = (e) => e.preventDefault();
  canvas.addEventListener("touchstart", preventDefault, { passive: false });
  canvas.addEventListener("touchmove", preventDefault, { passive: false });
  canvas.addEventListener("touchend", preventDefault, { passive: false });

  app.stage.addChild(gameContainer);
  gameContainer.addChild(notesContainer);
  gameContainer.addChild(keysContainer);
  gameContainer.addChild(uiContainer);

  parsedMelody = parseABC(MELODY_ABC);

  createPiano();
  createUI();
  setupKeyboardListeners();

  // Setup Resize Listener
  const resize = () => {
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;

    if (screenWidth === 0 || screenHeight === 0) return;

    // Check if device is in portrait mode
    const isPortrait = screenHeight > screenWidth;

    let scale;

    if (isPortrait) {
      // In portrait, we fit the Game Width (1000) into Screen Height
      // and Game Height (400) into Screen Width
      scale = Math.min(screenHeight / WIDTH, screenWidth / HEIGHT);
      gameContainer.rotation = Math.PI / 2; // Rotate 90 degrees
    } else {
      // Standard landscape behavior
      scale = Math.min(screenWidth / WIDTH, screenHeight / HEIGHT);
      gameContainer.rotation = 0;
    }

    gameContainer.scale.set(scale);

    // Set Pivot to center of the logical game
    gameContainer.pivot.set(WIDTH / 2, HEIGHT / 2);

    // Position container at center of screen
    gameContainer.x = screenWidth / 2;
    gameContainer.y = screenHeight / 2;
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

  app.ticker.add((ticker) => {
    if (!isGameActive) return;

    // --- PAUSE LOGIC (Time Manipulation) ---
    // If WAIT_MODE is true, we calculate an 'effectiveDelta'.
    // We look for the note closest to the judgment line.
    // We limit the delta time so that note cannot pass the line.
    // Since this delta is applied to EVERYTHING (sequencer + physics),
    // everything stops synchronously.

    let effectiveDelta = ticker.deltaTime;

    if (WAIT_MODE && activeNotes.length > 0) {
      const hitLineY = pianoKeys[0].y;
      // We want the bottom of the note (y + NOTE_HEIGHT) to stop at hitLineY
      const stopY = hitLineY - NOTE_HEIGHT;

      let minDistance = Infinity;

      // Find the note closest to the stopping point
      for (const n of activeNotes) {
        const dist = stopY - n.y;
        // We track the smallest distance (closest to line)
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      // If minDistance is negative, a note is technically slightly past due to float precision,
      // clamp to 0 to ensure full stop.
      if (minDistance < 0) minDistance = 0;

      // Convert physical distance to time (frames)
      // distance = speed * time  =>  time = distance / speed
      const maxAllowedDelta = minDistance / SPEED;

      // If the time required to hit the line is LESS than the current frame time,
      // use that smaller time. This slows down/stops the game exactly at the line.
      if (maxAllowedDelta < effectiveDelta) {
        effectiveDelta = maxAllowedDelta;
      }
    }

    // --- NORMAL GAME LOOP ---

    // 1. Melody Sequencer
    if (parsedMelody.length > 0 && melodyIndex < parsedMelody.length) {
      timeSinceLastNote += effectiveDelta;

      if (timeSinceLastNote >= timeUntilNextNote) {
        const noteData = parsedMelody[melodyIndex];

        if (noteData.id !== null) {
          spawnNote(noteData);
        }

        // Use global FRAMES_PER_BEAT
        timeUntilNextNote = noteData.duration * FRAMES_PER_BEAT;
        timeSinceLastNote = 0;

        melodyIndex++;
      }
    } else if (parsedMelody.length > 0 && melodyIndex >= parsedMelody.length) {
      // Only finish if the sequencer is empty AND no notes are left on screen
      if (activeNotes.length === 0 && !isSongFinished) {
        isSongFinished = true;
        setTimeout(() => {
          resetToMenu();
        }, 1500);
      }
    }

    // 2. Physics (Falling Notes)
    for (let i = activeNotes.length - 1; i >= 0; i--) {
      const n = activeNotes[i];
      n.y += SPEED * effectiveDelta;

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

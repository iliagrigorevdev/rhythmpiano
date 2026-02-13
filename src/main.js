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
  noteNameToMidi,
} from "./audio";

// --- CONFIGURATION ---
const WIDTH = 1000;
const HEIGHT = 400;

const urlParams = new URLSearchParams(window.location.search);
const BPM = parseInt(urlParams.get("bpm")) || 100;
const SPEED = parseInt(urlParams.get("speed")) || 4;
const WAIT_MODE = urlParams.get("wait") !== "false";
const DEMO_MODE = urlParams.get("demo") === "true";

const START_NOTE = "C3";
const END_NOTE = "B5";

const FRAMES_PER_BEAT = ((60 / BPM) * 60) / 2;

// --- COLORS ---
const COLOR_WHITE_KEY = 0xf0f0f0;
const COLOR_BLACK_KEY = 0x202020;

const getMelody = () => {
  const urlMelody = urlParams.get("melody");
  if (urlMelody) {
    console.log("Custom melody loaded from URL");
    return decodeURIComponent(urlMelody);
  }
  return "";
};

const NOTES_DATA = Object.values(generateNoteRange(START_NOTE, END_NOTE)).map(
  (note) => ({
    id: note,
    type: note.includes("#") ? "black" : "white",
  }),
);

// --- DYNAMIC DIMENSIONS & SCROLLING ---
const VISIBLE_KEYS = 10;
const TOTAL_WHITE_KEYS = NOTES_DATA.filter((n) => n.type === "white").length;
const AVAILABLE_WIDTH = WIDTH * 0.95;

const WHITE_KEY_WIDTH = WIDTH / VISIBLE_KEYS;
const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;

const TOTAL_PIANO_WIDTH = TOTAL_WHITE_KEYS * WHITE_KEY_WIDTH;

const WHITE_KEY_HEIGHT = 180;
const BLACK_KEY_HEIGHT = WHITE_KEY_HEIGHT * 0.5;

// --- SETUP PIXI & STATE ---
const app = new PIXI.Application();
const gameContainer = new PIXI.Container();

// World Container holds the scrolling elements (Keys + Notes)
const worldContainer = new PIXI.Container();
const keysContainer = new PIXI.Container();
const notesContainer = new PIXI.Container();
const uiContainer = new PIXI.Container();

const pianoKeys = [];
const activeNotes = [];

// UI Elements
let playButton;
let loadingText;
let openButton;
let shareButton;

// Sequencer State
let parsedMelody = [];
let melodyIndex = 0;
let timeSinceLastNote = 0;
let timeUntilNextNote = 0;
let isGameActive = false;
let isSongFinished = false;

// Game State
let isDemoPlaying = false;
let hasDemoPlayed = false;

// Camera State
let targetCameraX = 0;

// Constants
const NOTE_HEIGHT = 40;
const NOTE_GAP = 5;
const NOTE_CLEARANCE = NOTE_HEIGHT + NOTE_GAP;
const HIT_ZONE = 2 * NOTE_HEIGHT;
const COLOR_NOTE_READY = 0xffff00;

// --- FILE OPEN LOGIC ---
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".mid,.midi";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (openButton) {
    openButton.visible = false;
  }
  loadingText.text = "Parsing MIDI...";
  loadingText.visible = true;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const minMidi = noteNameToMidi(START_NOTE);
    const maxMidi = noteNameToMidi(END_NOTE);

    const { bpm, melody } = await convertMidiToUrlData(
      arrayBuffer,
      minMidi,
      maxMidi,
    );

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("bpm", bpm);
    newUrl.searchParams.set("melody", melody);
    window.location.href = newUrl.toString();
  } catch (err) {
    console.error(err);
    alert("Failed to parse MIDI file.");
    loadingText.visible = false;
    playButton.visible = true;
  }
});

// --- PIANO GENERATION ---
function createPiano() {
  let whiteKeyIndex = 0;
  const yPos = HEIGHT - WHITE_KEY_HEIGHT - 20;

  // 0. Draw Visual Hit Line (Full Width)
  const hitLine = new PIXI.Graphics();
  hitLine.moveTo(0, yPos + 2);
  hitLine.lineTo(WIDTH, yPos + 2);
  hitLine.stroke({ width: 6, color: 0xcc0000 });
  uiContainer.addChild(hitLine);

  // 1. Draw White Keys
  NOTES_DATA.forEach((note, index) => {
    if (note.type === "white") {
      const x = whiteKeyIndex * WHITE_KEY_WIDTH;
      const rect = new PIXI.Graphics();
      rect.roundRect(0, 0, WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT, 6);

      rect.fill(0xffffff);
      rect.stroke({ width: 2, color: 0x000000 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";
      rect.tint = COLOR_WHITE_KEY;

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
        audioNode: null,
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
      const x = currentWhiteIndex * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
      const rect = new PIXI.Graphics();
      rect.roundRect(0, 0, BLACK_KEY_WIDTH, BLACK_KEY_HEIGHT, 3);
      rect.fill(0xffffff);
      rect.tint = COLOR_BLACK_KEY;
      rect.stroke({ width: 1, color: 0x555555 });
      rect.x = x;
      rect.y = yPos;
      rect.eventMode = "static";
      rect.cursor = "pointer";

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

// Helper to center camera immediately, snapping to grid
function centerCameraOnIndex(index, immediate = false) {
  if (!pianoKeys[index]) return;
  const keyX = pianoKeys[index].x;

  // Calculate center position
  let rawTarget = -keyX + WIDTH / 2;

  // Snap to grid
  targetCameraX = Math.round(rawTarget / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;

  // Clamp
  const maxScroll = -(TOTAL_PIANO_WIDTH - WIDTH);
  if (targetCameraX > 0) targetCameraX = 0;
  if (targetCameraX < maxScroll)
    targetCameraX = Math.floor(maxScroll / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;

  if (immediate) {
    worldContainer.x = targetCameraX;
  }
}

// Helper to center camera based on the range of notes used in melody
function alignCameraToMelodyRange() {
  if (parsedMelody.length === 0) {
    centerCameraOnIndex(Math.floor(pianoKeys.length / 2), true);
    return;
  }

  let minIndex = Infinity;
  let maxIndex = -Infinity;
  let found = false;

  parsedMelody.forEach((n) => {
    if (n.id) {
      const idx = NOTES_DATA.findIndex((nd) => nd.id === n.id);
      if (idx !== -1) {
        if (idx < minIndex) minIndex = idx;
        if (idx > maxIndex) maxIndex = idx;
        found = true;
      }
    }
  });

  if (found) {
    // Find the midpoint index between the lowest and highest note used
    const midIndex = Math.floor((minIndex + maxIndex) / 2);
    centerCameraOnIndex(midIndex, true);
  } else {
    centerCameraOnIndex(Math.floor(pianoKeys.length / 2), true);
  }
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

  const btnStyle = {
    ...style,
    fontSize: 24,
    stroke: { color: 0x000000, width: 2 },
  };
  const paddingX = 40;
  const paddingY = 20;

  loadingText = new PIXI.Text({ text: "Loading Sounds...", style });
  loadingText.x = WIDTH / 2;
  loadingText.y = HEIGHT / 2 - 50;
  loadingText.anchor.set(0.5);
  uiContainer.addChild(loadingText);

  // Play Button
  playButton = new PIXI.Container();
  playButton.x = WIDTH / 2;
  playButton.y = HEIGHT / 2 - 100;
  playButton.visible = false;
  playButton.eventMode = "static";
  playButton.cursor = "pointer";

  const playBtnText = new PIXI.Text({
    text: "▶️  Play Melody",
    style: btnStyle,
  });
  playBtnText.anchor.set(0.5);

  const playBg = new PIXI.Graphics();
  playBg.roundRect(
    -playBtnText.width / 2 - paddingX / 2,
    -playBtnText.height / 2 - paddingY / 2,
    playBtnText.width + paddingX,
    playBtnText.height + paddingY,
    10,
  );
  playBg.fill({ color: 0x000000, alpha: 0.8 });
  playBg.stroke({ width: 2, color: 0xffffff });

  playButton.addChild(playBg);
  playButton.addChild(playBtnText);
  playButton.on("pointerdown", () => {
    if (DEMO_MODE && !hasDemoPlayed) {
      startDemo();
    } else {
      resetGame();
    }
  });
  uiContainer.addChild(playButton);

  // Open Button
  openButton = new PIXI.Container();
  openButton.x = WIDTH / 2;
  openButton.y = HEIGHT / 2 - 100;
  openButton.visible = false;
  openButton.eventMode = "static";
  openButton.cursor = "pointer";

  const openBtnText = new PIXI.Text({
    text: "📂 Open MIDI File",
    style: btnStyle,
  });
  openBtnText.anchor.set(0.5);

  const openBg = new PIXI.Graphics();
  openBg.roundRect(
    -openBtnText.width / 2 - paddingX / 2,
    -openBtnText.height / 2 - paddingY / 2,
    openBtnText.width + paddingX,
    openBtnText.height + paddingY,
    10,
  );
  openBg.fill({ color: 0x000000, alpha: 0.8 });
  openBg.stroke({ width: 2, color: 0xffffff });

  openButton.addChild(openBg);
  openButton.addChild(openBtnText);
  openButton.on("pointerdown", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  uiContainer.addChild(openButton);

  // Share Button
  shareButton = new PIXI.Container();
  shareButton.x = WIDTH / 2;
  shareButton.y = HEIGHT / 2 - 35;
  shareButton.visible = false;
  shareButton.eventMode = "static";
  shareButton.cursor = "pointer";

  const shareText = new PIXI.Text({
    text: "🔗",
    style: { ...btnStyle, fontSize: 30 },
  });
  shareText.anchor.set(0.5);

  const shareBg = new PIXI.Graphics();
  shareBg.roundRect(-25, -25, 50, 50, 10);
  shareBg.fill({ color: 0x000000, alpha: 0.8 });
  shareBg.stroke({ width: 2, color: 0xffffff });

  shareButton.addChild(shareBg);
  shareButton.addChild(shareText);
  shareButton.on("pointerdown", async () => {
    let url = window.location.href;
    url = url.replace(/%7E/g, "~");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Rhythm Piano", text: "", url: url });
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("URL copied to clipboard!");
      } catch (err) {}
    }
  });
  uiContainer.addChild(shareButton);
}

// --- GAME LOGIC ---
function resetGame() {
  melodyIndex = 0;
  timeSinceLastNote = 0;
  timeUntilNextNote = 0;
  isSongFinished = false;
  isDemoPlaying = false;

  for (const note of activeNotes) {
    notesContainer.removeChild(note);
  }
  activeNotes.length = 0;

  playButton.visible = false;
  openButton.visible = false;
  shareButton.visible = false;

  // Align camera to song range
  alignCameraToMelodyRange();

  initAudio();
  isGameActive = true;
}

function startDemo() {
  melodyIndex = 0;
  timeSinceLastNote = 0;
  timeUntilNextNote = 0;
  isSongFinished = false;
  isDemoPlaying = true;
  hasDemoPlayed = true;

  for (const note of activeNotes) {
    notesContainer.removeChild(note);
  }
  activeNotes.length = 0;

  playButton.visible = false;
  openButton.visible = false;
  shareButton.visible = false;

  // Align camera to song range
  alignCameraToMelodyRange();

  initAudio();
  isGameActive = true;
}

function resetToMenu() {
  isGameActive = false;
  playButton.visible = true;
  shareButton.visible = true;
}

function spawnNote(noteData) {
  const index = NOTES_DATA.findIndex((n) => n.id === noteData.id);
  if (index === -1) return;

  const targetKey = pianoKeys[index];
  const note = new PIXI.Graphics();
  const color = targetKey.data.type === "white" ? 0x00ffff : 0xff00ff;

  const width = targetKey.width - 4;
  const distToNext = noteData.duration * FRAMES_PER_BEAT * SPEED;

  let topOffset = 0;
  if (distToNext < NOTE_CLEARANCE) {
    topOffset = NOTE_CLEARANCE - distToNext;
  }
  topOffset = Math.min(topOffset, NOTE_HEIGHT - 5);
  const finalHeight = NOTE_HEIGHT - topOffset;

  note.roundRect(-width / 2, topOffset, width, finalHeight, 4);
  note.fill(0xffffff);
  note.tint = color;

  note.x = targetKey.x;
  note.y = -100;
  note.targetIndex = index;
  note.active = true;
  note.id = noteData.id;
  note.originalColor = color;

  notesContainer.addChild(note);
  activeNotes.push(note);
}

function pressKey(index) {
  if (!isGameActive && !loadingText.visible && !openButton.visible) {
    resetGame();
    return;
  }

  const keyObj = pianoKeys[index];
  if (!keyObj) return;

  keyObj.graphic.tint = 0xffa500;

  if (keyObj.audioNode) {
    stopNote(keyObj.audioNode);
  }
  keyObj.audioNode = playNote(keyObj.data.id);

  if (!isGameActive) return;

  const hitLineY = keyObj.y;
  let minGlobalDistance = Infinity;

  for (const n of activeNotes) {
    if (n.active) {
      const dist = Math.abs(n.y - hitLineY);
      if (dist < minGlobalDistance) {
        minGlobalDistance = dist;
      }
    }
  }

  if (minGlobalDistance > HIT_ZONE) return;

  const CHORD_TOLERANCE = 10;
  let noteToHitIndex = -1;
  let minColDistance = Infinity;

  for (let i = 0; i < activeNotes.length; i++) {
    const n = activeNotes[i];
    if (n.targetIndex === index && n.active) {
      const dist = Math.abs(n.y - hitLineY);
      if (dist < HIT_ZONE) {
        if (dist <= minGlobalDistance + CHORD_TOLERANCE) {
          if (dist < minColDistance) {
            minColDistance = dist;
            noteToHitIndex = i;
          }
        }
      }
    }
  }

  if (noteToHitIndex !== -1) {
    const noteToRemove = activeNotes[noteToHitIndex];
    showHitEffect(keyObj.x, hitLineY);
    notesContainer.removeChild(noteToRemove);
    activeNotes.splice(noteToHitIndex, 1);
  }
}

function autoPlayNote(index) {
  const keyObj = pianoKeys[index];
  if (!keyObj) return;

  keyObj.graphic.tint = 0xffa500;
  const audioNode = playNote(keyObj.data.id);
  showHitEffect(keyObj.x, keyObj.y);

  setTimeout(() => {
    keyObj.graphic.tint = keyObj.originalColor;
    if (audioNode) {
      stopNote(audioNode, 1.0);
    }
  }, 150);
}

function releaseKey(index) {
  const keyObj = pianoKeys[index];
  if (!keyObj) return;
  keyObj.graphic.tint = keyObj.originalColor;
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
  // Add to worldContainer so it moves with the piano
  worldContainer.addChild(burst);

  let tick = 0;
  const animate = () => {
    tick++;
    burst.scale.set(1 + tick / 10);
    burst.alpha -= 0.1;
    if (burst.alpha <= 0) {
      worldContainer.removeChild(burst);
      app.ticker.remove(animate);
      burst.destroy();
    }
  };
  app.ticker.add(animate);
}

// --- UPDATE CAMERA LOGIC ---
function updateCamera() {
  if (!isGameActive) return;

  // 1. Identify "Nearest Relevant Note"
  let relevantKeyX = null;

  if (activeNotes.length > 0) {
    // Find closest note to bottom
    let maxY = -Infinity;
    let bottomNote = null;

    for (const n of activeNotes) {
      if (n.y > maxY) {
        maxY = n.y;
        bottomNote = n;
      }
    }
    if (bottomNote) {
      relevantKeyX = bottomNote.x;
    }
  } else if (parsedMelody.length > 0 && melodyIndex < parsedMelody.length) {
    // Look ahead if no active notes
    const noteId = parsedMelody[melodyIndex].id;
    const keyData = pianoKeys.find((k) => k.data.id === noteId);
    if (keyData) {
      relevantKeyX = keyData.x;
    }
  }

  if (relevantKeyX !== null) {
    // Current snaps
    const currentTargetX = targetCameraX;

    // Predicted screen position of the note
    const predictedScreenX = relevantKeyX + currentTargetX;

    // Margin: 1.5 keys from edge
    const margin = WHITE_KEY_WIDTH * 1.5;

    let needsShift = false;
    let rawNewTarget = currentTargetX;

    // Check Left Bound
    if (predictedScreenX < margin) {
      // Note is too far Left. Move view Right (increase worldX, make less negative/more positive)
      // predicted = relevant + newTarget >= margin
      // newTarget >= margin - relevant
      // To be minimal, we set it to exactly margin - relevant
      rawNewTarget = margin - relevantKeyX;

      // Snap: Since we are moving Right (WorldX increasing), we want to make sure
      // we snap to a grid line that is >= rawNewTarget to keep the note inside the margin.
      // Coordinate system: X is negative. Increasing X means moving closer to 0.
      // If raw is -550, and we round, we get -600 (left) or -500 (right).
      // -500 is > -550. -600 is < -550.
      // We want > -550. So we use Ceil.
      targetCameraX =
        Math.ceil(rawNewTarget / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;
    }
    // Check Right Bound
    else if (predictedScreenX > WIDTH - margin) {
      // Note is too far Right. Move view Left (decrease worldX, make more negative)
      // predicted = relevant + newTarget <= WIDTH - margin
      // newTarget <= WIDTH - margin - relevant
      rawNewTarget = WIDTH - margin - relevantKeyX;

      // Snap: We want newTarget <= raw. Use Floor.
      targetCameraX =
        Math.floor(rawNewTarget / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;
    }
  }

  // Clamp world bounds
  const maxScroll = -(TOTAL_PIANO_WIDTH - WIDTH);
  // Ensure strict clamp to grid
  const maxScrollSnapped =
    Math.floor(maxScroll / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;

  if (targetCameraX > 0) targetCameraX = 0;
  if (targetCameraX < maxScrollSnapped) targetCameraX = maxScrollSnapped;

  // Smooth movement
  worldContainer.x += (targetCameraX - worldContainer.x) * 0.05;
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

  const canvas = app.canvas;
  document.body.appendChild(canvas);

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  const preventDefault = (e) => e.preventDefault();
  canvas.addEventListener("touchstart", preventDefault, { passive: false });
  canvas.addEventListener("touchmove", preventDefault, { passive: false });
  canvas.addEventListener("touchend", preventDefault, { passive: false });

  app.stage.addChild(gameContainer);

  gameContainer.addChild(worldContainer);
  worldContainer.addChild(keysContainer);
  worldContainer.addChild(notesContainer);
  gameContainer.addChild(uiContainer);

  parsedMelody = parseABC(getMelody());

  createPiano();
  createUI();

  // Initial alignment
  alignCameraToMelodyRange();

  const resize = () => {
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;
    if (screenWidth === 0 || screenHeight === 0) return;

    const isPortrait = screenHeight > screenWidth;
    let scale;

    if (isPortrait) {
      scale = Math.min(screenHeight / WIDTH, screenWidth / HEIGHT);
      gameContainer.rotation = Math.PI / 2;
    } else {
      scale = Math.min(screenWidth / WIDTH, screenHeight / HEIGHT);
      gameContainer.rotation = 0;
    }

    gameContainer.scale.set(scale);
    gameContainer.pivot.set(WIDTH / 2, HEIGHT / 2);
    gameContainer.x = screenWidth / 2;
    gameContainer.y = screenHeight / 2;
  };

  app.renderer.on("resize", resize);
  resize();

  await cacheAllNoteSounds();

  loadingText.visible = false;
  playButton.visible = parsedMelody.length > 0;
  shareButton.visible = playButton.visible;
  openButton.visible = !playButton.visible;

  app.ticker.add((ticker) => {
    // Update Camera
    updateCamera();

    if (!isGameActive) return;

    let effectiveDelta = ticker.deltaTime;

    if (WAIT_MODE && !isDemoPlaying && activeNotes.length > 0) {
      const hitLineY = pianoKeys[0].y;
      const stopY = hitLineY - NOTE_HEIGHT;
      let minDistance = Infinity;

      for (const n of activeNotes) {
        const dist = stopY - n.y;
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      if (minDistance < 0) minDistance = 0;
      const maxAllowedDelta = minDistance / SPEED;

      if (maxAllowedDelta < effectiveDelta) {
        effectiveDelta = maxAllowedDelta;
      }
    }

    // 1. Melody Sequencer
    if (parsedMelody.length > 0 && melodyIndex < parsedMelody.length) {
      timeSinceLastNote += effectiveDelta;

      if (timeSinceLastNote >= timeUntilNextNote) {
        const noteData = parsedMelody[melodyIndex];

        if (noteData.id !== null) {
          spawnNote(noteData);
        }

        timeUntilNextNote = noteData.duration * FRAMES_PER_BEAT;
        timeSinceLastNote = 0;
        melodyIndex++;
      }
    } else if (parsedMelody.length > 0 && melodyIndex >= parsedMelody.length) {
      if (activeNotes.length === 0 && !isSongFinished) {
        isSongFinished = true;
        setTimeout(() => {
          resetToMenu();
        }, 1500);
      }
    }

    // 2. Physics
    const hitLineY = pianoKeys[0].y;

    if (isDemoPlaying) {
      for (let i = activeNotes.length - 1; i >= 0; i--) {
        const n = activeNotes[i];
        n.y += SPEED * effectiveDelta;

        if (n.y + NOTE_HEIGHT >= hitLineY) {
          autoPlayNote(n.targetIndex);
          notesContainer.removeChild(n);
          activeNotes.splice(i, 1);
        }
      }
    } else {
      let closestNote = null;
      let closestDist = Infinity;

      for (let i = activeNotes.length - 1; i >= 0; i--) {
        const n = activeNotes[i];
        n.y += SPEED * effectiveDelta;
        n.tint = n.originalColor;

        const missThreshold = hitLineY + 20;

        if (n.y > missThreshold) {
          notesContainer.removeChild(n);
          activeNotes.splice(i, 1);
          continue;
        }

        const dist = Math.abs(n.y - hitLineY);
        if (dist < closestDist) {
          closestDist = dist;
          closestNote = n;
        }
      }
      if (closestNote && closestDist < HIT_ZONE) {
        closestNote.tint = COLOR_NOTE_READY;
      }
    }
  });
}

initGame();

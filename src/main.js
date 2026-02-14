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
// 1. Rename to ORIGINAL_BPM to allow dynamic calculation
const ORIGINAL_BPM = parseInt(urlParams.get("bpm")) || 100;
const SPEED = parseInt(urlParams.get("speed")) || 4;

const START_NOTE = "A0";
const END_NOTE = "C8";

// 2. State for Slow Mode
let isHalfSpeed = false;

// 3. Helper functions to get current timing
const getCurrentBpm = () => (isHalfSpeed ? ORIGINAL_BPM / 2 : ORIGINAL_BPM);
const getFramesPerBeat = () => ((60 / getCurrentBpm()) * 60) / 2;

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

const getAccompaniment = () => {
  const urlAccomp = urlParams.get("accompaniment");
  if (urlAccomp) {
    return decodeURIComponent(urlAccomp);
  }
  return "";
};

const getTitle = () => {
  const urlTitle = urlParams.get("title");
  if (urlTitle) {
    return decodeURIComponent(urlTitle);
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
let menuContainer; // Holds Play buttons
let loadingText;
let titleText;

// Sequencer State (Melody)
let parsedMelody = [];
let melodyIndex = 0;
let timeSinceLastNote = 0;
let timeUntilNextNote = 0;

// Sequencer State (Accompaniment)
let parsedAccompaniment = [];
let accompIndex = 0;
let timeSinceLastAccomp = 0;
let timeUntilNextAccomp = 0;

let isGameActive = false;
let isSongFinished = false;
let isWaitMode = true;

// Game State
let isDemoPlaying = false;
let selectedTrackType = "melody"; // 'melody' or 'accompaniment'

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

  if (menuContainer) {
    menuContainer.visible = false;
  }
  if (titleText) {
    titleText.visible = false;
  }
  loadingText.text = "Parsing MIDI...";
  loadingText.visible = true;

  try {
    const arrayBuffer = await file.arrayBuffer();

    // Use raw filename (without extension) for query parameter
    const title = file.name.replace(/\.[^/.]+$/, "");

    const minMidi = noteNameToMidi(START_NOTE);
    const maxMidi = noteNameToMidi(END_NOTE);

    const { bpm, melody, accompaniment } = await convertMidiToUrlData(
      arrayBuffer,
      minMidi,
      maxMidi,
    );

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("title", title);
    newUrl.searchParams.set("bpm", bpm);
    newUrl.searchParams.set("melody", melody);

    if (accompaniment) {
      newUrl.searchParams.set("accompaniment", accompaniment);
    } else {
      newUrl.searchParams.delete("accompaniment");
    }
    window.location.href = newUrl.toString();
  } catch (err) {
    console.error(err);
    alert("Failed to parse MIDI file.");
    loadingText.visible = false;
    menuContainer.visible = true;
    if (titleText) titleText.visible = true;
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

function centerCameraOnIndex(index, immediate = false) {
  if (!pianoKeys[index]) return;
  const keyX = pianoKeys[index].x;
  let rawTarget = -keyX + WIDTH / 2;
  targetCameraX = Math.round(rawTarget / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;

  const maxScroll = -(TOTAL_PIANO_WIDTH - WIDTH);
  if (targetCameraX > 0) targetCameraX = 0;
  if (targetCameraX < maxScroll)
    targetCameraX = Math.floor(maxScroll / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;

  if (immediate) {
    worldContainer.x = targetCameraX;
  }
}

function alignCameraToActiveTrack() {
  const activeTrack =
    selectedTrackType === "melody" ? parsedMelody : parsedAccompaniment;

  if (activeTrack.length === 0) {
    centerCameraOnIndex(Math.floor(pianoKeys.length / 2), true);
    return;
  }

  let minIndex = Infinity;
  let maxIndex = -Infinity;
  let found = false;

  activeTrack.forEach((n) => {
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
    const midIndex = Math.floor((minIndex + maxIndex) / 2);
    centerCameraOnIndex(midIndex, true);
  } else {
    centerCameraOnIndex(Math.floor(pianoKeys.length / 2), true);
  }
}

/**
 * Creates a button with support for dynamic color updates.
 */
function createButton(text, x, y, onClick, size = 60, initialColor = 0x333333) {
  const container = new PIXI.Container();
  container.x = x;
  container.y = y;
  container.eventMode = "static";
  container.cursor = "pointer";
  container.baseColor = initialColor;

  const bg = new PIXI.Graphics();
  container.addChild(bg);

  // Helper function to redraw the background
  const render = (color, alpha) => {
    bg.clear();
    bg.roundRect(-size / 2, -size / 2, size, size, 12);
    bg.fill({ color: color, alpha: alpha });
    bg.stroke({ width: 3, color: 0xffffff });
  };

  // Initial Draw
  render(initialColor, 0.9);

  const style = {
    fontFamily: "Arial",
    fontSize: size * 0.5,
    fill: 0xffffff,
    align: "center",
  };

  const textObj = new PIXI.Text({ text, style });
  textObj.anchor.set(0.5);
  container.addChild(textObj);

  // Expose method to update color externally
  container.updateColor = (color) => {
    container.baseColor = color;
    render(color, 1.0);
  };

  container.on("pointertap", (e) => onClick(e, container));

  container.on("pointerover", () => {
    render(container.baseColor, 1.0);
    container.scale.set(1.1);
  });
  container.on("pointerout", () => {
    render(container.baseColor, 0.9);
    container.scale.set(1.0);
  });

  return container;
}

function createUI() {
  const style = {
    fontFamily: "Arial",
    fontSize: 32,
    fill: 0xffffff,
    align: "center",
    fontWeight: "bold",
    stroke: { color: 0x000000, width: 4 },
  };

  loadingText = new PIXI.Text({ text: "Loading Sounds...", style });
  loadingText.x = WIDTH / 2;
  loadingText.y = HEIGHT / 2 - 80;
  loadingText.anchor.set(0.5);
  uiContainer.addChild(loadingText);

  // Title rendering
  const title = getTitle();
  if (title) {
    const titleStyle = {
      fontFamily: "Arial",
      fontSize: 32,
      fill: 0xffffff,
      align: "center",
      fontWeight: "bold",
      stroke: { color: 0x000000, width: 4 },
    };
    const displayTitle = title
      // Handle standard camelCase (e.g., "myTitle" -> "my Title")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Handle consecutive caps followed by lowercase (e.g., "GMajor" -> "G Major")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
    titleText = new PIXI.Text({ text: displayTitle, style: titleStyle });
    titleText.x = WIDTH / 2;
    titleText.y = 20;
    titleText.anchor.set(0.5, 0); // Top-center
    uiContainer.addChild(titleText);
  }

  // --- MENU CONTAINER ---
  menuContainer = new PIXI.Container();
  menuContainer.visible = false;
  uiContainer.addChild(menuContainer);

  const buttonConfigs = [];

  // 1. Play Melody (🎵)
  if (parsedMelody.length > 0) {
    buttonConfigs.push({
      text: "🎵",
      onClick: () => {
        selectedTrackType = "melody";
        resetGame();
      },
    });
  }

  // 2. Play Accompaniment (🎹)
  if (parsedAccompaniment.length > 0) {
    buttonConfigs.push({
      text: "🎹",
      onClick: () => {
        selectedTrackType = "accompaniment";
        resetGame();
      },
    });
  }

  // 3. Demo Play (▶️)
  if (parsedMelody.length > 0) {
    buttonConfigs.push({
      text: "▶️",
      onClick: () => {
        selectedTrackType = "melody";
        startDemo();
      },
    });
  }

  // 4. Load MIDI (📂)
  if (parsedMelody.length === 0) {
    buttonConfigs.push({
      text: "📂",
      onClick: (e) => {
        e.stopPropagation();
        fileInput.click();
      },
    });
  }

  // Only show these controls if a melody is actually loaded
  if (parsedMelody.length > 0) {
    // 5. Wait Mode Toggle (⏳)
    buttonConfigs.push({
      text: "⏳",
      isToggle: true,
      initialState: isWaitMode,
      onClick: (e, btnContainer) => {
        e.stopPropagation();
        isWaitMode = !isWaitMode;

        // Update Visuals by redrawing
        const newColor = isWaitMode ? 0x2e8b57 : 0x333333; // Green vs Default
        btnContainer.updateColor(newColor);
      },
    });

    // 6. Slow Mode Toggle (🐢)
    buttonConfigs.push({
      text: "🐢",
      isToggle: true,
      initialState: isHalfSpeed,
      onClick: (e, btnContainer) => {
        e.stopPropagation();
        isHalfSpeed = !isHalfSpeed;

        // Update Visuals by redrawing
        const newColor = isHalfSpeed ? 0x2e8b57 : 0x333333; // Green (Active) vs Default
        btnContainer.updateColor(newColor);
      },
    });

    // 7. Share (🔗)
    buttonConfigs.push({
      text: "🔗",
      onClick: async () => {
        let url = window.location.href;
        url = url.replace(/%7E/g, "~");
        if (navigator.share) {
          try {
            await navigator.share({
              title: "Rhythm Piano",
              text: "",
              url: url,
            });
          } catch (err) {}
        } else {
          try {
            await navigator.clipboard.writeText(url);
            alert("URL copied to clipboard!");
          } catch (err) {}
        }
      },
    });
  }

  // Calculate layout to center items
  const btnSize = 70;
  const gap = 20;
  const totalWidth =
    buttonConfigs.length * btnSize + (buttonConfigs.length - 1) * gap;
  let currentX = WIDTH / 2 - totalWidth / 2 + btnSize / 2;
  const yPos = HEIGHT / 2 - 80;

  buttonConfigs.forEach((config) => {
    let initialColor = 0x333333;
    if (config.isToggle) {
      if (config.text === "⏳") {
        initialColor = config.initialState ? 0x2e8b57 : 0x333333;
      } else if (config.text === "🐢") {
        initialColor = config.initialState ? 0x2e8b57 : 0x333333;
      }
    }

    const btn = createButton(
      config.text,
      currentX,
      yPos,
      config.onClick,
      btnSize,
      initialColor,
    );
    menuContainer.addChild(btn);
    currentX += btnSize + gap;
  });
}

// --- GAME LOGIC ---
function resetGame() {
  melodyIndex = 0;
  timeSinceLastNote = 0;
  timeUntilNextNote = 0;
  accompIndex = 0;
  timeSinceLastAccomp = 0;
  timeUntilNextAccomp = 0;

  isSongFinished = false;
  isDemoPlaying = false;

  for (const note of activeNotes) {
    notesContainer.removeChild(note);
  }
  activeNotes.length = 0;

  menuContainer.visible = false;
  if (titleText) titleText.visible = false;
  alignCameraToActiveTrack();
  initAudio();
  isGameActive = true;
}

function startDemo() {
  melodyIndex = 0;
  timeSinceLastNote = 0;
  timeUntilNextNote = 0;
  accompIndex = 0;
  timeSinceLastAccomp = 0;
  timeUntilNextAccomp = 0;

  isSongFinished = false;
  isDemoPlaying = true;

  for (const note of activeNotes) {
    notesContainer.removeChild(note);
  }
  activeNotes.length = 0;

  menuContainer.visible = false;
  if (titleText) titleText.visible = false;
  alignCameraToActiveTrack();
  initAudio();
  isGameActive = true;
}

function resetToMenu() {
  isGameActive = false;
  menuContainer.visible = true;
  if (titleText) titleText.visible = true;
}

function spawnNote(noteData, isAccompaniment = false, offsetFrames = 0) {
  const index = NOTES_DATA.findIndex((n) => n.id === noteData.id);
  if (index === -1) return;

  const targetKey = pianoKeys[index];
  const note = new PIXI.Graphics();
  const color = targetKey.data.type === "white" ? 0x00ffff : 0xff00ff;

  const width = targetKey.width - 4;
  // 4. Use getFramesPerBeat() instead of constant
  const distToNext = noteData.duration * getFramesPerBeat() * SPEED;

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
  note.y = -100 + offsetFrames * SPEED;
  note.targetIndex = index;
  note.active = true;
  note.id = noteData.id;
  note.duration = noteData.duration;
  note.originalColor = color;
  note.isAccompaniment = isAccompaniment;

  if (isAccompaniment) {
    note.visible = false;
  }

  notesContainer.addChild(note);
  activeNotes.push(note);
}

function pressKey(index) {
  if (!isGameActive && !loadingText.visible) {
    if (parsedMelody.length > 0) {
      resetGame();
    }
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
    if (n.active && !n.isAccompaniment) {
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
    if (n.targetIndex === index && n.active && !n.isAccompaniment) {
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

function autoPlayNote(index, duration) {
  const keyObj = pianoKeys[index];
  if (!keyObj) return;

  keyObj.graphic.tint = 0xffa500;
  const audioNode = playNote(keyObj.data.id);
  showHitEffect(keyObj.x, keyObj.y);

  // 5. Use getCurrentBpm() for audio duration
  const ms = duration * (30000 / getCurrentBpm());
  const playDuration = Math.max(ms, 100);

  setTimeout(() => {
    keyObj.graphic.tint = keyObj.originalColor;
    if (audioNode) {
      stopNote(audioNode, 1.0);
    }
  }, playDuration);
}

function playBackingNote(index, duration) {
  const keyObj = pianoKeys[index];
  if (!keyObj) return;
  const audioNode = playNote(keyObj.data.id);
  if (audioNode) {
    // 6. Use getCurrentBpm() for audio duration
    const ms = duration * (30000 / getCurrentBpm());
    const playDuration = Math.max(ms, 100);
    setTimeout(() => {
      stopNote(audioNode, 1.0);
    }, playDuration);
  }
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

function updateCamera() {
  if (!isGameActive) return;

  let relevantKeyX = null;

  if (activeNotes.length > 0) {
    let maxY = -Infinity;
    let bottomNote = null;

    for (const n of activeNotes) {
      if (n.y > maxY && !n.isAccompaniment) {
        maxY = n.y;
        bottomNote = n;
      }
    }
    if (bottomNote) {
      relevantKeyX = bottomNote.x;
    }
  } else {
    const isMelodyActive = selectedTrackType === "melody";
    const currentList = isMelodyActive ? parsedMelody : parsedAccompaniment;
    const currentIndex = isMelodyActive ? melodyIndex : accompIndex;

    if (currentList.length > 0 && currentIndex < currentList.length) {
      const noteId = currentList[currentIndex].id;
      const keyData = pianoKeys.find((k) => k.data.id === noteId);
      if (keyData) {
        relevantKeyX = keyData.x;
      }
    }
  }

  if (relevantKeyX !== null) {
    const currentTargetX = targetCameraX;
    const predictedScreenX = relevantKeyX + currentTargetX;
    const margin = WHITE_KEY_WIDTH * 1.5;

    let rawNewTarget = currentTargetX;

    if (predictedScreenX < margin) {
      rawNewTarget = margin - relevantKeyX;
      targetCameraX =
        Math.ceil(rawNewTarget / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;
    } else if (predictedScreenX > WIDTH - margin) {
      rawNewTarget = WIDTH - margin - relevantKeyX;
      targetCameraX =
        Math.floor(rawNewTarget / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;
    }
  }

  const maxScroll = -(TOTAL_PIANO_WIDTH - WIDTH);
  const maxScrollSnapped =
    Math.floor(maxScroll / WHITE_KEY_WIDTH) * WHITE_KEY_WIDTH;

  if (targetCameraX > 0) targetCameraX = 0;
  if (targetCameraX < maxScrollSnapped) targetCameraX = maxScrollSnapped;

  worldContainer.x += (targetCameraX - worldContainer.x) * 0.05;
}

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
  worldContainer.addChild(notesContainer);
  worldContainer.addChild(keysContainer);
  gameContainer.addChild(uiContainer);

  parsedMelody = parseABC(getMelody());
  parsedAccompaniment = parseABC(getAccompaniment());

  createPiano();
  createUI();

  alignCameraToActiveTrack();

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
  menuContainer.visible = true;

  app.ticker.add((ticker) => {
    updateCamera();

    if (!isGameActive) return;

    let effectiveDelta = ticker.deltaTime;

    if (isWaitMode && !isDemoPlaying && activeNotes.length > 0) {
      const hitLineY = pianoKeys[0].y;
      const stopY = hitLineY - NOTE_HEIGHT;
      let minDistance = Infinity;

      for (const n of activeNotes) {
        if (!n.isAccompaniment) {
          const dist = stopY - n.y;
          if (dist < minDistance) {
            minDistance = dist;
          }
        }
      }

      if (minDistance < 0) minDistance = 0;
      const maxAllowedDelta = minDistance / SPEED;

      if (maxAllowedDelta < effectiveDelta) {
        effectiveDelta = maxAllowedDelta;
      }
    }

    const isMelodyInteractive = selectedTrackType === "melody";

    if (parsedMelody.length > 0 && melodyIndex < parsedMelody.length) {
      timeSinceLastNote += effectiveDelta;

      while (
        timeSinceLastNote >= timeUntilNextNote &&
        melodyIndex < parsedMelody.length
      ) {
        timeSinceLastNote -= timeUntilNextNote;
        const noteData = parsedMelody[melodyIndex];
        if (noteData.id !== null) {
          spawnNote(noteData, !isMelodyInteractive, timeSinceLastNote);
        }
        // 7. Use getFramesPerBeat() for loop logic
        timeUntilNextNote = noteData.duration * getFramesPerBeat();
        melodyIndex++;
        if (timeUntilNextNote <= 0) timeUntilNextNote = 0.1;
      }
    }

    if (
      parsedAccompaniment.length > 0 &&
      accompIndex < parsedAccompaniment.length
    ) {
      timeSinceLastAccomp += effectiveDelta;

      while (
        timeSinceLastAccomp >= timeUntilNextAccomp &&
        accompIndex < parsedAccompaniment.length
      ) {
        timeSinceLastAccomp -= timeUntilNextAccomp;
        const noteData = parsedAccompaniment[accompIndex];
        if (noteData.id !== null) {
          spawnNote(noteData, isMelodyInteractive, timeSinceLastAccomp);
        }
        // 8. Use getFramesPerBeat() for loop logic
        timeUntilNextAccomp = noteData.duration * getFramesPerBeat();
        accompIndex++;
        if (timeUntilNextAccomp <= 0) timeUntilNextAccomp = 0.1;
      }
    }

    const melodyEnded = melodyIndex >= parsedMelody.length;
    const accompEnded =
      parsedAccompaniment.length === 0 ||
      accompIndex >= parsedAccompaniment.length;

    if (parsedMelody.length > 0 && melodyEnded && accompEnded) {
      if (activeNotes.length === 0 && !isSongFinished) {
        isSongFinished = true;
        setTimeout(() => {
          resetToMenu();
        }, 1500);
      }
    }

    const hitLineY = pianoKeys[0].y;

    for (let i = activeNotes.length - 1; i >= 0; i--) {
      const n = activeNotes[i];
      n.y += SPEED * effectiveDelta;

      if (n.isAccompaniment) {
        if (n.y + NOTE_HEIGHT >= hitLineY) {
          playBackingNote(n.targetIndex, n.duration);
          notesContainer.removeChild(n);
          activeNotes.splice(i, 1);
        }
        continue;
      }

      if (isDemoPlaying) {
        if (n.y + NOTE_HEIGHT >= hitLineY) {
          autoPlayNote(n.targetIndex, n.duration);
          notesContainer.removeChild(n);
          activeNotes.splice(i, 1);
        }
      } else {
        n.tint = n.originalColor;
        const missThreshold = hitLineY + 20;

        if (n.y > missThreshold) {
          notesContainer.removeChild(n);
          activeNotes.splice(i, 1);
          continue;
        }

        const dist = Math.abs(n.y - hitLineY);
        if (dist < HIT_ZONE) {
          n.tint = COLOR_NOTE_READY;
        }
      }
    }
  });
}

initGame();

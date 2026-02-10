const fs = require("fs");
const { Midi } = require("@tonejs/midi");

const BASE_URL = "https://iliagrigorevdev.github.io/rhythmpiano/";

// Check arguments
const filePath = process.argv[2];
if (!filePath) {
  console.error("Please provide a MIDI file path.");
  console.error("Usage: npm run midi <path-to-midi-file>");
  process.exit(1);
}

try {
  const midiData = fs.readFileSync(filePath);
  const midi = new Midi(midiData);

  // Extract base BPM (Default to 120 if missing)
  let bpm = Math.round(midi.header.tempos[0]?.bpm || 120);

  // Process First Track Only
  const track = midi.tracks[0];
  if (!track) {
    console.error("No tracks found in MIDI file.");
    process.exit(1);
  }

  const ppq = midi.header.ppq;

  // Sort notes by time, then by pitch descending (highest first)
  // This ensures that when we filter for the "leading" note of a chord, we pick the melody note.
  track.notes.sort((a, b) => {
    if (a.ticks === b.ticks) return b.midi - a.midi;
    return a.ticks - b.ticks;
  });

  // 1. Collect all events (Notes and Rests) with raw durations
  const events = [];
  let lastTick = 0;
  let lastNoteStart = -1; // Track start tick of last processed note to detect chords

  track.notes.forEach((note) => {
    // Skip notes that start at the same time as the last processed note (handle chords)
    if (note.ticks === lastNoteStart) return;
    lastNoteStart = note.ticks;

    // A. Handle Rests (Time gaps)
    const gapTicks = note.ticks - lastTick;
    if (gapTicks > 0) {
      const gapDuration = (gapTicks / ppq) * 2;
      // Filter out tiny gaps (floating point noise)
      if (gapDuration > 0.05) {
        events.push({ type: "rest", duration: gapDuration });
      }
    }

    // B. Handle Note
    const noteDuration = (note.durationTicks / ppq) * 2;
    events.push({
      type: "note",
      midi: note.midi,
      duration: noteDuration,
    });

    // Update cursor
    lastTick = note.ticks + note.durationTicks;
  });

  // 2. Find the best multiplier (1x, 2x, 3x, 4x) to make durations integers
  let bestMultiplier = 4; // Default to max allowed if no perfect fit found

  // We check multipliers 1, 2, 3, 4 sequentially.
  // We accept a multiplier if all event durations become integers (within a small tolerance).
  for (let m = 1; m <= 4; m++) {
    const isClean = events.every((e) => {
      const scaled = e.duration * m;
      const rounded = Math.round(scaled);
      return Math.abs(scaled - rounded) < 0.05; // Tolerance for MIDI tick jitter
    });

    if (isClean) {
      bestMultiplier = m;
      break;
    }
  }

  // 3. Apply multiplier to BPM
  bpm = bpm * bestMultiplier;

  // 4. Generate ABC String using the multiplier
  let abcString = "";
  const MIN_MIDI = 53; // F3
  const MAX_MIDI = 76; // E5

  events.forEach((event) => {
    // Scale and strictly round to integer
    const finalDuration = Math.round(event.duration * bestMultiplier);

    // If rounding resulted in 0 (extremely short note), skip it
    if (finalDuration === 0) return;

    if (event.type === "rest") {
      abcString += `z${formatIntegerDuration(finalDuration)}`;
    } else {
      let currentMidi = event.midi;

      // Shift octave up if too low
      while (currentMidi < MIN_MIDI) {
        currentMidi += 12;
      }
      // Shift octave down if too high
      while (currentMidi > MAX_MIDI) {
        currentMidi -= 12;
      }

      const noteString = getABCNoteName(currentMidi);
      abcString += `${noteString}${formatIntegerDuration(finalDuration)}`;
    }
  });

  // Output formatted for URL
  console.log(`${BASE_URL}?bpm=${bpm}&melody=${abcString}`);
} catch (e) {
  console.error("Error parsing MIDI file:", e.message);
}

/**
 * Formats duration number for integer-only output.
 * Omits "1" as per ABC standard simplification.
 */
function formatIntegerDuration(val) {
  return val === 1 ? "" : val.toString();
}

/**
 * Converts MIDI note number (0-127) to ABC Notation
 * strict to the project's parser rules (C4 base, no key signature state).
 */
function getABCNoteName(midi) {
  const noteIndex = midi % 12;
  const octaveIndex = Math.floor(midi / 12) - 1; // MIDI 60 (C4) -> Octave 4

  const flatNames = [
    "C",
    "_D",
    "D",
    "_E",
    "E",
    "F",
    "_G",
    "G",
    "_A",
    "A",
    "_B",
    "B",
  ];

  let baseName = flatNames[noteIndex];
  let finalName = "";

  if (octaveIndex === 4) {
    finalName = baseName;
  } else if (octaveIndex === 5) {
    finalName = baseName.toLowerCase();
  } else if (octaveIndex < 4) {
    finalName = baseName;
    const diff = 4 - octaveIndex;
    for (let i = 0; i < diff; i++) finalName += ".";
  } else {
    // octaveIndex > 5
    finalName = baseName.toLowerCase();
    const diff = octaveIndex - 5;
    for (let i = 0; i < diff; i++) finalName += "'";
  }

  return finalName;
}

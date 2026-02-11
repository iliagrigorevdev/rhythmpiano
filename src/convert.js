import { Midi } from "@tonejs/midi";

/**
 * Converts an ArrayBuffer (from a MIDI file) into a URL-friendly ABC string and BPM.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{bpm: number, melody: string}>}
 */
export async function convertMidiToUrlData(arrayBuffer) {
  const midi = new Midi(arrayBuffer);

  // Extract base BPM (Default to 120 if missing)
  let bpm = Math.round(midi.header.tempos[0]?.bpm || 120);

  // Process First Track Only
  const track = midi.tracks[0];
  if (!track) {
    throw new Error("No tracks found in MIDI file.");
  }

  const ppq = midi.header.ppq;

  // Sort notes by time, then by pitch descending
  track.notes.sort((a, b) => {
    if (a.ticks === b.ticks) return b.midi - a.midi;
    return a.ticks - b.ticks;
  });

  // 1. Collect all events (Notes and Rests)
  const events = [];
  let lastTick = 0;
  let lastNoteStart = -1;

  track.notes.forEach((note) => {
    // Skip notes starting at same time (chords -> keep melody note only)
    if (note.ticks === lastNoteStart) return;
    lastNoteStart = note.ticks;

    // A. Handle Rests
    const gapTicks = note.ticks - lastTick;
    if (gapTicks > 0) {
      const gapDuration = (gapTicks / ppq) * 2;
      if (gapDuration > 0.05 && events.length > 0) {
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

    lastTick = note.ticks + note.durationTicks;
  });

  // 2. Find best multiplier to make durations integers
  let bestMultiplier = 4;
  for (let m = 1; m <= 4; m++) {
    const isClean = events.every((e) => {
      const scaled = e.duration * m;
      const rounded = Math.round(scaled);
      return Math.abs(scaled - rounded) < 0.05;
    });

    if (isClean) {
      bestMultiplier = m;
      break;
    }
  }

  // 3. Apply multiplier to BPM
  bpm = bpm * bestMultiplier;

  // 4. Generate ABC String
  let abcString = "";
  const MIN_MIDI = 53; // F3
  const MAX_MIDI = 76; // E5

  events.forEach((event) => {
    const finalDuration = Math.round(event.duration * bestMultiplier);
    if (finalDuration === 0) return;

    if (event.type === "rest") {
      abcString += `z${formatIntegerDuration(finalDuration)}`;
    } else {
      let currentMidi = event.midi;
      // Shift octave to fit range
      while (currentMidi < MIN_MIDI) currentMidi += 12;
      while (currentMidi > MAX_MIDI) currentMidi -= 12;

      const noteString = getABCNoteName(currentMidi);
      abcString += `${noteString}${formatIntegerDuration(finalDuration)}`;
    }
  });

  return { bpm, melody: abcString };
}

function formatIntegerDuration(val) {
  return val === 1 ? "" : val.toString();
}

function getABCNoteName(midi) {
  const noteIndex = midi % 12;
  const octaveIndex = Math.floor(midi / 12) - 1;

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
    finalName = baseName.toLowerCase();
    const diff = octaveIndex - 5;
    for (let i = 0; i < diff; i++) finalName += "'";
  }

  return finalName;
}

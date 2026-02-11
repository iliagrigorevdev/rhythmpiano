import { Midi } from "@tonejs/midi";

/**
 * Converts an ArrayBuffer (from a MIDI file) into a URL-friendly ABC string and BPM.
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} transpose - Semitones to transpose the melody by
 * @returns {Promise<{bpm: number, melody: string}>}
 */
export async function convertMidiToUrlData(arrayBuffer, transpose = 0) {
  const midi = new Midi(arrayBuffer);

  // Extract base BPM (Default to 120 if missing)
  const bpm = Math.round(midi.header.tempos[0]?.bpm || 120);

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
      // Filter tiny noise (threshold similar to quantization floor)
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

  // 2. Generate ABC String (Fractional support)
  let abcString = "";
  const MIN_MIDI = 53; // F3
  const MAX_MIDI = 76; // E5

  events.forEach((event) => {
    const durationString = formatAbcDuration(event.duration);
    if (durationString === null) return;

    if (event.type === "rest") {
      abcString += `z${durationString}`;
    } else {
      let currentMidi = event.midi + transpose;

      // Shift octave to fit range
      while (currentMidi < MIN_MIDI) currentMidi += 12;
      while (currentMidi > MAX_MIDI) currentMidi -= 12;

      const noteString = getABCNoteName(currentMidi);
      abcString += `${noteString}${durationString}`;
    }
  });

  return { bpm, melody: abcString };
}

/**
 * Formats a numeric duration into an ABC notation string (integer or fraction).
 * Assumes 1 unit = 1/8th note approx. Quantizes to nearest 1/4 unit (1/32nd).
 */
function formatAbcDuration(duration) {
  // Quantize to nearest 0.25
  const steps = Math.round(duration * 4);

  if (steps === 0) return null;
  if (steps === 4) return ""; // 1.0 (Unit length)

  // Integer case
  if (steps % 4 === 0) {
    return (steps / 4).toString();
  }

  // Half case (x.5) -> n/2
  if (steps % 2 === 0) {
    const num = steps / 2;
    return num === 1 ? "~" : `${num}~2`;
  }

  // Quarter case (x.25, x.75) -> n/4
  const num = steps;
  return num === 1 ? "~4" : `${num}~4`;
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

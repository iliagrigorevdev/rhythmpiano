import { Midi } from "@tonejs/midi";

/**
 * Converts an ArrayBuffer (from a MIDI file) into a URL-friendly ABC string and BPM.
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} minMidi - Lowest MIDI note allowed (inclusive)
 * @param {number} maxMidi - Highest MIDI note allowed (inclusive)
 * @returns {Promise<{bpm: number, melody: string, accompaniment: string}>}
 */
export async function convertMidiToUrlData(arrayBuffer, minMidi, maxMidi) {
  const midi = new Midi(arrayBuffer);

  // Extract base BPM (Default to 120 if missing)
  const bpm = Math.round(midi.header.tempos[0]?.bpm || 120);
  const ppq = midi.header.ppq;

  // Process First Track (Melody)
  const melodyTrack = midi.tracks[0];
  if (!melodyTrack) {
    throw new Error("No tracks found in MIDI file.");
  }
  // isAccompaniment = false (Keep highest note)
  const melody = convertTrackToAbc(melodyTrack, ppq, minMidi, maxMidi, false);

  // Process Second Track (Accompaniment) if exists
  let accompaniment = "";
  if (midi.tracks.length > 1) {
    // Find a suitable backing track (skip empty metadata tracks if any)
    let bestTrack = null;
    let maxNotes = 0;

    for (let i = 1; i < midi.tracks.length; i++) {
      if (midi.tracks[i].notes.length > maxNotes) {
        maxNotes = midi.tracks[i].notes.length;
        bestTrack = midi.tracks[i];
      }
    }

    if (bestTrack && bestTrack.notes.length > 0) {
      // isAccompaniment = true (Keep lowest note)
      accompaniment = convertTrackToAbc(bestTrack, ppq, minMidi, maxMidi, true);
    }
  }

  return { bpm, melody, accompaniment };
}

function convertTrackToAbc(
  track,
  ppq,
  minMidi,
  maxMidi,
  isAccompaniment = false,
) {
  // Sort notes by time.
  // For chords (same ticks):
  // - If Melody: Sort pitch Descending (b - a) to keep highest note.
  // - If Accompaniment: Sort pitch Ascending (a - b) to keep lowest note.
  track.notes.sort((a, b) => {
    if (a.ticks === b.ticks) {
      return isAccompaniment ? a.midi - b.midi : b.midi - a.midi;
    }
    return a.ticks - b.ticks;
  });

  const events = [];

  // Filter out chords (keep first note found based on sort order)
  const uniqueNotes = [];
  let lastTick = -1;
  track.notes.forEach((note) => {
    // Basic chord reduction: if start time is same as previous, skip
    if (Math.abs(note.ticks - lastTick) < 1) return;
    lastTick = note.ticks;
    uniqueNotes.push(note);
  });

  for (let i = 0; i < uniqueNotes.length; i++) {
    const note = uniqueNotes[i];
    const nextNote = uniqueNotes[i + 1];

    const currentStart = note.ticks;
    // Calculate available time slot until the next event starts
    // If last note, use its own duration
    const nextStart = nextNote
      ? nextNote.ticks
      : currentStart + note.durationTicks;

    const timeUntilNext = nextStart - currentStart;
    const noteDurationTicks = note.durationTicks;

    // Convert to musical time (approx 1 unit = 1/8th note)
    const timeSlot = (timeUntilNext / ppq) * 2;
    const actualDuration = (noteDurationTicks / ppq) * 2;

    // Skip excessively small glitches
    if (timeSlot <= 0.01) continue;

    // Logic: Ensure strict timeline sync by forcing total duration = timeSlot.
    // If actual note is shorter than slot -> Note + Rest.
    // If actual note is longer than slot (overlap) -> Truncate Note to slot.

    const tolerance = 0.05; // floating point tolerance

    if (actualDuration < timeSlot - tolerance) {
      // Staccato / Rest follows
      events.push({
        type: "note",
        midi: note.midi,
        duration: actualDuration,
      });
      events.push({
        type: "rest",
        duration: timeSlot - actualDuration,
      });
    } else {
      // Legato / Overlap -> Truncate to keep rhythm
      events.push({
        type: "note",
        midi: note.midi,
        duration: timeSlot,
      });
    }
  }

  // Generate ABC String
  let abcString = "";

  events.forEach((event) => {
    const durationString = formatAbcDuration(event.duration);
    if (!durationString && durationString !== "") return; // Skip if too small

    if (event.type === "rest") {
      abcString += `z${durationString}`;
    } else {
      let currentMidi = event.midi;

      // Shift octave to fit range
      while (currentMidi < minMidi) currentMidi += 12;
      while (currentMidi > maxMidi) currentMidi -= 12;

      const noteString = getABCNoteName(currentMidi);
      abcString += `${noteString}${durationString}`;
    }
  });

  return abcString;
}

/**
 * Formats a numeric duration into an ABC notation string (integer or fraction).
 * Assumes 1 unit = 1/8th note approx. Quantizes to nearest 1/4 unit (1/32nd).
 */
function formatAbcDuration(duration) {
  // Quantize to nearest 0.25
  const steps = Math.round(duration * 4);

  if (steps <= 0) return null;
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

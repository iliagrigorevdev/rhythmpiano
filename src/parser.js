/**
 * Parses ABC Notation string into a sequence of note objects.
 * Returns an array of objects: { id: "NoteID" | null, duration: Number }
 */
export function parseABC(abcString) {
  // 1. Clean string: remove bar lines |, whitespace, standardizing
  // Regex looks for: (accidental)(note)(octave)(duration)
  // Pattern: [^=_]? (optional accidental) [A-Ga-gz] (note) [,']* (octave modifiers) [\d\/]* (duration)
  const tokens = abcString.match(/[\^_]?[A-Ga-gz][,']*[\d\/]*/g);

  if (!tokens) return [];

  const result = [];

  tokens.forEach((token) => {
    // A. Parse Accidental
    let accidental = "";
    let remainder = token;

    if (token.startsWith("^")) {
      accidental = "#";
      remainder = token.substring(1);
    } else if (token.startsWith("_")) {
      accidental = "b"; // Flat
      remainder = token.substring(1);
    } else if (token.startsWith("=")) {
      remainder = token.substring(1); // Natural
    }

    // B. Parse Note Name & Octave
    // ABC Standard: C, = C3 | C = C4 | c = C5 | c' = C6
    const baseNoteChar = remainder.charAt(0);
    remainder = remainder.substring(1);

    let noteName = baseNoteChar.toUpperCase();
    let octave = 4; // Default C is C4

    if (baseNoteChar === "z") {
      noteName = "REST";
    } else {
      // Lowercase letters in ABC start at C5
      if (baseNoteChar === baseNoteChar.toLowerCase()) {
        octave = 5;
      }

      // Check for comma (octave down) or apostrophe (octave up)
      while (remainder.startsWith(",")) {
        octave--;
        remainder = remainder.substring(1);
      }
      while (remainder.startsWith("'")) {
        octave++;
        remainder = remainder.substring(1);
      }
    }

    // C. Parse Duration
    // default = 1, "2" = 2, "/2" = 0.5, "3/2" = 1.5
    let duration = 1.0;
    if (remainder.length > 0) {
      if (remainder.includes("/")) {
        const parts = remainder.split("/");
        const num = parts[0] === "" ? 1 : parseFloat(parts[0]);
        const den = parts[1] === "" ? 2 : parseFloat(parts[1]);
        duration = num / den;
      } else {
        duration = parseFloat(remainder);
      }
    }

    // D. Convert Flats to Sharps (Enharmonic equivalent)
    // The Game Engine (main.js) only has "#" keys defined in NOTES_DATA.
    if (accidental === "b" && noteName !== "REST") {
      const flatMap = {
        D: { note: "C", acc: "#" }, // Db -> C#
        E: { note: "D", acc: "#" }, // Eb -> D#
        G: { note: "F", acc: "#" }, // Gb -> F#
        A: { note: "G", acc: "#" }, // Ab -> G#
        B: { note: "A", acc: "#" }, // Bb -> A#
        C: { note: "B", acc: "", octaveShift: -1 }, // Cb -> B (prev octave)
        F: { note: "E", acc: "" }, // Fb -> E
      };

      const mapping = flatMap[noteName];
      if (mapping) {
        noteName = mapping.note;
        accidental = mapping.acc;
        if (mapping.octaveShift) {
          octave += mapping.octaveShift;
        }
      }
    }

    // E. Construct Game ID
    let finalId = null;

    if (noteName !== "REST") {
      // Now accidental is either "" or "#"
      finalId = `${noteName}${accidental}${octave}`;
    }

    result.push({
      id: finalId,
      duration: duration,
    });
  });

  return result;
}

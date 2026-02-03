const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

/**
 * Resumes the AudioContext if it is suspended (browser autoplay policy).
 */
export function resumeAudio() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

/**
 * Plays a sine wave tone at a specific frequency.
 * @param {number} freq - Frequency in Hertz
 */
export function playTone(freq) {
  // Ensure context is running before playing
  resumeAudio();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  // --- EQUAL LOUDNESS ADJUSTMENT ---
  // High frequencies sound naturally louder than low frequencies for sine waves.
  // We calculate volume inversely proportional to frequency.
  // Example:
  // - Low Note (F3, ~175Hz): 100/175 = ~0.57 gain (Boosted from original 0.3)
  // - High Note (E5, ~660Hz): 100/660 = ~0.15 gain (Attenuated from original 0.3)
  const volume = Math.min(0.6, 100 / freq);

  // Envelope: Attack fast, Decay exponential
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

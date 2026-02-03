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

  // Envelope: Attack fast, Decay exponential
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

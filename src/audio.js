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
 * Plays a synthesized piano-like tone.
 * Replaces the basic sine wave with a filtered sawtooth wave for a richer timbre.
 * @param {number} freq - Frequency in Hertz
 */
export function playTone(freq) {
  resumeAudio();

  const now = audioCtx.currentTime;
  const duration = 2.0; // Notes ring out longer for a better feel

  // 1. Create Nodes
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  // 2. Oscillator Setup
  // Sawtooth waves contain all integer harmonics, providing a rich starting sound
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, now);

  // 3. Filter Setup (Low-pass)
  // This simulates the "hammer strike": sound starts bright and gets duller
  filter.type = "lowpass";
  filter.Q.value = 0; // No resonance needed

  // Filter Envelope
  // Start cutoff high (bright) and decay quickly to the fundamental frequency
  const attackCutoff = freq * 6;
  const sustainCutoff = freq;

  filter.frequency.setValueAtTime(attackCutoff, now);
  // The brightness decays quickly (0.4s) mimicking the initial energy dissipation
  filter.frequency.exponentialRampToValueAtTime(sustainCutoff, now + 0.4);

  // 4. Amplitude (Volume) Envelope
  // Sawtooth waves are naturally louder than sine waves, so we use a lower base volume (0.2).
  const volume = 0.2;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02); // Fast attack (percussive)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Long exponential tail

  // 5. Connect the Graph: Oscillator -> Filter -> Gain -> Output
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  // 6. Play and Schedule Stop
  osc.start(now);
  osc.stop(now + duration);
}

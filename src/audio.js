const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let masterGain;
let reverbNode;

/**
 * Generates a synthetic impulse response for a "Hall" reverb effect.
 * This prevents needing to load an external .wav file.
 */
function createImpulseResponse(duration, decay, reverse) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = reverse ? length - i : i;
    // Generate noise with exponential decay
    let val = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    left[i] = val;
    right[i] = val;
  }
  return impulse;
}

/**
 * Initializes the Audio Context and Effects Chain.
 * Must be called after a user interaction.
 */
export function initAudioSystem() {
  if (audioCtx) return; // Already initialized

  audioCtx = new AudioContext();

  // 1. Create Master Gain (Volume Control)
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5; // Overall volume to prevent clipping

  // 2. Create Reverb (Convolver)
  reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = createImpulseResponse(2.0, 2.0, false); // 2 second tail
  reverbNode.normalize = true;

  // 3. Create a Dry/Wet Mix logic
  // Reverb connects to Master
  reverbNode.connect(masterGain);
  // Master connects to Speakers
  masterGain.connect(audioCtx.destination);
}

export function resumeAudio() {
  if (!audioCtx) initAudioSystem();
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

/**
 * Plays a synthesized "Electric Piano" tone.
 * Uses a Triangle wave processed through a Low Pass Filter.
 */
export function playTone(freq) {
  if (!audioCtx) initAudioSystem();
  resumeAudio();

  const t = audioCtx.currentTime;

  // --- NODES ---
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const env = audioCtx.createGain();
  const reverbSend = audioCtx.createGain();

  // --- CONFIGURATION ---

  // 1. Oscillator (Sound Source)
  osc.type = "triangle"; // Smoother than sine, richer than square
  osc.frequency.setValueAtTime(freq, t);

  // 2. Filter (Timbre) - Dynamic Low Pass
  // Starts bright (2x freq) and rapidly becomes dull, mimicking a string pluck
  filter.type = "lowpass";
  filter.Q.value = 1; // Slight resonance
  filter.frequency.setValueAtTime(freq * 4, t);
  filter.frequency.exponentialRampToValueAtTime(freq, t + 0.1);

  // 3. Envelope (Volume Shape) - ADSR
  // Attack (No click), Decay (Percussive), Sustain (None - simulates piano tap)
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.6, t + 0.02); // Fast attack
  env.gain.exponentialRampToValueAtTime(0.01, t + 1.0); // Long decay

  // 4. Reverb Send Amount
  reverbSend.gain.value = 0.3; // 30% Wet signal

  // --- CONNECTIONS ---
  // Signal Flow: Osc -> Filter -> Envelope -> Split(Master & Reverb)

  osc.connect(filter);
  filter.connect(env);

  // Dry path (Direct to master)
  env.connect(masterGain);

  // Wet path (To reverb)
  env.connect(reverbSend);
  reverbSend.connect(reverbNode);

  // --- PLAY ---
  osc.start(t);
  osc.stop(t + 1.5); // Stop after decay finishes to save CPU

  // Cleanup for garbage collection assistance
  setTimeout(() => {
    osc.disconnect();
    filter.disconnect();
    env.disconnect();
    reverbSend.disconnect();
  }, 1600);
}

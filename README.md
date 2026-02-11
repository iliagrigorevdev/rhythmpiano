# 🎹 Rhythm Piano

A web-based rhythm game and piano visualizer built with **Pixi.js** and the **Web Audio API**.

Play along to pre-programmed melodies using a falling-note interface (synthesia style), play the piano freely, or import your own MIDI files. The application parses melodies directly from URL parameters, allowing for easy sharing of songs without backend storage.

[**🚀 Launch Live Application**](https://iliagrigorevdev.github.io/rhythmpiano/)

## ✨ Features

- **Rhythm Game Mode**: Hit the keys when the falling notes reach the red judgment line.
- **▶️ Demo Mode**: Add `?demo=true` to the URL to watch the melody play automatically before you try it yourself.
- **📂 MIDI File Import**: Convert local `.mid` files into playable levels instantly. The app parses the MIDI client-side and updates the URL.
- **⏳ Wait Mode**: By default, the game pauses if a note reaches the line but hasn't been played, allowing you to learn the melody at your own pace.
- **Free Play**: Full 2-octave interactive piano when no melody is loaded.
- **PC Keyboard Support**: Play using your computer keyboard with a standard DAW-style layout (e.g., `A`, `S`, `D` for white keys; `W`, `E` for black keys).
- **Sample-Based Audio**: Uses realistic SFZ piano samples (Salamander Grand Piano) with dynamic pitch shifting for high performance.
- **URL-Based Level Sharing**: Melodies, BPM, and scroll speed are encoded entirely in the URL.
- **Responsive Design**: Scales to fit desktop and mobile screens.

## 🛠️ Usage & Configuration

### Importing MIDI Files

You can load your own `.mid` files to create levels automatically.

1. If no melody is loaded via the URL, the **"📂 Open MIDI File"** button will be visible. If a melody is loaded, the **"▶️ Play Melody"** button will be visible instead.
2. Click the **"📂 Open MIDI File"** button.
3. Select a simple MIDI file (Track 1 is used for the melody).

### URL Parameters

You can manually configure levels by modifying the URL.

| Parameter   | Description                                                    | Default |
| :---------- | :------------------------------------------------------------- | :------ |
| `bpm`       | Beats per minute.                                              | `100`   |
| `speed`     | Falling speed of notes in pixels per frame.                    | `4`     |
| `wait`      | `true` pauses game if note is missed. `false` lets notes pass. | `true`  |
| `demo`      | `true` enables an auto-play demo before the game.              | `false` |
| `melody`    | The encoded note sequence.                                     | `""`    |
| `transpose` | Shift MIDI import pitch by semitones (e.g. `12` or `-12`).     | `0`     |

### Melody Syntax

The app uses a custom parser (`src/parser.js`) that reads a simplified ABC-like notation.

- **Notes**: `C`, `D`, `E`, `F`, `G`, `A`, `B`.
- **Accidentals**: `_` (Flat).
- **Octaves**: `C` (C4/Middle C), `c` (C5), `C.` (C3).
- **Duration**: Number relative to an 8th note. `~` allows fractions (e.g., `3~2`).
- **Rests**: `z`.

**Example:**
`?bpm=120&melody=C2E2G2c4` (Major arpeggio)

## 💻 Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/iliagrigorevdev/rhythmpiano.git
   cd rhythmpiano
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## 🧰 Tech Stack

- **[Vite](https://vitejs.dev/)**: Frontend tooling and bundler.
- **[Pixi.js (v8)](https://pixijs.com/)**: High-performance 2D WebGL rendering.
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)**: Custom audio engine with SFZ parsing and pitch shifting.
- **[@tonejs/midi](https://github.com/Tonejs/Midi)**: MIDI file parsing and conversion.

## Credits

- **Audio Samples**: [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, licensed under Creative Commons Attribution 3.0.

## License

This project is licensed under the GPL-3.0 license - see the [LICENSE](LICENSE) file for details.

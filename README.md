# 🎹 Rhythm Piano

A web-based rhythm game and piano visualizer built with **Pixi.js** and the **Web Audio API**.

Play along to pre-programmed melodies using a falling-note interface (synthesia style), play the piano freely, or import your own MIDI files. The application parses melodies directly from URL parameters, allowing for easy sharing of songs without backend storage.

[**🚀 Launch Live Application**](https://iliagrigorevdev.github.io/rhythmpiano/)

## ✨ Features

- **Rhythm Game Mode**: Hit the keys when the falling notes reach the red judgment line. You can play either the melody or the accompaniment track.
- **Accompaniment Track**: The app can load a secondary track from a MIDI file, which plays automatically in the background, allowing you to play the main melody along with a backing track.
- **▶️ Demo Mode**: Click the Play button in the menu to watch the melody play automatically before you try it yourself.
- **📂 MIDI File Import**: Convert local `.mid` files into playable levels. The app automatically separates the melody (first track, highest note in chords) and accompaniment (second track, lowest note in chords).
- **⏳ Wait Mode**: Toggleable via the menu. By default, the game pauses if a note reaches the line but hasn't been played, allowing you to learn the melody at your own pace.
- **Slow Mode (🐢)**: Reduces the tempo to 50% speed. Useful for practicing fast or complex sections.
- **Auto-Scrolling Camera**: The view automatically pans to follow the active notes, ensuring the next keys you need are always in sight.
- **Piano Range**: The interactive piano covers the full 88-key range of a grand piano (A0 to C8).
- **Sample-Based Audio**: Uses realistic SFZ piano samples (Salamander Grand Piano) with dynamic pitch shifting for high performance.
- **URL-Based Level Sharing**: Melodies, BPM, accompaniment, and scroll speed are encoded entirely in the URL. A "🔗" share button makes it easy to copy or share the link.
- **Responsive Design**: Scales to fit desktop and mobile screens.

## 🛠️ Usage & Configuration

### UI & Controls

When a song is loaded, the following options are available:

- **🎵 Play Melody**: Start the game with the melody track as the active (playable) part. The accompaniment will play automatically in the background.
- **🎹 Play Accompaniment**: Start the game with the accompaniment track as the active part. The melody will play automatically.
- **▶️ Demo Play**: Watch the song play automatically.
- **📂 Open MIDI File**: Opens a file dialog to import a new `.mid` file.
- **⏳ Wait Mode**: Toggle the wait mechanic. Green (enabled) pauses the game for missed notes; Red (disabled) lets the song continue flowing.
- **🔗 Share**: Copies the full URL (including the song) to your clipboard for easy sharing.

If no song is loaded, only the **"📂 Open MIDI File"** button is shown.

### Importing MIDI Files

You can load your own `.mid` files to create levels automatically.

1. Click the **"📂 Open MIDI File"** button.
2. Select a MIDI file. The app will process it:
   - **Track 1** is treated as the **melody**. For chords, the highest note is kept.
   - **Track 2** (or the next available track) is treated as the **accompaniment**. For chords, the lowest note is kept.
   - The BPM is detected from the MIDI file.
3. The page will reload with the new song encoded in the URL.

### URL Parameters

You can manually configure levels by modifying the URL.

| Parameter       | Description                                            | Default |
| :-------------- | :----------------------------------------------------- | :------ |
| `bpm`           | Beats per minute.                                      | `100`   |
| `speed`         | Falling speed of notes in pixels per frame.            | `4`     |
| `melody`        | The encoded note sequence for the melody track.        | `""`    |
| `accompaniment` | The encoded note sequence for the accompaniment track. | `""`    |

### Melody Syntax

The app uses a custom parser (`src/parser.js`) that reads a simplified, URL-friendly version of ABC notation. The parser is designed to be compact for sharing links.

- **Notes**: `C`, `D`, `E`, `F`, `G`, `A`, `B`.
- **Accidentals**: `_` is used for Flat (e.g., `_E` for E-flat). The parser internally converts all flats to their sharp equivalents (e.g., `_E` becomes `D#`) to match the piano key layout.
- **Octaves**: Octave changes are relative to Middle C (C4).
  - `C` = C4 (Middle C)
  - `c` = C5
  - `C.` = C3 (Uses a period `.` for URL safety, maps to ABC's `,`)
  - `c-` = C6 (Uses a hyphen `-` for URL safety, maps to ABC's `'`)
  - `c--` = C7
- **Duration**: A number placed after a note defines its length, relative to a default of an 8th note.
  - `C` = 8th note
  - `C2` = Quarter note
  - `C4` = Half note
  - `C~2` = 16th note (equivalent to `C0.5`, uses `~` for URL-friendly fractions)
  - `C3~2` = Dotted quarter note (1.5x length)
- **Rests**: `z`.

**Example:**
`?bpm=120&melody=C2E2G2c4` (A C-major arpeggio in quarter notes, ending on a half note C5)

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

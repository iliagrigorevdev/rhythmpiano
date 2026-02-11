# 🎹 Rhythm Piano

A web-based rhythm game and piano visualizer built with **Pixi.js** and the **Web Audio API**.

Play along to pre-programmed melodies using a falling-note interface (synthesia style), play the piano freely, or import your own MIDI files. The application parses melodies directly from URL parameters, allowing for easy sharing of songs without backend storage.

[**🚀 Launch Live Application**](https://iliagrigorevdev.github.io/rhythmpiano/)

## ✨ Features

- **Rhythm Game Mode**: Hit the keys when the falling notes reach the red judgment line.
- **📂 MIDI File Import**: Convert local `.mid` files into playable levels instantly. The app parses the MIDI client-side and updates the URL.
- **⏳ Wait Mode**: By default, the game pauses if a note reaches the line but hasn't been played, allowing you to learn the melody at your own pace.
- **Free Play**: Full 2-octave interactive piano when no melody is loaded.
- **PC Keyboard Support**: Play using your computer keyboard with a standard DAW-style layout (e.g., `A`, `S`, `D` for white keys; `W`, `E` for black keys).
- **Sample-Based Audio**: Uses realistic SFZ piano samples (Salamander Grand Piano) with dynamic pitch shifting for high performance.
- **URL-Based Level Sharing**: Melodies, BPM, and scroll speed are encoded entirely in the URL.
- **Responsive Design**: Scales to fit desktop and mobile screens.

## 🎵 Featured Tracks

Click below to load the melody directly:

- [**▶️ Gravity Falls Theme**](https://iliagrigorevdev.github.io/rhythmpiano/?bpm=160&melody=FDA.DFDA.DFCA.CFCA.CE_DA._DE_DA._DE_DA._DE2A2D6E2F8A3G3A2C8D6E2F4E4G4A4G4F4z2F2F2F2A2A2G2F2z2A2A2A2G2A2G2F2z2F2F2F2A2A2G2F2z2A2A2A2z2_d2_d2_d2z2F2F2F2A2A2G2F2z2_B2_B2_B2G4c4A4E4FDFAE_DAdd8)

- [**▶️ How It's Done (KPop Demon Hunters)**](https://iliagrigorevdev.github.io/rhythmpiano/?bpm=150&melody=DDD2F2FED2D2_B2z2_B2_B2d2dc_B2A2D2z2DDD2F2FED2D2_B2_BAG2F2z2_E_EC2_E2D2d2d2c2z2_e2c2_e2d2A2A2A2A2_E_EC2_E2D2d2d2c2z2_e2c2_e2d2A2A2A2A2_E_EC2_E2D2A2A2D2_B2_B_B2zA2z2A2A2D2_B2_B_B2zA2z2AAA2D2_B2_B_B2zA2z2A2A2A2A2_E_EC2_E2D2)

- [**▶️ Takedown (KPop Demon Hunters)**](https://iliagrigorevdev.github.io/rhythmpiano/?bpm=140&melody=B_AB_AB_AB_A_d2_A6e_e_dB_A_GE_G_A3~2A~2_A4E_G_A3~2A~2_A2z_AB_A_d2_A4z_Ae_e_dB_A_GE_G_A3~2A~2_A4E_G_A3~2A~2_A4z2_A~2_A3~2_A2_d_G_G_G_D2_A2_d2_A2A2A_G_A2_A2_D2_A2_d2_A2A2AB_A2_G~2_G3~2_D2_A2_d2_A2A2A_G_A2_A2_D2_A2_d2_A2A2AB_A4_D8)

- [**▶️ Sigma Boy**](https://iliagrigorevdev.github.io/rhythmpiano/?bpm=125&melody=_G_G_G_dB2B_dA2AB_A2z2_G_G_G_dBBB_dAAAB_A2z2)

## 🛠️ Usage & Configuration

### Importing MIDI Files

You can load your own `.mid` files to create levels automatically.

1. Ensure you are on the Main Menu ("Tap to Start" screen).
2. **Long-press (click and hold)** anywhere on the background for 1 second.
3. Click the **"📂 Open MIDI File"** button that appears.
4. Select a simple MIDI file (Track 1 is used for the melody).

### URL Parameters

You can manually configure levels by modifying the URL.

| Parameter | Description                                                    | Default |
| :-------- | :------------------------------------------------------------- | :------ |
| `bpm`     | Beats per minute.                                              | `100`   |
| `speed`   | Falling speed of notes in pixels per frame.                    | `4`     |
| `wait`    | `true` pauses game if note is missed. `false` lets notes pass. | `true`  |
| `melody`  | The encoded note sequence.                                     | `""`    |

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

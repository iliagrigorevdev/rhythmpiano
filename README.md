# 🎹 Rhythm Piano

A web-based rhythm game and piano visualizer built with **Pixi.js** and the **Web Audio API**.

Play along to pre-programmed melodies using a falling-note interface (synthesia style), or play the piano freely. The application parses melodies directly from URL parameters, allowing for easy sharing of songs without backend storage.

[**🚀 Launch Live Application**](https://iliagrigorevdev.github.io/rhythmpiano/)

## ✨ Features

- **Rhythm Game Mode**: Hit the keys when the falling notes reach the red judgment line.
- **Free Play**: Full 2-octave interactive piano when no melody is loaded.
- **PC Keyboard Support**: Play using your computer keyboard with a standard DAW-style layout (e.g., `A`, `S`, `D` for white keys; `W`, `E` for black keys).
- **Sample-Based Audio**: Uses realistic SFZ piano samples (Salamander Grand Piano) with dynamic pitch shifting for high performance.
- **URL-Based Level Sharing**: Melodies, BPM, and scroll speed are encoded entirely in the URL.
- **Responsive Design**: Scales to fit desktop and mobile screens.
- **Touch Support**: Optimized for touch screens with multi-touch capability.

## 🎵 Featured Tracks

Click below to load the melody directly:

- [**▶️ Gravity Falls Theme**](https://iliagrigorevdev.github.io/rhythmpiano/?bpm=160&melody=FDA.DFDA.DFCA.CFCA.CE_DA._DE_DA._DE_DA._DE2A2D6E2F8A3G3A2C8D6E2F4E4G4A4G4F4z2F2F2F2A2A2G2F2z2A2A2A2G2A2G2F2z2F2F2F2A2A2G2F2z2A2A2A2z2_d2_d2_d2z2F2F2F2A2A2G2F2z2_B2_B2_B2G4c4A4E4FDFAE_DAdd8)

- [**▶️ How It's Done (KPop Demon Hunters)**](https://iliagrigorevdev.github.io/rhythmpiano/?bpm=150&melody=DDD2F2FED2D2_B2z2_B2_B2d2dc_B2A2D2z2DDD2F2FED2D2_B2_BAG2F2z2_E_EC2_E2D2d2d2c2z2_e2c2_e2d2A2A2A2A2_E_EC2_E2D2d2d2c2z2_e2c2_e2d2A2A2A2A2_E_EC2_E2D2A2A2D2_B2_B_B2zA2z2A2A2D2_B2_B_B2zA2z2AAA2D2_B2_B_B2zA2z2A2A2A2A2_E_EC2_E2D2)

- [**▶️ Takedown (KPop Demon Hunters)**](https://iliagrigorevdev.github.io/rhythmpiano/?bpm=280&melody=B2_A2B2_A2B2_A2B2_A2_d4_A12e2_e2_d2B2_A2_G2E2_G2_A3A_A8E2_G2_A3A_A4z2_A2B2_A2_d4_A8z2_A2e2_e2_d2B2_A2_G2E2_G2_A3A_A8E2_G2_A3A_A8z4_A_A3_A4_d2_G2_G2_G2_D4_A4_d4_A4A4A2_G2_A4_A4_D4_A4_d4_A4A4A2B2_A4_G_G3_D4_A4_d4_A4A4A2_G2_A4_A4_D4_A4_d4_A4A4A2B2_A8_D16)

- [**▶️ Sigma Boy**](https://iliagrigorevdev.github.io/rhythmpiano/?bpm=125&melody=_G_G_G_dB2B_dA2AB_A2z2_G_G_G_dBBB_dAAAB_A2z2)

## 🛠️ Configuration & Custom Melodies

You can create your own levels by modifying the URL parameters.

### URL Parameters

| Parameter | Description                                   | Default |
| :-------- | :-------------------------------------------- | :------ |
| `bpm`     | Beats per minute (Standard Quarter-note BPM). | `100`   |
| `speed`   | Falling speed of notes in pixels per frame.   | `4`     |
| `melody`  | The encoded note sequence (see syntax below). | `""`    |

### Melody Syntax

The app uses a simplified ABC-style notation parser (`src/parser.js`). The default note duration is treated as an **Eighth Note**.

- **Notes**: `C`, `D`, `E`, `F`, `G`, `A`, `B`.
- **Octaves**:
  - `C` is C4 (Middle C).
  - `c` (lowercase) is C5 (One octave up).
  - Add `.` to lower an octave (e.g., `C.` = C3).
- **Accidentals**:
  - `_` for Flat (e.g., `_B` is Bb).
- **Duration**: Numbers after the note define length relative to an **eighth note**.
  - `C` (No number) = Eighth Note.
  - `C2` = Quarter Note (2 eighths).
  - `C4` = Half Note (4 eighths).
- **Rests**: Use `z` for silence (e.g., `z2` is a Quarter Note rest).

**Example:**
`?bpm=120&melody=C2E2G2c4` (Major arpeggio: 3 quarter notes followed by a half note)

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
- **[Pixi.js (v8)](https://pixijs.com/)**: High-performance 2D WebGL rendering for the game loop and UI.
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)**: Custom engine that loads SFZ regions, decodes buffers, and handles pitch shifting for notes that lack specific samples.

## Credits

- **Audio Samples**: [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, licensed under Creative Commons Attribution 3.0.

## License

This project is licensed under the GPL-3.0 license - see the [LICENSE](LICENSE) file for details.

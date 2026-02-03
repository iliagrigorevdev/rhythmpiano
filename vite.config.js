import { VitePWA } from "vite-plugin-pwa";

export default {
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Rhythm Piano",
        short_name: "RhythmPiano",
        description: "A musical rhythm piano game",
        theme_color: "#000000",
        background_color: "#111111", // Matches the game background color
        display: "standalone",
        orientation: "landscape", // Forces landscape mode on mobile
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
};

import { VitePWA } from "vite-plugin-pwa";

const REPO_NAME = "rhythmpiano";

export default {
  // Add this line so assets load correctly on GitHub Pages
  base: `/${REPO_NAME}/`,

  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Rhythm Piano",
        short_name: "RhythmPiano",
        description: "A musical rhythm piano game",
        theme_color: "#000000",
        background_color: "#111111",
        display: "standalone",
        orientation: "landscape",
        scope: `/${REPO_NAME}/`, // Update scope for PWA
        start_url: `/${REPO_NAME}/`, // Update start_url for PWA
        icons: [
          {
            src: "icons/icon.svg", // Ensure this path exists in your public folder
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
};

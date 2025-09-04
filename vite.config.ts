import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Minute Multiplication",
        short_name: "MinMultiply",
        description: "One-minute multiplication practice with kid-friendly visuals.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          // Optional: add icon files in /public and list them here later
          // { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          // { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          // { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg}"] }
    })
  ]
});

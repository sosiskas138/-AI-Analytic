import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // recharts должен грузиться вместе с React — иначе "Cannot access uninitialized variable"
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router") || id.includes("recharts")) {
              return "vendor-react";
            }
            if (id.includes("@radix-ui")) return "vendor-ui";
            if (id.includes("xlsx") || id.includes("framer-motion")) return "vendor-heavy";
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

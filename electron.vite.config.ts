import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { readFileSync } from "fs";
import { resolve } from "path";
import tailwindcss from "tailwindcss";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
  },
});

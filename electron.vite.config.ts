import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import type { Plugin } from "vite";
import tailwindcss from "tailwindcss";

/**
 * Content-Security-Policy du renderer, injectée uniquement dans le build de production.
 * script-src 'self' interdit tout script inline (dont les gestionnaires onerror/onclick) :
 * un contenu HTML piégé ne peut pas appeler window.api. En développement, le préambule
 * inline de React Refresh serait bloqué : la CSP n'y est donc pas appliquée.
 */
const RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join("; ");

function rendererCsp(): Plugin {
  return {
    name: "otterdesk-renderer-csp",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: RENDERER_CSP },
          injectTo: "head-prepend",
        },
      ],
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), rendererCsp()],
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
  },
});

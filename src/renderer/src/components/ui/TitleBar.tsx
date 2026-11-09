import { MAC_TITLEBAR_CSS } from "../../../../shared/windowLayout";

const isMac = window.api.platform === "darwin";

export function TitleBar() {
  // macOS : feux tricolores natifs (titleBarStyle "hiddenInset") à gauche.
  // Hauteur et marge calculées depuis la géométrie partagée avec le main
  // (src/shared/windowLayout.ts) : barre de 40 pt, boutons centrés verticalement,
  // titre placé 18 pt après le bouton vert et centré sur le même axe.
  if (isMac) {
    return (
      <div
        className="drag-region flex items-center shrink-0 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 select-none"
        style={{ height: MAC_TITLEBAR_CSS.heightPx, paddingLeft: MAC_TITLEBAR_CSS.paddingLeftPx }}
      >
        <span className="text-xs leading-none font-bold text-zinc-500 dark:text-zinc-400">OtterDesk</span>
        <div className="flex-1 h-full" />
      </div>
    );
  }

  return (
    <div className="drag-region flex items-center h-8 shrink-0 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 select-none">
      {/* Nom de l'app */}
      <span className="px-4 text-xs font-bold text-zinc-500 dark:text-zinc-400">OtterDesk</span>

      {/* Zone draggable */}
      <div className="flex-1 h-full" />

      {/* Boutons fenêtre */}
      <div className="no-drag flex items-center h-full">
        <button
          onClick={() => window.api.window.minimize()}
          className="h-full px-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title="Réduire"
        >
          <svg width="8" height="1" viewBox="0 0 8 1" fill="currentColor">
            <rect width="8" height="1" />
          </svg>
        </button>
        <button
          onClick={() => window.api.window.maximize()}
          className="h-full px-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title="Agrandir"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="7" height="7" />
          </svg>
        </button>
        <button
          onClick={() => window.api.window.close()}
          className="h-full px-3 text-zinc-400 hover:text-white hover:bg-red-500 dark:hover:bg-red-600 transition-colors"
          title="Fermer"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.2">
            <line x1="0" y1="0" x2="8" y2="8" />
            <line x1="8" y1="0" x2="0" y2="8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

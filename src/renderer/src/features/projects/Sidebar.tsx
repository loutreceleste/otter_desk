import { Download, FolderOpen, Info, Moon, Pencil, Plus, Sun, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { AboutModal } from "../../components/ui/AboutModal";
import { exportData, importData } from "../../lib/ipc";
import headbandUrl from "../../assets/headband.png";
import type { Project } from "../../types";

interface SidebarProps {
  projects: Project[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewProject: () => void;
  onEditProject: (p: Project) => void;
  onDeleteProject: (id: number) => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

export function Sidebar({
  projects,
  selectedId,
  onSelect,
  onNewProject,
  onEditProject,
  onDeleteProject,
  darkMode,
  onToggleDark,
}: SidebarProps) {
  const [showAbout, setShowAbout] = useState(false);

  const handleExport = async () => {
    await exportData();
  };

  const handleImport = async () => {
    const result = await importData();
    if (result.success) window.location.reload();
  };

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 select-none">
      {/* Logo */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <img
          src={headbandUrl}
          alt="OtterDesk"
          className="w-full h-14 object-contain object-left dark:invert-0 invert"
          draggable={false}
        />
      </div>

      {/* Liste des projets */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Projets
          </span>
          <button
            onClick={onNewProject}
            className="p-1 rounded-md text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            title="Nouveau projet"
          >
            <Plus size={14} />
          </button>
        </div>

        <nav className="space-y-0.5">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${
                selectedId === p.id
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
              onClick={() => onSelect(p.id)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="flex-1 text-sm font-medium truncate">
                {p.name}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditProject(p);
                  }}
                  className="p-1 rounded hover:text-indigo-600 dark:hover:text-indigo-400"
                  title="Modifier"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(p.id);
                  }}
                  className="p-1 rounded hover:text-red-500"
                  title="Supprimer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
              <FolderOpen size={24} strokeWidth={1.5} />
              <p className="text-xs text-center">
                Aucun projet.
                <br />
                Créez-en un !
              </p>
            </div>
          )}
        </nav>
      </div>

      {/* Footer */}
      <div className="no-drag p-3 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
        <button
          onClick={onToggleDark}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          {darkMode ? "Mode clair" : "Mode sombre"}
        </button>

        <div className="flex gap-1">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Exporter toutes les données"
          >
            <Download size={13} />
            Exporter
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Importer des données"
          >
            <Upload size={13} />
            Importer
          </button>
        </div>

        <button
          onClick={() => setShowAbout(true)}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Info size={14} />
          <span>À propos</span>
          <span className="ml-auto font-mono text-zinc-400 dark:text-zinc-500">
            v{__APP_VERSION__}
          </span>
        </button>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </aside>
  );
}

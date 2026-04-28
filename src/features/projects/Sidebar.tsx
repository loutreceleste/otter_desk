import { FolderOpen, Moon, Pencil, Plus, Sun, Trash2 } from "lucide-react";
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
  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦦</span>
          <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            OtterDesk
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-0.5">Mes commandes CLI</p>
      </div>

      {/* Projets */}
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
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
              onClick={() => onSelect(p.id)}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
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
                  className="p-1 rounded hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Modifier"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(p.id);
                  }}
                  className="p-1 rounded hover:text-red-500 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
              <FolderOpen size={24} />
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
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onToggleDark}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          {darkMode ? "Mode clair" : "Mode sombre"}
        </button>
      </div>
    </aside>
  );
}

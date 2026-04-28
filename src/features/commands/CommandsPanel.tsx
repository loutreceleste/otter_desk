import { Plus, Search, Star, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { searchCommands } from "../../lib/tauri";
import type { Command, Project } from "../../types";
import { CommandCard } from "./CommandCard";

interface CommandsPanelProps {
  project: Project | null;
  commands: Command[];
  allProjects: Project[];
  onNewCommand: () => void;
  onEditCommand: (cmd: Command) => void;
  onDeleteCommand: (id: number) => void;
  onToggleFavorite: (id: number) => void;
}

export function CommandsPanel({
  project,
  commands,
  allProjects,
  onNewCommand,
  onEditCommand,
  onDeleteCommand,
  onToggleFavorite,
}: CommandsPanelProps) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Command[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Toutes");
  const [favOnly, setFavOnly] = useState(false);

  useEffect(() => {
    setActiveCategory("Toutes");
    setFavOnly(false);
    setSearch("");
    setSearchResults(null);
  }, [project?.id]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (search.trim().length >= 2) {
        const results = await searchCommands(search);
        setSearchResults(results);
      } else {
        setSearchResults(null);
      }
    }, 250);
    return () => clearTimeout(delay);
  }, [search]);

  const sourceCommands = searchResults ?? commands;

  const categories = useMemo(() => {
    const cats = Array.from(new Set(commands.map((c) => c.category))).sort();
    return ["Toutes", ...cats];
  }, [commands]);

  const filtered = useMemo(() => {
    return sourceCommands.filter((cmd) => {
      if (favOnly && !cmd.is_favorite) return false;
      if (
        activeCategory !== "Toutes" &&
        !searchResults &&
        cmd.category !== activeCategory
      )
        return false;
      return true;
    });
  }, [sourceCommands, favOnly, activeCategory, searchResults]);

  const getProjectColor = (cmd: Command) => {
    const p = allProjects.find((p) => p.id === cmd.project_id);
    return p?.color ?? "#6366f1";
  };

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Terminal size={40} strokeWidth={1.5} />
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Sélectionnez un projet
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            ou créez-en un depuis la barre latérale
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-xs text-zinc-400">{project.description}</p>
              )}
            </div>
          </div>
          <Button onClick={onNewCommand} size="sm">
            <Plus size={14} />
            Nouvelle commande
          </Button>
        </div>

        {/* Barre de recherche */}
        <div className="relative mb-3">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, commande, description, tag…"
            className="w-full pl-9 pr-9 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setSearchResults(null);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtres catégories */}
        {!searchResults && (
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => setFavOnly(!favOnly)}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                favOnly
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Star
                size={11}
                fill={favOnly ? "currentColor" : "none"}
              />
              Favoris
            </button>
          </div>
        )}
        {searchResults && (
          <p className="text-xs text-zinc-400">
            {searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}{" "}
            pour « {search} »
          </p>
        )}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
            <Terminal size={32} strokeWidth={1.5} />
            <p className="text-sm">Aucune commande trouvée</p>
            {!searchResults && (
              <Button variant="ghost" size="sm" onClick={onNewCommand}>
                <Plus size={13} /> Ajouter une commande
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {filtered.map((cmd) => (
              <CommandCard
                key={cmd.id}
                command={cmd}
                projectColor={getProjectColor(cmd)}
                onEdit={onEditCommand}
                onDelete={onDeleteCommand}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

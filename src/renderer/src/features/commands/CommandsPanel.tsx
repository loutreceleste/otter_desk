import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { FileText, Plus, Search, Star, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { searchAll } from "../../lib/ipc";
import type { Command, Note, Project } from "../../types";
import { CommandCard } from "./CommandCard";
import { NoteCard } from "./NoteCard";

interface CommandsPanelProps {
  project: Project | null;
  commands: Command[];
  notes: Note[];
  allProjects: Project[];
  onNewCommand: () => void;
  onEditCommand: (cmd: Command) => void;
  onDeleteCommand: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
  onNewNote: () => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (id: number) => void;
  onReorderNotes: (orderedIds: number[]) => void;
}

// "all" = tout, "notes" = notes uniquement, sinon = nom de catégorie de commandes
type ActiveFilter = "all" | "notes" | string;

export function CommandsPanel({
  project,
  commands,
  notes,
  allProjects,
  onNewCommand,
  onEditCommand,
  onDeleteCommand,
  onToggleFavorite,
  onReorder,
  onNewNote,
  onEditNote,
  onDeleteNote,
  onReorderNotes,
}: CommandsPanelProps) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ commands: Command[]; notes: Note[] } | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [favOnly, setFavOnly] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const showCommands = activeFilter !== "notes";
  const showNotes = activeFilter === "all" || activeFilter === "notes";
  const canDrag = !searchResults && activeFilter === "all" && !favOnly;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredCommands.findIndex((c) => c.id === active.id);
    const newIndex = filteredCommands.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(filteredCommands, oldIndex, newIndex);
    onReorder(reordered.map((c) => c.id));
  };

  const handleNotesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = notes.findIndex((n) => n.id === active.id);
    const newIndex = notes.findIndex((n) => n.id === over.id);
    const reordered = arrayMove(notes, oldIndex, newIndex);
    onReorderNotes(reordered.map((n) => n.id));
  };

  useEffect(() => {
    setActiveFilter("all");
    setFavOnly(false);
    setSearch("");
    setSearchResults(null);
  }, [project?.id]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (search.trim().length >= 2) {
        const results = await searchAll(search);
        setSearchResults(results);
      } else {
        setSearchResults(null);
      }
    }, 250);
    return () => clearTimeout(delay);
  }, [search]);

  const categories = useMemo(() => {
    return Array.from(new Set(commands.map((c) => c.category))).sort();
  }, [commands]);

  const filteredCommands = useMemo(() => {
    const source = searchResults ? searchResults.commands : commands;
    return source.filter((cmd) => {
      if (favOnly && !cmd.is_favorite) return false;
      if (
        activeFilter !== "all" &&
        activeFilter !== "notes" &&
        !searchResults &&
        cmd.category !== activeFilter
      )
        return false;
      return true;
    });
  }, [searchResults, commands, favOnly, activeFilter]);

  const filteredNotes = useMemo(
    () => (searchResults ? searchResults.notes : notes),
    [searchResults, notes]
  );

  const getProjectColor = (cmd: Command) =>
    allProjects.find((p) => p.id === cmd.project_id)?.color ?? "#6366f1";

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Terminal size={48} strokeWidth={1} />
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

  const isEmpty =
    (activeFilter === "notes" && filteredNotes.length === 0) ||
    (activeFilter !== "notes" && filteredCommands.length === 0 && (activeFilter !== "all" || filteredNotes.length === 0));

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-xs text-zinc-400 mt-0.5">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onNewNote} size="sm" variant="secondary">
              <FileText size={14} />
              Note
            </Button>
            <Button onClick={onNewCommand} size="sm">
              <Plus size={14} />
              Commande
            </Button>
          </div>
        </div>

        {/* Recherche */}
        <div className="relative mb-3">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, commande, description, tag…"
            className="w-full pl-9 pr-9 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100 placeholder:text-zinc-400"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setSearchResults(null); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Barre de filtres unifiée */}
        {searchResults ? (
          <p className="text-xs text-zinc-400">
            {searchResults.commands.length + searchResults.notes.length} résultat{searchResults.commands.length + searchResults.notes.length !== 1 ? "s" : ""} pour «&nbsp;{search}&nbsp;»
          </p>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Tout */}
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeFilter === "all"
                  ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
              }`}
            >
              Tout
            </button>

            {/* Notes */}
            <button
              onClick={() => setActiveFilter("notes")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeFilter === "notes"
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
              }`}
            >
              Notes
            </button>

            {/* Séparateur visuel si des catégories existent */}
            {categories.length > 0 && (
              <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
            )}

            {/* Catégories de commandes */}
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  activeFilter === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                }`}
              >
                {cat}
              </button>
            ))}

            {/* Favoris */}
            <button
              onClick={() => setFavOnly(!favOnly)}
              className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                favOnly
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Star size={11} fill={favOnly ? "currentColor" : "none"} />
              Favoris
            </button>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
            <Terminal size={32} strokeWidth={1.5} />
            <p className="text-sm">Aucun élément</p>
            {!searchResults && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onNewCommand}>
                  <Plus size={13} /> Commande
                </Button>
                <Button variant="ghost" size="sm" onClick={onNewNote}>
                  <FileText size={13} /> Note
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section commandes */}
            {showCommands && filteredCommands.length > 0 && (
              <div>
                {showNotes && (
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Commandes
                  </p>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredCommands.map((c) => c.id)} strategy={rectSortingStrategy}>
                    <div className="columns-2 xl:columns-3 gap-3">
                      {filteredCommands.map((cmd) => (
                        <div key={cmd.id} className="break-inside-avoid mb-3">
                          <CommandCard
                            command={cmd}
                            projectColor={getProjectColor(cmd)}
                            onEdit={onEditCommand}
                            onDelete={onDeleteCommand}
                            onToggleFavorite={onToggleFavorite}
                            draggable={canDrag}
                          />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Section notes */}
            {showNotes && filteredNotes.length > 0 && (
              <div>
                {showCommands && (
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Notes
                  </p>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNotesDragEnd}>
                  <SortableContext items={filteredNotes.map((n) => n.id)} strategy={rectSortingStrategy}>
                    <div className="columns-2 xl:columns-3 gap-3">
                      {filteredNotes.map((note) => (
                        <div key={note.id} className="break-inside-avoid mb-3">
                          <NoteCard
                            note={note}
                            onEdit={onEditNote}
                            onDelete={onDeleteNote}
                            draggable={activeFilter === "notes" || activeFilter === "all"}
                          />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

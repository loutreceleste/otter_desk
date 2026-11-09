import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { sanitizeNoteHtml } from "../../lib/sanitizeHtml";
import type { Note } from "../../types";

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: number) => void;
  draggable?: boolean;
}

export function NoteCard({ note, onEdit, onDelete, draggable = false }: NoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });
  // Le HTML stocké peut provenir d'un import : il est nettoyé avant affichage.
  const safeContent = useMemo(() => sanitizeNoteHtml(note.content ?? ""), [note.content]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-sm transition-all duration-150"
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 text-amber-300 dark:text-amber-800 hover:text-amber-500 dark:hover:text-amber-600 cursor-grab active:cursor-grabbing"
            tabIndex={-1}
          >
            <GripVertical size={14} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {note.title}
            </h3>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(note)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Modifier"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {note.content && (
            <div
              className="note-content text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-6 overflow-hidden"
              dangerouslySetInnerHTML={{ __html: safeContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

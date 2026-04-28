import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Copy, GripVertical, Pencil, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { copyToClipboard } from "../../lib/ipc";
import type { Command } from "../../types";

interface CommandCardProps {
  command: Command;
  projectColor: string;
  onEdit: (cmd: Command) => void;
  onDelete: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  draggable?: boolean;
}

type Step = { label: string; cmd: string };

function parseSteps(raw: string): Step[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === "string") return parsed.map((cmd: string) => ({ label: "", cmd }));
      return parsed as Step[];
    }
  } catch {}
  return [{ label: "", cmd: raw }];
}

function CmdBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg bg-indigo-50 dark:bg-black/50 border border-indigo-100 dark:border-zinc-700">
      <pre className="text-xs font-mono text-indigo-700 dark:text-emerald-400 px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed pr-10">
        {text}
      </pre>
      <button
        onClick={handle}
        className={`absolute top-2 right-2 p-1.5 rounded-md transition-all duration-150 ${
          copied
            ? "bg-indigo-200 dark:bg-emerald-500/20 text-indigo-600 dark:text-emerald-400"
            : "bg-indigo-100 dark:bg-zinc-800 text-indigo-400 dark:text-zinc-400 hover:bg-indigo-200 dark:hover:bg-zinc-700 hover:text-indigo-600 dark:hover:text-zinc-200"
        }`}
        title={copied ? "Copié !" : "Copier"}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

export function CommandCard({
  command,
  projectColor,
  onEdit,
  onDelete,
  onToggleFavorite,
  draggable = false,
}: CommandCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: command.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const steps = useMemo(() => parseSteps(command.command), [command.command]);
  const isMulti = steps.length > 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {draggable && (
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing"
              tabIndex={-1}
            >
              <GripVertical size={14} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {command.title}
              </h3>
              <Badge label={command.category} color={projectColor} variant="category" />
              {isMulti && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {steps.length} étapes
                </span>
              )}
            </div>
            {command.description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                {command.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleFavorite(command.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              command.is_favorite
                ? "text-amber-500 hover:text-amber-600"
                : "text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            }`}
            title={command.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Star size={14} fill={command.is_favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => onEdit(command)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            title="Modifier"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(command.id)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Blocs commandes */}
      <div className="mt-3 space-y-2">
        {steps.map((step, i) => (
          <div key={i}>
            {isMulti && (
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1 font-medium">
                {step.label || `Étape ${i + 1}`}
              </p>
            )}
            <CmdBlock text={step.cmd} />
          </div>
        ))}
      </div>

      {/* Tags */}
      {command.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {command.tags.map((tag) => (
            <Badge key={tag.id} label={tag.name} />
          ))}
        </div>
      )}
    </div>
  );
}

import { Check, Copy, Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { copyToClipboard } from "../../lib/tauri";
import type { Command } from "../../types";

interface CommandCardProps {
  command: Command;
  projectColor: string;
  onEdit: (cmd: Command) => void;
  onDelete: (id: number) => void;
  onToggleFavorite: (id: number) => void;
}

export function CommandCard({
  command,
  projectColor,
  onEdit,
  onDelete,
  onToggleFavorite,
}: CommandCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(command.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {command.title}
            </h3>
            <Badge
              label={command.category}
              color={projectColor}
              variant="category"
            />
          </div>
          {command.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {command.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleFavorite(command.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              command.is_favorite
                ? "text-amber-500 hover:text-amber-600"
                : "text-zinc-400 hover:text-amber-500"
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

      <div className="relative mt-3 rounded-lg bg-zinc-950 dark:bg-zinc-950/80 border border-zinc-800">
        <pre className="text-xs font-mono text-emerald-400 px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
          {command.command}
        </pre>
        <button
          onClick={handleCopy}
          className={`absolute top-2 right-2 p-1.5 rounded-md transition-all duration-150 ${
            copied
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
          title="Copier"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

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

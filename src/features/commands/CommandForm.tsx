import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import type {
  Category,
  Command,
  CreateCommandInput,
  Project,
  UpdateCommandInput,
} from "../../types";
import { CATEGORIES as ALL_CATEGORIES } from "../../types";

interface CommandFormProps {
  projects: Project[];
  command?: Command;
  defaultProjectId: number;
  onSave: (input: CreateCommandInput | UpdateCommandInput) => Promise<void>;
  onClose: () => void;
}

export function CommandForm({
  projects,
  command,
  defaultProjectId,
  onSave,
  onClose,
}: CommandFormProps) {
  const [title, setTitle] = useState(command?.title ?? "");
  const [cmd, setCmd] = useState(command?.command ?? "");
  const [description, setDescription] = useState(command?.description ?? "");
  const [category, setCategory] = useState<Category>(
    (command?.category as Category) ?? "Custom"
  );
  const [projectId, setProjectId] = useState(
    command?.project_id ?? defaultProjectId
  );
  const [isFavorite, setIsFavorite] = useState(command?.is_favorite ?? false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(
    command?.tags.map((t) => t.name) ?? []
  );
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !cmd.trim()) return;
    setSaving(true);
    const base = {
      project_id: projectId,
      title: title.trim(),
      command: cmd.trim(),
      description: description.trim(),
      category,
      is_favorite: isFavorite,
      tags,
    };
    await onSave(
      command ? { ...base, id: command.id } : base
    );
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      title={command ? "Modifier la commande" : "Nouvelle commande"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Titre *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Docker Compose Up"
              required
              className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Projet
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Commande *
          </label>
          <textarea
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder="Ex: docker compose up -d"
            required
            rows={3}
            className="w-full px-3 py-2 text-sm font-mono bg-zinc-950 text-emerald-400 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Courte description de ce que fait la commande"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Catégorie
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as Category)
              }
              className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Ajouter aux favoris
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Tags
          </label>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Ajouter un tag…"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addTag}>
              Ajouter
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : command ? "Mettre à jour" : "Créer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { Plus, X } from "lucide-react";
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
import { CATEGORIES } from "../../types";

interface CommandFormProps {
  projects: Project[];
  command?: Command;
  defaultProjectId: number;
  onSave: (input: CreateCommandInput | UpdateCommandInput) => Promise<void>;
  onClose: () => void;
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

function serializeSteps(steps: Step[]): string {
  const valid = steps.filter((s) => s.cmd.trim());
  if (valid.length === 1 && !valid[0].label) return valid[0].cmd;
  return JSON.stringify(valid);
}

export function CommandForm({
  projects,
  command,
  defaultProjectId,
  onSave,
  onClose,
}: CommandFormProps) {
  const [title, setTitle] = useState(command?.title ?? "");
  const [steps, setSteps] = useState<Step[]>(() =>
    command ? parseSteps(command.command) : [{ label: "", cmd: "" }]
  );
  const [description, setDescription] = useState(command?.description ?? "");
  const [category, setCategory] = useState<Category>(
    (command?.category as Category) ?? "Custom"
  );
  const [projectId, setProjectId] = useState(command?.project_id ?? defaultProjectId);
  const [isFavorite, setIsFavorite] = useState(command?.is_favorite ?? false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(command?.tags.map((t) => t.name) ?? []);
  const [saving, setSaving] = useState(false);

  const updateCmd = (i: number, val: string) =>
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, cmd: val } : s)));
  const updateLabel = (i: number, val: string) =>
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, label: val } : s)));
  const addCmd = () => setSteps([...steps, { label: "", cmd: "" }]);
  const removeCmd = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed]);
    setTagInput("");
  };
  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSteps = steps.filter((s) => s.cmd.trim());
    if (!title.trim() || validSteps.length === 0) return;
    setSaving(true);
    const base = {
      project_id: projectId,
      title: title.trim(),
      command: serializeSteps(validSteps),
      description: description.trim(),
      category,
      is_favorite: isFavorite,
      tags,
    };
    await onSave(command ? { ...base, id: command.id } : base);
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
              className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100 placeholder:text-zinc-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Projet
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Commandes multiples */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Commande{steps.length > 1 ? "s" : ""} *
            </label>
            <button
              type="button"
              onClick={addCmd}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <Plus size={12} />
              Ajouter une étape
            </button>
          </div>

          {steps.map((s, i) => (
            <div key={i} className="flex flex-col gap-1">
              {steps.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-zinc-700 text-indigo-600 dark:text-zinc-300 text-xs flex items-center justify-center font-mono">
                    {i + 1}
                  </span>
                  <input
                    value={s.label}
                    onChange={(e) => updateLabel(i, e.target.value)}
                    placeholder={`Étape ${i + 1}`}
                    className="w-40 px-2 py-0.5 text-xs rounded bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700 text-indigo-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-indigo-300 dark:placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeCmd(i)}
                    className="ml-auto p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <textarea
                value={s.cmd}
                onChange={(e) => updateCmd(i, e.target.value)}
                placeholder={i === 0 ? "Ex: docker compose up -d" : `Commande…`}
                rows={2}
                className="w-full px-3 py-2 text-sm font-mono bg-indigo-50 dark:bg-zinc-900 text-indigo-700 dark:text-emerald-400 border border-indigo-100 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none placeholder:text-indigo-300 dark:placeholder:text-zinc-600"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ce que fait cette commande…"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Catégorie
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Ajouter aux favoris</span>
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
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Ajouter un tag (Entrée pour valider)…"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addTag}>Ajouter</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : command ? "Mettre à jour" : "Créer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

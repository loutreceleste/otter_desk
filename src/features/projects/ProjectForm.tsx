import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from "../../types";
import { PROJECT_COLORS } from "../../types";

interface ProjectFormProps {
  project?: Project;
  onSave: (input: CreateProjectInput | UpdateProjectInput) => Promise<void>;
  onClose: () => void;
}

export function ProjectForm({ project, onSave, onClose }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const base = { name: name.trim(), description: description.trim(), color };
    await onSave(project ? { ...base, id: project.id } : base);
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      title={project ? "Modifier le projet" : "Nouveau projet"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Nom *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Smart Santé HR Tool"
            required
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Courte description du projet"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Couleur
          </label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-all ${
                  color === c
                    ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 scale-110"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: c, outlineColor: color === c ? c : undefined }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : project ? "Mettre à jour" : "Créer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

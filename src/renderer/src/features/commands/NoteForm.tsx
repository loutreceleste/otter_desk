import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, List, Strikethrough, UnderlineIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import type { CreateNoteInput, Note, Project, UpdateNoteInput } from "../../types";

interface NoteFormProps {
  projects: Project[];
  note?: Note;
  defaultProjectId: number;
  onSave: (input: CreateNoteInput | UpdateNoteInput) => Promise<void>;
  onClose: () => void;
}

export function NoteForm({ projects, note, defaultProjectId, onSave, onClose }: NoteFormProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [projectId, setProjectId] = useState(note?.project_id ?? defaultProjectId);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: note?.content ?? "",
    editorProps: {
      attributes: {
        class: "note-editor min-h-[160px] px-3 py-2.5 text-sm focus:outline-none text-zinc-900 dark:text-zinc-100",
      },
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !editor) return;
    setSaving(true);
    const base = { project_id: projectId, title: title.trim(), content: editor.getHTML() };
    await onSave(note ? { ...base, id: note.id } : base);
    setSaving(false);
    onClose();
  };

  // onMouseDown + preventDefault empêche le blur de l'éditeur au clic sur la toolbar
  const toolbarAction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    action();
  };

  const tbClass = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active
        ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
    }`;

  return (
    <Modal title={note ? "Modifier la note" : "Nouvelle note"} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Titre *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Points importants"
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

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Contenu
          </label>
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-700 focus-within:ring-2 focus-within:ring-indigo-500">
            {/* Toolbar — onMouseDown pour ne pas blur l'éditeur */}
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-700/80">
              <button
                type="button"
                title="Gras (Ctrl+B)"
                className={tbClass(editor?.isActive("bold") ?? false)}
                onMouseDown={(e) => toolbarAction(e, () => editor?.chain().focus().toggleBold().run())}
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                title="Souligné (Ctrl+U)"
                className={tbClass(editor?.isActive("underline") ?? false)}
                onMouseDown={(e) => toolbarAction(e, () => editor?.chain().focus().toggleUnderline().run())}
              >
                <UnderlineIcon size={14} />
              </button>
              <button
                type="button"
                title="Barré"
                className={tbClass(editor?.isActive("strike") ?? false)}
                onMouseDown={(e) => toolbarAction(e, () => editor?.chain().focus().toggleStrike().run())}
              >
                <Strikethrough size={14} />
              </button>
              <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-600 mx-1" />
              <button
                type="button"
                title="Liste à puces"
                className={tbClass(editor?.isActive("bulletList") ?? false)}
                onMouseDown={(e) => toolbarAction(e, () => editor?.chain().focus().toggleBulletList().run())}
              >
                <List size={14} />
              </button>
            </div>
            <EditorContent editor={editor} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : note ? "Mettre à jour" : "Créer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

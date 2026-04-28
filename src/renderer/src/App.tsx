import { useEffect, useState } from "react";
import { ConfirmModal } from "./components/ui/ConfirmModal";
import { TitleBar } from "./components/ui/TitleBar";
import { CommandForm } from "./features/commands/CommandForm";
import { CommandsPanel } from "./features/commands/CommandsPanel";
import { NoteForm } from "./features/commands/NoteForm";
import { ProjectForm } from "./features/projects/ProjectForm";
import { Sidebar } from "./features/projects/Sidebar";
import { useCommands } from "./hooks/useCommands";
import { useNotes } from "./hooks/useNotes";
import { useProjects } from "./hooks/useProjects";
import type {
  Command,
  CreateCommandInput,
  CreateNoteInput,
  Note,
  Project,
  UpdateCommandInput,
  UpdateNoteInput,
} from "./types";

interface ConfirmState {
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") !== "light"
  );
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [showCommandForm, setShowCommandForm] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | undefined>();
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>();
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const { projects, add: addProject, update: updateProject, remove: removeProject } =
    useProjects();
  const {
    commands,
    add: addCommand,
    update: updateCommand,
    remove: removeCommand,
    toggle: toggleFav,
    reorder: reorderCommands,
  } = useCommands(selectedProjectId);
  const { notes, add: addNote, update: updateNote, remove: removeNote, reorder: reorderNotes } =
    useNotes(selectedProjectId);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Auto-select first project on load
  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const handleSaveCommand = async (input: CreateCommandInput | UpdateCommandInput) => {
    if ("id" in input) await updateCommand(input);
    else await addCommand(input);
  };

  const handleDeleteProject = (id: number) => {
    setConfirmState({
      title: "Supprimer le projet",
      message: "Cette action supprimera le projet ainsi que toutes ses commandes et notes. Cette action est irréversible.",
      onConfirm: async () => {
        await removeProject(id);
        if (selectedProjectId === id) {
          setSelectedProjectId(projects.find((p) => p.id !== id)?.id ?? null);
        }
      },
    });
  };

  const handleDeleteCommand = (id: number) => {
    setConfirmState({
      title: "Supprimer la commande",
      message: "Voulez-vous vraiment supprimer cette commande ? Cette action est irréversible.",
      onConfirm: () => removeCommand(id),
    });
  };

  const handleDeleteNote = (id: number) => {
    setConfirmState({
      title: "Supprimer la note",
      message: "Voulez-vous vraiment supprimer cette note ? Cette action est irréversible.",
      onConfirm: () => removeNote(id),
    });
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
      <Sidebar
        projects={projects}
        selectedId={selectedProjectId}
        onSelect={setSelectedProjectId}
        onNewProject={() => { setEditingProject(undefined); setShowProjectForm(true); }}
        onEditProject={(p) => { setEditingProject(p); setShowProjectForm(true); }}
        onDeleteProject={handleDeleteProject}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(!darkMode)}
      />

      <CommandsPanel
        project={selectedProject}
        commands={commands}
        notes={notes}
        allProjects={projects}
        onNewCommand={() => { setEditingCommand(undefined); setShowCommandForm(true); }}
        onEditCommand={(cmd) => { setEditingCommand(cmd); setShowCommandForm(true); }}
        onDeleteCommand={handleDeleteCommand}
        onToggleFavorite={toggleFav}
        onReorder={reorderCommands}
        onNewNote={() => { setEditingNote(undefined); setShowNoteForm(true); }}
        onEditNote={(note) => { setEditingNote(note); setShowNoteForm(true); }}
        onDeleteNote={handleDeleteNote}
        onReorderNotes={reorderNotes}
      />

      {showProjectForm && (
        <ProjectForm
          project={editingProject}
          onSave={async (input) => {
            if ("id" in input) await updateProject(input);
            else await addProject(input);
          }}
          onClose={() => setShowProjectForm(false)}
        />
      )}

      {showCommandForm && selectedProject && (
        <CommandForm
          projects={projects}
          command={editingCommand}
          defaultProjectId={selectedProject.id}
          onSave={handleSaveCommand}
          onClose={() => setShowCommandForm(false)}
        />
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
        />
      )}

      {showNoteForm && selectedProject && (
        <NoteForm
          projects={projects}
          note={editingNote}
          defaultProjectId={selectedProject.id}
          onSave={async (input: CreateNoteInput | UpdateNoteInput) => {
            if ("id" in input) await updateNote(input);
            else await addNote(input);
          }}
          onClose={() => setShowNoteForm(false)}
        />
      )}
      </div>
    </div>
  );
}

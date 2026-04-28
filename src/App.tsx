import { useEffect, useState } from "react";
import { CommandForm } from "./features/commands/CommandForm";
import { CommandsPanel } from "./features/commands/CommandsPanel";
import { ProjectForm } from "./features/projects/ProjectForm";
import { Sidebar } from "./features/projects/Sidebar";
import { useCommands } from "./hooks/useCommands";
import { useProjects } from "./hooks/useProjects";
import type { Command, CreateCommandInput, UpdateCommandInput } from "./types";

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<
    Parameters<typeof ProjectForm>[0]["project"] | undefined
  >(undefined);

  const [showCommandForm, setShowCommandForm] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | undefined>(
    undefined
  );

  const { projects, add: addProject, update: updateProject, remove: removeProject } =
    useProjects();
  const {
    commands,
    add: addCommand,
    update: updateCommand,
    remove: removeCommand,
    toggle: toggleFav,
  } = useCommands(selectedProjectId);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? null;

  const handleSaveCommand = async (
    input: CreateCommandInput | UpdateCommandInput
  ) => {
    if ("id" in input) {
      await updateCommand(input);
    } else {
      await addCommand(input);
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm("Supprimer ce projet et toutes ses commandes ?")) return;
    await removeProject(id);
    if (selectedProjectId === id) {
      setSelectedProjectId(projects.find((p) => p.id !== id)?.id ?? null);
    }
  };

  const handleDeleteCommand = async (id: number) => {
    if (!confirm("Supprimer cette commande ?")) return;
    await removeCommand(id);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <Sidebar
        projects={projects}
        selectedId={selectedProjectId}
        onSelect={setSelectedProjectId}
        onNewProject={() => {
          setEditingProject(undefined);
          setShowProjectForm(true);
        }}
        onEditProject={(p) => {
          setEditingProject(p);
          setShowProjectForm(true);
        }}
        onDeleteProject={handleDeleteProject}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(!darkMode)}
      />

      <CommandsPanel
        project={selectedProject}
        commands={commands}
        allProjects={projects}
        onNewCommand={() => {
          setEditingCommand(undefined);
          setShowCommandForm(true);
        }}
        onEditCommand={(cmd) => {
          setEditingCommand(cmd);
          setShowCommandForm(true);
        }}
        onDeleteCommand={handleDeleteCommand}
        onToggleFavorite={toggleFav}
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
    </div>
  );
}

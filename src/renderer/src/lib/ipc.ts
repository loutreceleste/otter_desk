import type {
  Command,
  CreateCommandInput,
  CreateNoteInput,
  CreateProjectInput,
  Note,
  Project,
  Tag,
  UpdateCommandInput,
  UpdateNoteInput,
  UpdateProjectInput,
} from "../types";

const api = window.api;

export const copyToClipboard = (text: string): Promise<void> =>
  api.clipboard.write(text);

// Projects
export const getProjects = (): Promise<Project[]> => api.projects.getAll();
export const createProject = (input: CreateProjectInput): Promise<Project> =>
  api.projects.create(input);
export const updateProject = (input: UpdateProjectInput): Promise<Project> =>
  api.projects.update(input);
export const deleteProject = (id: number): Promise<void> =>
  api.projects.delete(id);

// Commands
export const getCommands = (projectId: number): Promise<Command[]> =>
  api.commands.getByProject(projectId);
export const searchCommands = (query: string): Promise<Command[]> =>
  api.commands.search(query);
export const createCommand = (input: CreateCommandInput): Promise<Command> =>
  api.commands.create(input);
export const updateCommand = (input: UpdateCommandInput): Promise<Command> =>
  api.commands.update(input);
export const deleteCommand = (id: number): Promise<void> =>
  api.commands.delete(id);
export const toggleFavorite = (id: number): Promise<boolean> =>
  api.commands.toggleFavorite(id);
export const reorderCommands = (orderedIds: number[]): Promise<void> =>
  api.commands.reorder(orderedIds);

// Notes
export const getNotes = (projectId: number): Promise<Note[]> =>
  api.notes.getByProject(projectId);
export const createNote = (input: CreateNoteInput): Promise<Note> =>
  api.notes.create(input);
export const updateNote = (input: UpdateNoteInput): Promise<Note> =>
  api.notes.update(input);
export const deleteNote = (id: number): Promise<void> => api.notes.delete(id);
export const reorderNotes = (orderedIds: number[]): Promise<void> =>
  api.notes.reorder(orderedIds);

// Tags
export const getTags = (): Promise<Tag[]> => api.tags.getAll();

// Search unifiée
export const searchAll = (query: string) => api.data.search(query);

// Export / Import
export const exportData = () => api.data.export();
export const importData = () => api.data.import();

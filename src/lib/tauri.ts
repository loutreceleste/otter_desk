import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type {
  Command,
  CreateCommandInput,
  CreateProjectInput,
  Project,
  Tag,
  UpdateCommandInput,
  UpdateProjectInput,
} from "../types";

// Re-export clipboard for use in components
export { writeText as copyToClipboard };

// Projects
export const getProjects = () => invoke<Project[]>("get_projects");
export const createProject = (input: CreateProjectInput) =>
  invoke<Project>("create_project", { input });
export const updateProject = (input: UpdateProjectInput) =>
  invoke<Project>("update_project", { input });
export const deleteProject = (id: number) =>
  invoke<void>("delete_project", { id });

// Commands
export const getCommands = (projectId: number) =>
  invoke<Command[]>("get_commands", { projectId });
export const searchCommands = (query: string) =>
  invoke<Command[]>("search_commands", { query });
export const createCommand = (input: CreateCommandInput) =>
  invoke<Command>("create_command", { input });
export const updateCommand = (input: UpdateCommandInput) =>
  invoke<Command>("update_command", { input });
export const deleteCommand = (id: number) =>
  invoke<void>("delete_command", { id });
export const toggleFavorite = (id: number) =>
  invoke<boolean>("toggle_favorite", { id });

// Tags
export const getTags = () => invoke<Tag[]>("get_tags");
export const deleteTag = (id: number) => invoke<void>("delete_tag", { id });

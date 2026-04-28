export interface Project {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Command {
  id: number;
  project_id: number;
  title: string;
  command: string;
  description: string;
  category: string;
  is_favorite: boolean;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  color: string;
}

export interface UpdateProjectInput {
  id: number;
  name: string;
  description: string;
  color: string;
}

export interface CreateCommandInput {
  project_id: number;
  title: string;
  command: string;
  description: string;
  category: string;
  is_favorite: boolean;
  tags: string[];
}

export interface UpdateCommandInput {
  id: number;
  project_id: number;
  title: string;
  command: string;
  description: string;
  category: string;
  is_favorite: boolean;
  tags: string[];
}

export type Category =
  | "Git"
  | "Docker"
  | "Symfony"
  | "Node"
  | "NPM"
  | "Composer"
  | "Database"
  | "Bash"
  | "Custom";

export const CATEGORIES: Category[] = [
  "Git",
  "Docker",
  "Symfony",
  "Node",
  "NPM",
  "Composer",
  "Database",
  "Bash",
  "Custom",
];

export const PROJECT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

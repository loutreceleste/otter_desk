import { useCallback, useEffect, useState } from "react";
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from "../lib/ipc";
import type { CreateProjectInput, Project, UpdateProjectInput } from "../types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getProjects();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (input: CreateProjectInput) => {
      await createProject(input);
      await refresh();
    },
    [refresh]
  );

  const update = useCallback(
    async (input: UpdateProjectInput) => {
      await updateProject(input);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      await deleteProject(id);
      await refresh();
    },
    [refresh]
  );

  return { projects, loading, refresh, add, update, remove };
}

import { useCallback, useEffect, useState } from "react";
import {
  createCommand,
  deleteCommand,
  getCommands,
  searchCommands,
  toggleFavorite,
  updateCommand,
} from "../lib/tauri";
import type {
  Command,
  CreateCommandInput,
  UpdateCommandInput,
} from "../types";

export function useCommands(projectId: number | null) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (projectId === null) return;
    setLoading(true);
    const data = await getCommands(projectId);
    setCommands(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (projectId !== null) refresh();
    else setCommands([]);
  }, [projectId, refresh]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return null;
    return await searchCommands(query);
  }, []);

  const add = useCallback(
    async (input: CreateCommandInput) => {
      await createCommand(input);
      await refresh();
    },
    [refresh]
  );

  const update = useCallback(
    async (input: UpdateCommandInput) => {
      await updateCommand(input);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      await deleteCommand(id);
      await refresh();
    },
    [refresh]
  );

  const toggle = useCallback(
    async (id: number) => {
      await toggleFavorite(id);
      await refresh();
    },
    [refresh]
  );

  return { commands, loading, refresh, search, add, update, remove, toggle };
}

import { useCallback, useEffect, useState } from "react";
import {
  createNote,
  deleteNote,
  getNotes,
  reorderNotes,
  updateNote,
} from "../lib/ipc";
import type { CreateNoteInput, Note, UpdateNoteInput } from "../types";

export function useNotes(projectId: number | null) {
  const [notes, setNotes] = useState<Note[]>([]);

  const refresh = useCallback(async () => {
    if (projectId === null) return;
    setNotes(await getNotes(projectId));
  }, [projectId]);

  useEffect(() => {
    if (projectId !== null) refresh();
    else setNotes([]);
  }, [projectId, refresh]);

  const add = useCallback(
    async (input: CreateNoteInput) => {
      await createNote(input);
      await refresh();
    },
    [refresh]
  );

  const update = useCallback(
    async (input: UpdateNoteInput) => {
      await updateNote(input);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      await deleteNote(id);
      await refresh();
    },
    [refresh]
  );

  const reorder = useCallback(async (orderedIds: number[]) => {
    setNotes((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]));
      return orderedIds.map((id) => map.get(id)!).filter(Boolean);
    });
    await reorderNotes(orderedIds);
  }, []);

  return { notes, refresh, add, update, remove, reorder };
}

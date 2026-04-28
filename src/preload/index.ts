import { contextBridge, ipcRenderer } from "electron";

const api = {
  projects: {
    getAll: () => ipcRenderer.invoke("projects:getAll"),
    create: (input: unknown) => ipcRenderer.invoke("projects:create", input),
    update: (input: unknown) => ipcRenderer.invoke("projects:update", input),
    delete: (id: number) => ipcRenderer.invoke("projects:delete", id),
  },
  commands: {
    getByProject: (projectId: number) =>
      ipcRenderer.invoke("commands:getByProject", projectId),
    search: (query: string) => ipcRenderer.invoke("commands:search", query),
    create: (input: unknown) => ipcRenderer.invoke("commands:create", input),
    update: (input: unknown) => ipcRenderer.invoke("commands:update", input),
    delete: (id: number) => ipcRenderer.invoke("commands:delete", id),
    toggleFavorite: (id: number) =>
      ipcRenderer.invoke("commands:toggleFavorite", id),
    reorder: (orderedIds: number[]) =>
      ipcRenderer.invoke("commands:reorder", orderedIds),
  },
  notes: {
    getByProject: (projectId: number) => ipcRenderer.invoke("notes:getByProject", projectId),
    create: (input: unknown) => ipcRenderer.invoke("notes:create", input),
    update: (input: unknown) => ipcRenderer.invoke("notes:update", input),
    delete: (id: number) => ipcRenderer.invoke("notes:delete", id),
    reorder: (orderedIds: number[]) => ipcRenderer.invoke("notes:reorder", orderedIds),
  },
  tags: {
    getAll: () => ipcRenderer.invoke("tags:getAll"),
  },
  clipboard: {
    write: (text: string) => ipcRenderer.invoke("clipboard:write", text),
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
  },
  data: {
    search: (query: string) => ipcRenderer.invoke("data:search", query),
    export: () => ipcRenderer.invoke("data:export"),
    import: () => ipcRenderer.invoke("data:import"),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;

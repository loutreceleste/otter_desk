import { contextBridge, ipcRenderer } from "electron";

const api = {
  /** Plateforme (lecture seule) : adapte la barre de titre sous macOS */
  platform: process.platform,
  app: {
    /** Version réelle (app.getVersion()) et état du raccourci global. */
    getInfo: () => ipcRenderer.invoke("app:getInfo"),
  },
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
  terminals: {
    list: () => ipcRenderer.invoke("terminals:list"),
    send: (req: unknown) => ipcRenderer.invoke("terminals:send", req),
    startPairing: (providerId: string) => ipcRenderer.invoke("terminals:pairing:start", providerId),
    cancelPairing: (providerId: string) => ipcRenderer.invoke("terminals:pairing:cancel", providerId),
    unpair: (providerId: string) => ipcRenderer.invoke("terminals:unpair", providerId),
    /** Abonnement aux changements de terminaux ; retourne la fonction de désabonnement. */
    onChanged: (listener: () => void) => {
      const handler = () => listener();
      ipcRenderer.on("terminals:changed", handler);
      return () => {
        ipcRenderer.removeListener("terminals:changed", handler);
      };
    },
    onPaired: (listener: () => void) => {
      const handler = () => listener();
      ipcRenderer.on("terminals:paired", handler);
      return () => {
        ipcRenderer.removeListener("terminals:paired", handler);
      };
    },
  },
  data: {
    search: (query: string) => ipcRenderer.invoke("data:search", query),
    export: () => ipcRenderer.invoke("data:export"),
    import: () => ipcRenderer.invoke("data:import"),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;

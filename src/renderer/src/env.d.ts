/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      platform: string;
      app: {
        getInfo: () => Promise<import("../../shared/appInfo").AppInfo>;
      };
      projects: {
        getAll: () => Promise<import("./types").Project[]>;
        create: (input: import("./types").CreateProjectInput) => Promise<import("./types").Project>;
        update: (input: import("./types").UpdateProjectInput) => Promise<import("./types").Project>;
        delete: (id: number) => Promise<void>;
      };
      commands: {
        getByProject: (projectId: number) => Promise<import("./types").Command[]>;
        search: (query: string) => Promise<import("./types").Command[]>;
        create: (input: import("./types").CreateCommandInput) => Promise<import("./types").Command>;
        update: (input: import("./types").UpdateCommandInput) => Promise<import("./types").Command>;
        delete: (id: number) => Promise<void>;
        toggleFavorite: (id: number) => Promise<boolean>;
        reorder: (orderedIds: number[]) => Promise<void>;
      };
      notes: {
        getByProject: (projectId: number) => Promise<import("./types").Note[]>;
        create: (input: import("./types").CreateNoteInput) => Promise<import("./types").Note>;
        update: (input: import("./types").UpdateNoteInput) => Promise<import("./types").Note>;
        delete: (id: number) => Promise<void>;
        reorder: (orderedIds: number[]) => Promise<void>;
      };
      tags: {
        getAll: () => Promise<import("./types").Tag[]>;
      };
      clipboard: {
        write: (text: string) => Promise<void>;
      };
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
      };
      terminals: {
        list: () => Promise<import("../../shared/terminalTypes").TerminalListResult>;
        send: (req: import("../../shared/terminalTypes").SendCommandRequest) => Promise<import("../../shared/terminalTypes").SendResult>;
        startPairing: (providerId: string) => Promise<import("../../shared/terminalTypes").PairingInfo>;
        cancelPairing: (providerId: string) => Promise<void>;
        unpair: (providerId: string) => Promise<void>;
        onChanged: (listener: () => void) => () => void;
        onPaired: (listener: () => void) => () => void;
      };
      data: {
        search: (query: string) => Promise<{ commands: import("./types").Command[]; notes: import("./types").Note[] }>;
        export: () => Promise<{ success: boolean }>;
        import: () => Promise<{ success: boolean }>;
      };
    };
  }
}

export {};

import { BrowserWindow, Menu, MenuItem, Tray, app, clipboard, dialog, globalShortcut, ipcMain, shell } from "electron";
import fs from "fs";
import path from "path";
import {
  CreateCommandInput,
  CreateNoteInput,
  CreateProjectInput,
  ExportData,
  UpdateCommandInput,
  UpdateNoteInput,
  UpdateProjectInput,
  dbCreateCommand,
  dbCreateNote,
  dbCreateProject,
  dbDeleteCommand,
  dbDeleteNote,
  dbDeleteProject,
  dbExportAll,
  dbGetCommands,
  dbGetNotes,
  dbGetProjects,
  dbGetTags,
  dbImportAll,
  dbReorderCommands,
  dbReorderNotes,
  dbSearchCommands,
  dbSearchNotes,
  dbToggleFavorite,
  dbUpdateCommand,
  dbUpdateNote,
  dbUpdateProject,
  getDb,
} from "./db";
import { seedDemoData } from "./seed";

let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function createWindow(iconPath: string): BrowserWindow {

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "OtterDesk",
    icon: iconPath,
    backgroundColor: "#18181b",
    center: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Supprime complètement la barre de menu native (File, Edit, View…)
  Menu.setApplicationMenu(null);

  win.on("ready-to-show", () => {
    win.webContents.setZoomFactor(1.25);
    win.show();
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  const db = getDb();
  seedDemoData(db);

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(app.getAppPath(), "resources", "icon.ico");

  // ─── Window controls ──────────────────────────────────────
  ipcMain.handle("window:minimize", () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.handle("window:maximize", () => {
    const w = BrowserWindow.getFocusedWindow();
    if (w?.isMaximized()) w.unmaximize(); else w?.maximize();
  });
  // X cache la fenêtre dans le tray ; quitter via le menu tray
  ipcMain.handle("window:close", () => { win.hide(); });

  // ─── Projects ─────────────────────────────────────────────
  ipcMain.handle("projects:getAll", () => dbGetProjects(db));
  ipcMain.handle("projects:create", (_e, input: CreateProjectInput) =>
    dbCreateProject(db, input)
  );
  ipcMain.handle("projects:update", (_e, input: UpdateProjectInput) =>
    dbUpdateProject(db, input)
  );
  ipcMain.handle("projects:delete", (_e, id: number) =>
    dbDeleteProject(db, id)
  );

  // ─── Commands ─────────────────────────────────────────────
  ipcMain.handle("commands:getByProject", (_e, projectId: number) =>
    dbGetCommands(db, projectId)
  );
  ipcMain.handle("commands:search", (_e, query: string) =>
    dbSearchCommands(db, query)
  );
  ipcMain.handle("commands:create", (_e, input: CreateCommandInput) =>
    dbCreateCommand(db, input)
  );
  ipcMain.handle("commands:update", (_e, input: UpdateCommandInput) =>
    dbUpdateCommand(db, input)
  );
  ipcMain.handle("commands:delete", (_e, id: number) =>
    dbDeleteCommand(db, id)
  );
  ipcMain.handle("commands:toggleFavorite", (_e, id: number) =>
    dbToggleFavorite(db, id)
  );
  ipcMain.handle("commands:reorder", (_e, orderedIds: number[]) =>
    dbReorderCommands(db, orderedIds)
  );

  // ─── Notes ────────────────────────────────────────────────
  ipcMain.handle("notes:getByProject", (_e, projectId: number) =>
    dbGetNotes(db, projectId)
  );
  ipcMain.handle("notes:create", (_e, input: CreateNoteInput) =>
    dbCreateNote(db, input)
  );
  ipcMain.handle("notes:update", (_e, input: UpdateNoteInput) =>
    dbUpdateNote(db, input)
  );
  ipcMain.handle("notes:delete", (_e, id: number) => dbDeleteNote(db, id));
  ipcMain.handle("notes:reorder", (_e, orderedIds: number[]) =>
    dbReorderNotes(db, orderedIds)
  );

  // ─── Tags ─────────────────────────────────────────────────
  ipcMain.handle("tags:getAll", () => dbGetTags(db));

  // ─── Clipboard ────────────────────────────────────────────
  ipcMain.handle("clipboard:write", (_e, text: string) => {
    clipboard.writeText(text);
  });

  // ─── Recherche unifiée ────────────────────────────────────
  ipcMain.handle("data:search", (_e, query: string) => ({
    commands: dbSearchCommands(db, query),
    notes: dbSearchNotes(db, query),
  }));

  // ─── Export ───────────────────────────────────────────────
  ipcMain.handle("data:export", async () => {
    const { filePath } = await dialog.showSaveDialog(win, {
      title: "Exporter les données OtterDesk",
      defaultPath: `otterdesk-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return { success: false };
    fs.writeFileSync(filePath, JSON.stringify(dbExportAll(db), null, 2), "utf-8");
    return { success: true };
  });

  // ─── Import ───────────────────────────────────────────────
  ipcMain.handle("data:import", async () => {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: "Importer des données OtterDesk",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (!filePaths.length) return { success: false };
    try {
      const data: ExportData = JSON.parse(fs.readFileSync(filePaths[0], "utf-8"));
      dbImportAll(db, data);
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // ─── Fenêtre + tray + hotkey (après les IPC) ──────────────
  const win = createWindow(iconPath);

  app.on("second-instance", () => {
    win.show();
    win.focus();
  });

  win.webContents.on("context-menu", (_e, params) => {
    const items: MenuItem[] = [];

    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        for (const s of params.dictionarySuggestions) {
          items.push(new MenuItem({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
        }
      } else {
        items.push(new MenuItem({ label: "Aucune suggestion", enabled: false }));
      }
      items.push(new MenuItem({ type: "separator" }));
      items.push(new MenuItem({
        label: "Ajouter au dictionnaire",
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      }));
      items.push(new MenuItem({ type: "separator" }));
    }

    if (params.isEditable) {
      items.push(new MenuItem({ role: "cut", label: "Couper" }));
      items.push(new MenuItem({ role: "copy", label: "Copier" }));
      items.push(new MenuItem({ role: "paste", label: "Coller" }));
    } else if (params.selectionText) {
      items.push(new MenuItem({ role: "copy", label: "Copier" }));
    }

    if (items.length > 0) Menu.buildFromTemplate(items).popup();
  });

  try {
    const tray = new Tray(iconPath);
    tray.setToolTip("OtterDesk");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Ouvrir OtterDesk", accelerator: "CommandOrControl+Shift+Space", click: () => { win.show(); win.focus(); } },
      { type: "separator" },
      { label: "Quitter", click: () => { isQuitting = true; app.quit(); } },
    ]));
    tray.on("click", () => { win.show(); win.focus(); });
  } catch (e) {
    console.error("Tray non disponible :", e);
  }

  try {
    globalShortcut.register("CommandOrControl+Shift+Space", () => {
      if (win.isVisible() && win.isFocused()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    });
  } catch (e) {
    console.error("Raccourci global non disponible :", e);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(iconPath);
  });
});

app.on("before-quit", () => { isQuitting = true; });
app.on("will-quit", () => { globalShortcut.unregisterAll(); });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

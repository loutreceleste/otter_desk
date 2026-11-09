import { BrowserWindow, Menu, MenuItem, Tray, app, clipboard, dialog, globalShortcut, ipcMain, nativeImage } from "electron";
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
  dbGetCommandText,
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
  dbBackup,
  getDb,
  validateExportData,
} from "./db";
import { seedDemoData } from "./seed";
import { APP_ZOOM_FACTOR, MAC_TRAFFIC_LIGHT_POSITION } from "../shared/windowLayout";
import { createTerminals, nativeConfirm, registerTerminalIpc, type TerminalsHandle } from "./terminals";
import { globalShortcutFor, type AppInfo, type GlobalShortcutInfo } from "../shared/appInfo";

let isQuitting = false;
// Référence de module : évite que le garbage collector supprime l'icône du tray
let tray: Tray | null = null;
// Envoi de commandes vers les terminaux (macOS uniquement)
let terminals: TerminalsHandle | null = null;
let mainWindow: BrowserWindow | null = null;

const isMac = process.platform === "darwin";

// Raccourci global afficher / masquer (macOS : ⌘⌥⇧D ; Windows : inchangé).
const SHORTCUT = globalShortcutFor(process.platform);
let shortcutInfo: GlobalShortcutInfo = { ...SHORTCUT, registered: false, message: "Raccourci non encore enregistré." };

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

/** Chemin d'un fichier de resources/ (copié via extraResources une fois packagé). */
function resourcePath(file: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, file)
    : path.join(app.getAppPath(), "resources", file);
}

// ─── Garde-fous de type pour les paramètres IPC ─────────────
function asId(v: unknown): number {
  if (!Number.isInteger(v)) throw new Error("Identifiant invalide");
  return v as number;
}
function asIds(v: unknown): number[] {
  if (!Array.isArray(v)) throw new Error("Liste d'identifiants invalide");
  return v.map(asId);
}
function asString(v: unknown): string {
  if (typeof v !== "string") throw new Error("Texte attendu");
  return v;
}
function asObject<T>(v: unknown): T {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("Objet attendu");
  return v as T;
}

/** Menu applicatif macOS minimal : rétablit ⌘C/⌘V/⌘X/⌘A/⌘Z/⌘⇧Z/⌘W/⌘M/⌘Q. */
function buildMacMenu(): Menu {
  return Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    { role: "windowMenu" },
  ]);
}

function createWindow(iconPath: string): BrowserWindow {

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "OtterDesk",
    backgroundColor: "#18181b",
    center: true,
    // macOS : feux tricolores natifs sur la barre de titre React ;
    // Windows : fenêtre sans cadre avec boutons personnalisés (inchangé)
    ...(isMac
      ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: MAC_TRAFFIC_LIGHT_POSITION }
      : { frame: false, icon: iconPath }),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  win.on("ready-to-show", () => {
    win.webContents.setZoomFactor(APP_ZOOM_FACTOR);
    win.show();
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      // macOS : masquer une fenêtre en plein écran laisse un espace noir
      if (isMac && win.isFullScreen()) {
        win.once("leave-full-screen", () => win.hide());
        win.setFullScreen(false);
      } else {
        win.hide();
      }
    }
  });
  // Navigation : tout est refusé par défaut. La fenêtre n'affiche que l'interface locale ;
  // un lien présent dans un contenu (note importée, fichier glissé…) ne doit ni naviguer
  // dans la fenêtre (le preload y exposerait window.api) ni ouvrir automatiquement une
  // URL externe. Une ouverture externe future devra passer par une action explicite et
  // une URL validée par le processus principal.
  // Seule exception : le rechargement de la page de l'application elle-même (même URL),
  // utilisé par l'interface après un import.
  const isAppReload = (url: string): boolean => {
    const strip = (u: string) => u.split("#")[0];
    const current = win.webContents.getURL();
    return current !== "" && strip(url) === strip(current);
  };
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => {
    if (!isAppReload(event.url)) event.preventDefault();
  });
  win.webContents.on("will-frame-navigate", (event) => {
    if (!(event.isMainFrame && isAppReload(event.url))) event.preventDefault();
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());

  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(async () => {
  // Seconde instance : elle se ferme sans rien initialiser (base, pont terminaux…),
  // sinon elle supprimerait le socket de l'instance principale.
  if (!gotLock) return;

  const db = getDb();
  seedDemoData(db);

  // ─── Terminaux (macOS) : pont local VS Code + Terminal.app ─
  if (isMac) {
    try {
      terminals = await createTerminals({
        userDataPath: app.getPath("userData"),
        appVersion: app.getVersion(),
        log: (m) => console.log(m),
        // Confirmations décidées et affichées par le processus principal (jamais par le renderer)
        confirm: nativeConfirm(() => mainWindow),
      });
    } catch (e) {
      console.error("Envoi vers les terminaux indisponible :", e);
      terminals = null;
    }
  }
  // Le texte envoyé vers un terminal est toujours relu en base à partir de son identifiant.
  registerTerminalIpc(terminals, () => mainWindow, (commandId) => dbGetCommandText(db, commandId));

  const iconPath = resourcePath("icon.ico");

  // macOS : menu natif (raccourcis d'édition, ⌘W, ⌘Q) ;
  // Windows : supprime complètement la barre de menu native (inchangé)
  Menu.setApplicationMenu(isMac ? buildMacMenu() : null);

  // En dev, le Dock afficherait l'icône Electron par défaut
  if (isMac && !app.isPackaged) {
    const devIcon = nativeImage.createFromPath(resourcePath("icon-mac.png"));
    if (!devIcon.isEmpty()) app.dock?.setIcon(devIcon);
  }

  // ─── Window controls ──────────────────────────────────────
  // ─── Informations d'application (version réelle, raccourci) ─
  ipcMain.handle("app:getInfo", (): AppInfo => ({ version: app.getVersion(), shortcut: shortcutInfo }));

  ipcMain.handle("window:minimize", () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.handle("window:maximize", () => {
    const w = BrowserWindow.getFocusedWindow();
    if (w?.isMaximized()) w.unmaximize(); else w?.maximize();
  });
  // X cache la fenêtre dans le tray ; quitter via le menu tray
  ipcMain.handle("window:close", () => { win.hide(); });

  // ─── Projects ─────────────────────────────────────────────
  ipcMain.handle("projects:getAll", () => dbGetProjects(db));
  ipcMain.handle("projects:create", (_e, input: unknown) =>
    dbCreateProject(db, asObject<CreateProjectInput>(input))
  );
  ipcMain.handle("projects:update", (_e, input: unknown) =>
    dbUpdateProject(db, asObject<UpdateProjectInput>(input))
  );
  ipcMain.handle("projects:delete", (_e, id: unknown) =>
    dbDeleteProject(db, asId(id))
  );

  // ─── Commands ─────────────────────────────────────────────
  ipcMain.handle("commands:getByProject", (_e, projectId: unknown) =>
    dbGetCommands(db, asId(projectId))
  );
  ipcMain.handle("commands:search", (_e, query: unknown) =>
    dbSearchCommands(db, asString(query))
  );
  ipcMain.handle("commands:create", (_e, input: unknown) =>
    dbCreateCommand(db, asObject<CreateCommandInput>(input))
  );
  ipcMain.handle("commands:update", (_e, input: unknown) =>
    dbUpdateCommand(db, asObject<UpdateCommandInput>(input))
  );
  ipcMain.handle("commands:delete", (_e, id: unknown) =>
    dbDeleteCommand(db, asId(id))
  );
  ipcMain.handle("commands:toggleFavorite", (_e, id: unknown) =>
    dbToggleFavorite(db, asId(id))
  );
  ipcMain.handle("commands:reorder", (_e, orderedIds: unknown) =>
    dbReorderCommands(db, asIds(orderedIds))
  );

  // ─── Notes ────────────────────────────────────────────────
  ipcMain.handle("notes:getByProject", (_e, projectId: unknown) =>
    dbGetNotes(db, asId(projectId))
  );
  ipcMain.handle("notes:create", (_e, input: unknown) =>
    dbCreateNote(db, asObject<CreateNoteInput>(input))
  );
  ipcMain.handle("notes:update", (_e, input: unknown) =>
    dbUpdateNote(db, asObject<UpdateNoteInput>(input))
  );
  ipcMain.handle("notes:delete", (_e, id: unknown) => dbDeleteNote(db, asId(id)));
  ipcMain.handle("notes:reorder", (_e, orderedIds: unknown) =>
    dbReorderNotes(db, asIds(orderedIds))
  );

  // ─── Tags ─────────────────────────────────────────────────
  ipcMain.handle("tags:getAll", () => dbGetTags(db));

  // ─── Clipboard ────────────────────────────────────────────
  ipcMain.handle("clipboard:write", (_e, text: unknown) => {
    clipboard.writeText(asString(text));
  });

  // ─── Recherche unifiée ────────────────────────────────────
  ipcMain.handle("data:search", (_e, query: unknown) => {
    const q = asString(query);
    return {
      commands: dbSearchCommands(db, q),
      notes: dbSearchNotes(db, q),
    };
  });

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
  // 1. validation complète du JSON avant écriture
  // 2. sauvegarde automatique de la base dans userData/backups
  // 3. import transactionnel (rollback automatique en cas d'erreur)
  ipcMain.handle("data:import", async () => {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: "Importer des données OtterDesk",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (!filePaths.length) return { success: false };
    try {
      const data: unknown = JSON.parse(fs.readFileSync(filePaths[0], "utf-8"));
      validateExportData(data);
      await dbBackup(db, "avant-import");
      dbImportAll(db, data as ExportData);
      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Import échoué :", message);
      await dialog.showMessageBox(win, {
        type: "error",
        title: "Import impossible",
        message: "L'import a échoué, aucune donnée n'a été modifiée.",
        detail: message,
      });
      return { success: false };
    }
  });

  // ─── Fenêtre + tray + hotkey (après les IPC) ──────────────
  const win = createWindow(iconPath);
  mainWindow = win;

  const showWindow = () => {
    if (isMac) app.show();
    win.show();
    win.focus();
  };

  app.on("second-instance", showWindow);

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
    // macOS : image « Template » monochrome (adaptée clair/sombre, @2x chargé automatiquement)
    let trayIcon: string | Electron.NativeImage = iconPath;
    if (isMac) {
      trayIcon = nativeImage.createFromPath(resourcePath("trayTemplate.png"));
      trayIcon.setTemplateImage(true);
    }
    tray = new Tray(trayIcon);
    tray.setToolTip("OtterDesk");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Ouvrir OtterDesk", accelerator: SHORTCUT.accelerator, click: showWindow },
      { type: "separator" },
      { label: "Quitter", click: () => { isQuitting = true; app.quit(); } },
    ]));
    tray.on("click", showWindow);
  } catch (e) {
    console.error("Tray non disponible :", e);
  }

  // Le résultat réel de register() est conservé et affiché dans « À propos » :
  // un raccourci refusé (déjà pris par une autre application) n'est jamais annoncé comme actif.
  try {
    const registered = globalShortcut.register(SHORTCUT.accelerator, () => {
      if (win.isVisible() && win.isFocused()) {
        // macOS : app.hide() rend le focus à l'application précédente
        if (isMac) app.hide(); else win.hide();
      } else {
        showWindow();
      }
    });
    shortcutInfo = registered && globalShortcut.isRegistered(SHORTCUT.accelerator)
      ? { ...SHORTCUT, registered: true }
      : {
          ...SHORTCUT,
          registered: false,
          message: "Raccourci déjà utilisé par une autre application : il est inactif dans OtterDesk.",
        };
    if (!shortcutInfo.registered) console.warn(`Raccourci global ${SHORTCUT.accelerator} indisponible`);
  } catch (e) {
    shortcutInfo = { ...SHORTCUT, registered: false, message: "Raccourci refusé par le système." };
    console.error("Raccourci global non disponible :", e);
  }

  // macOS : clic sur l'icône du Dock → réafficher la fenêtre existante (masquée, jamais détruite)
  app.on("activate", () => {
    if (!win.isDestroyed()) showWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  // Ferme le pont local (connexions VS Code, fichier socket) de façon synchrone :
  // la séquence de fermeture d'Electron n'est jamais interrompue.
  if (terminals) {
    const t = terminals;
    terminals = null;
    try {
      t.dispose();
    } catch (e) {
      console.error("Arrêt du pont terminaux :", e);
    }
  }
});
app.on("will-quit", () => { globalShortcut.unregisterAll(); });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

import Database from "better-sqlite3";
import { app } from "electron";
import fs from "fs";
import path from "path";

export type Project = {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: number;
  name: string;
};

export type Command = {
  id: number;
  project_id: number;
  title: string;
  command: string;
  description: string;
  category: string;
  is_favorite: number;
  created_at: string;
  updated_at: string;
};

export type CommandWithTags = Omit<Command, "is_favorite"> & {
  is_favorite: boolean;
  tags: Tag[];
};

export type Note = {
  id: number;
  project_id: number;
  title: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type CreateNoteInput = { project_id: number; title: string; content: string };
export type UpdateNoteInput = CreateNoteInput & { id: number };

export type CreateProjectInput = Omit<Project, "id" | "created_at" | "updated_at">;
export type UpdateProjectInput = Omit<Project, "created_at" | "updated_at">;
export type CreateCommandInput = {
  project_id: number;
  title: string;
  command: string;
  description: string;
  category: string;
  is_favorite: boolean;
  tags: string[];
};
export type UpdateCommandInput = CreateCommandInput & { id: number };

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = path.join(app.getPath("userData"), "otterdesk.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      color       TEXT    NOT NULL DEFAULT '#6366f1',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS commands (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title       TEXT    NOT NULL,
      command     TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      category    TEXT    NOT NULL DEFAULT 'Custom',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS command_tags (
      command_id INTEGER NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
      tag_id     INTEGER NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
      PRIMARY KEY (command_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title       TEXT    NOT NULL,
      content     TEXT    NOT NULL DEFAULT '',
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration : ajoute la colonne position aux bases existantes
  try {
    db.exec("ALTER TABLE commands ADD COLUMN position INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE commands SET position = id");
  } catch {}
}

function fetchTagsForCommand(db: Database.Database, commandId: number): Tag[] {
  return db
    .prepare(
      `SELECT t.id, t.name FROM tags t
       JOIN command_tags ct ON ct.tag_id = t.id
       WHERE ct.command_id = ? ORDER BY t.name`
    )
    .all(commandId) as Tag[];
}

function upsertTags(db: Database.Database, names: string[]): number[] {
  const insertTag = db.prepare(
    "INSERT OR IGNORE INTO tags (name) VALUES (?)"
  );
  const getId = db.prepare("SELECT id FROM tags WHERE name = ?");
  return names
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
    .map((name) => {
      insertTag.run(name);
      return (getId.get(name) as Tag).id;
    });
}

function enrichCommand(db: Database.Database, row: Command): CommandWithTags {
  return {
    ...row,
    is_favorite: row.is_favorite !== 0,
    tags: fetchTagsForCommand(db, row.id),
  };
}

// ─── Projects ──────────────────────────────────────────────────────────────

export function dbGetProjects(db: Database.Database): Project[] {
  return db
    .prepare("SELECT * FROM projects ORDER BY name ASC")
    .all() as Project[];
}

export function dbCreateProject(
  db: Database.Database,
  input: CreateProjectInput
): Project {
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO projects (name, description, color) VALUES (?, ?, ?)"
    )
    .run(input.name, input.description, input.color);
  return db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(lastInsertRowid) as Project;
}

export function dbUpdateProject(
  db: Database.Database,
  input: UpdateProjectInput
): Project {
  db.prepare(
    "UPDATE projects SET name=?, description=?, color=?, updated_at=datetime('now') WHERE id=?"
  ).run(input.name, input.description, input.color, input.id);
  return db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(input.id) as Project;
}

export function dbDeleteProject(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

// ─── Commands ──────────────────────────────────────────────────────────────

export function dbGetCommands(
  db: Database.Database,
  projectId: number
): CommandWithTags[] {
  const rows = db
    .prepare(
      "SELECT * FROM commands WHERE project_id = ? ORDER BY position ASC, id ASC"
    )
    .all(projectId) as Command[];
  return rows.map((r) => enrichCommand(db, r));
}

export function dbSearchCommands(
  db: Database.Database,
  query: string
): CommandWithTags[] {
  const pattern = `%${query.toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT DISTINCT c.* FROM commands c
       LEFT JOIN command_tags ct ON ct.command_id = c.id
       LEFT JOIN tags t ON t.id = ct.tag_id
       WHERE lower(c.title) LIKE ?
          OR lower(c.command) LIKE ?
          OR lower(c.description) LIKE ?
          OR lower(c.category) LIKE ?
          OR lower(t.name) LIKE ?
       ORDER BY c.title ASC`
    )
    .all(pattern, pattern, pattern, pattern, pattern) as Command[];
  return rows.map((r) => enrichCommand(db, r));
}

export function dbCreateCommand(
  db: Database.Database,
  input: CreateCommandInput
): CommandWithTags {
  const { m } = db
    .prepare("SELECT COALESCE(MAX(position), -1) as m FROM commands WHERE project_id = ?")
    .get(input.project_id) as { m: number };
  const insertCmd = db.prepare(
    `INSERT INTO commands (project_id, title, command, description, category, is_favorite, position)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const { lastInsertRowid } = insertCmd.run(
    input.project_id,
    input.title,
    input.command,
    input.description,
    input.category,
    input.is_favorite ? 1 : 0,
    m + 1
  );
  const id = Number(lastInsertRowid);
  const tagIds = upsertTags(db, input.tags);
  const insertCT = db.prepare(
    "INSERT OR IGNORE INTO command_tags (command_id, tag_id) VALUES (?, ?)"
  );
  tagIds.forEach((tid) => insertCT.run(id, tid));
  return enrichCommand(
    db,
    db.prepare("SELECT * FROM commands WHERE id = ?").get(id) as Command
  );
}

export function dbUpdateCommand(
  db: Database.Database,
  input: UpdateCommandInput
): CommandWithTags {
  db.prepare(
    `UPDATE commands SET project_id=?, title=?, command=?, description=?, category=?, is_favorite=?, updated_at=datetime('now') WHERE id=?`
  ).run(
    input.project_id,
    input.title,
    input.command,
    input.description,
    input.category,
    input.is_favorite ? 1 : 0,
    input.id
  );
  db.prepare("DELETE FROM command_tags WHERE command_id = ?").run(input.id);
  const tagIds = upsertTags(db, input.tags);
  const insertCT = db.prepare(
    "INSERT OR IGNORE INTO command_tags (command_id, tag_id) VALUES (?, ?)"
  );
  tagIds.forEach((tid) => insertCT.run(input.id, tid));
  return enrichCommand(
    db,
    db.prepare("SELECT * FROM commands WHERE id = ?").get(input.id) as Command
  );
}

/**
 * Texte brut d'une commande enregistrée (champ « command »), ou null si elle n'existe pas.
 * Utilisé par l'envoi vers un terminal : le texte envoyé provient toujours de la base,
 * jamais d'une chaîne fournie par le renderer.
 */
export function dbGetCommandText(db: Database.Database, id: number): string | null {
  const row = db.prepare("SELECT command FROM commands WHERE id = ?").get(id) as { command: string } | undefined;
  return row ? row.command : null;
}

export function dbDeleteCommand(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM commands WHERE id = ?").run(id);
}

export function dbToggleFavorite(
  db: Database.Database,
  id: number
): boolean {
  const current = (
    db
      .prepare("SELECT is_favorite FROM commands WHERE id = ?")
      .get(id) as Command
  ).is_favorite;
  const next = current !== 0 ? 0 : 1;
  db.prepare(
    "UPDATE commands SET is_favorite = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(next, id);
  return next !== 0;
}

export function dbReorderCommands(db: Database.Database, orderedIds: number[]): void {
  const stmt = db.prepare("UPDATE commands SET position = ? WHERE id = ?");
  db.transaction(() => {
    orderedIds.forEach((id, index) => stmt.run(index, id));
  })();
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export function dbGetNotes(db: Database.Database, projectId: number): Note[] {
  return db
    .prepare("SELECT * FROM notes WHERE project_id = ? ORDER BY position ASC, id ASC")
    .all(projectId) as Note[];
}

export function dbCreateNote(db: Database.Database, input: CreateNoteInput): Note {
  const { m } = db
    .prepare("SELECT COALESCE(MAX(position), -1) as m FROM notes WHERE project_id = ?")
    .get(input.project_id) as { m: number };
  const { lastInsertRowid } = db
    .prepare("INSERT INTO notes (project_id, title, content, position) VALUES (?, ?, ?, ?)")
    .run(input.project_id, input.title, input.content, m + 1);
  return db.prepare("SELECT * FROM notes WHERE id = ?").get(lastInsertRowid) as Note;
}

export function dbUpdateNote(db: Database.Database, input: UpdateNoteInput): Note {
  db.prepare(
    "UPDATE notes SET title=?, content=?, updated_at=datetime('now') WHERE id=?"
  ).run(input.title, input.content, input.id);
  return db.prepare("SELECT * FROM notes WHERE id = ?").get(input.id) as Note;
}

export function dbDeleteNote(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}

export function dbReorderNotes(db: Database.Database, orderedIds: number[]): void {
  const stmt = db.prepare("UPDATE notes SET position = ? WHERE id = ?");
  db.transaction(() => {
    orderedIds.forEach((id, index) => stmt.run(index, id));
  })();
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export function dbGetTags(db: Database.Database): Tag[] {
  return db.prepare("SELECT * FROM tags ORDER BY name ASC").all() as Tag[];
}

// ─── Search notes ────────────────────────────────────────────────────────────

export function dbSearchNotes(db: Database.Database, query: string): Note[] {
  const pattern = `%${query.toLowerCase()}%`;
  return db
    .prepare(
      `SELECT * FROM notes WHERE lower(title) LIKE ? OR lower(content) LIKE ? ORDER BY title ASC`
    )
    .all(pattern, pattern) as Note[];
}

// ─── Export / Import ─────────────────────────────────────────────────────────

export type ExportData = {
  version: string;
  exportedAt: string;
  projects: Array<{
    name: string;
    description: string;
    color: string;
    commands: Array<{
      title: string;
      command: string;
      description: string;
      category: string;
      is_favorite: boolean;
      tags: string[];
    }>;
    notes: Array<{ title: string; content: string }>;
  }>;
};

export function dbExportAll(db: Database.Database): ExportData {
  const projects = dbGetProjects(db);
  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    projects: projects.map((p) => ({
      name: p.name,
      description: p.description,
      color: p.color,
      commands: dbGetCommands(db, p.id).map((c) => ({
        title: c.title,
        command: c.command,
        description: c.description,
        category: c.category,
        is_favorite: c.is_favorite,
        tags: c.tags.map((t) => t.name),
      })),
      notes: dbGetNotes(db, p.id).map((n) => ({
        title: n.title,
        content: n.content,
      })),
    })),
  };
}

/**
 * Vérifie la structure d'un export OtterDesk avant toute écriture en base.
 * Lève une erreur explicite au premier champ invalide.
 */
export function validateExportData(data: unknown): asserts data is ExportData {
  const isStr = (v: unknown): v is string => typeof v === "string";
  const fail = (where: string): never => {
    throw new Error(`Fichier d'import invalide : ${where}`);
  };
  if (typeof data !== "object" || data === null) fail("contenu JSON non objet");
  const projects = (data as { projects?: unknown }).projects;
  if (!Array.isArray(projects)) fail("champ « projects » manquant");
  (projects as unknown[]).forEach((p, i) => {
    const at = `projet #${i + 1}`;
    if (typeof p !== "object" || p === null) fail(at);
    const proj = p as Record<string, unknown>;
    if (!isStr(proj.name) || !isStr(proj.description) || !isStr(proj.color)) fail(`${at} (name/description/color)`);
    if (!Array.isArray(proj.commands) || !Array.isArray(proj.notes)) fail(`${at} (commands/notes)`);
    (proj.commands as unknown[]).forEach((c, j) => {
      const cmd = c as Record<string, unknown> | null;
      if (
        typeof cmd !== "object" || cmd === null ||
        !isStr(cmd.title) || !isStr(cmd.command) || !isStr(cmd.description) || !isStr(cmd.category) ||
        (typeof cmd.is_favorite !== "boolean" && typeof cmd.is_favorite !== "number") ||
        !Array.isArray(cmd.tags) || !(cmd.tags as unknown[]).every(isStr)
      ) fail(`${at}, commande #${j + 1}`);
    });
    (proj.notes as unknown[]).forEach((n, j) => {
      const note = n as Record<string, unknown> | null;
      if (typeof note !== "object" || note === null || !isStr(note.title) || !isStr(note.content)) {
        fail(`${at}, note #${j + 1}`);
      }
    });
  });
}

/** Sauvegarde à chaud de la base (API backup SQLite) dans userData/backups. */
export async function dbBackup(db: Database.Database, label: string): Promise<string> {
  const dir = path.join(app.getPath("userData"), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `otterdesk-${label}-${stamp}.db`);
  await db.backup(file);
  return file;
}

export function dbImportAll(db: Database.Database, data: ExportData): void {
  db.transaction(() => {
    for (const p of data.projects) {
      const project = dbCreateProject(db, {
        name: p.name,
        description: p.description,
        color: p.color,
      });
      for (const c of p.commands) {
        dbCreateCommand(db, { ...c, project_id: project.id });
      }
      for (const n of p.notes) {
        dbCreateNote(db, { ...n, project_id: project.id });
      }
    }
  })();
}

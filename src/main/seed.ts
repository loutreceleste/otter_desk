import Database from "better-sqlite3";

export function seedDemoData(db: Database.Database): void {
  const count = (
    db.prepare("SELECT COUNT(*) as n FROM projects").get() as { n: number }
  ).n;
  if (count > 0) return;

  const insertProject = db.prepare(
    "INSERT INTO projects (name, description, color) VALUES (?, ?, ?)"
  );
  const insertCmd = db.prepare(
    `INSERT INTO commands (project_id, title, command, description, category, is_favorite)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  // Projet 1 : Smart Santé HR Tool
  const p1 = Number(
    insertProject.run(
      "Smart Santé HR Tool",
      "Application RH pour le secteur santé",
      "#6366f1"
    ).lastInsertRowid
  );
  [
    ["Git Status", "git status", "Affiche l'état du dépôt", "Git", 0],
    ["Git Checkout branche", "git checkout -b feature/ma-branche", "Créer et basculer sur une nouvelle branche", "Git", 0],
    ["Docker Compose Up", "docker compose up -d", "Lance les conteneurs en arrière-plan", "Docker", 0],
    ["Symfony Cache Clear", "php bin/console cache:clear", "Vide le cache Symfony", "Symfony", 1],
    ["Doctrine Migrate", "php bin/console doctrine:migrations:migrate --no-interaction", "Exécute les migrations", "Database", 0],
    ["Messenger Consume", "php bin/console messenger:consume async -vv", "Consomme la file async", "Symfony", 0],
  ].forEach(([t, c, d, cat, fav]) => insertCmd.run(p1, t, c, d, cat, fav));

  // Projet 2 : Projet Next.js
  const p2 = Number(
    insertProject.run("Projet Next.js", "Application web Next.js 14", "#06b6d4")
      .lastInsertRowid
  );
  [
    ["NPM Install", "npm install", "Installe les dépendances", "NPM", 0],
    ["Dev Server", "npm run dev", "Lance le serveur de développement", "NPM", 1],
    ["Build", "npm run build", "Build de production", "NPM", 0],
    ["Lint", "npm run lint", "Vérifie le code avec ESLint", "NPM", 0],
  ].forEach(([t, c, d, cat, fav]) => insertCmd.run(p2, t, c, d, cat, fav));

  // Projet 3 : Général
  const p3 = Number(
    insertProject.run("Général", "Commandes communes tous projets", "#22c55e")
      .lastInsertRowid
  );
  [
    ["Git Pull", "git pull origin main", "Récupère les dernières modifications", "Git", 1],
    ["Git Push", "git push origin HEAD", "Pousse la branche courante", "Git", 1],
    ["Git Branch Delete", "git branch -d ma-branche", "Supprime une branche locale", "Git", 0],
    ["Docker PS", "docker ps", "Liste les conteneurs en cours d'exécution", "Docker", 0],
  ].forEach(([t, c, d, cat, fav]) => insertCmd.run(p3, t, c, d, cat, fav));

  // Tags
  db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run("prod");
  db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run("dev");
  db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run("migration");
}

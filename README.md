# OtterDesk 🦦

Gestionnaire local de commandes CLI pour développeurs Windows.

Organisez, retrouvez et copiez rapidement vos commandes par projet et par catégorie.

## Prérequis

- [Node.js](https://nodejs.org/) >= 18
- npm

## Installation

```bash
npm install
```

## Lancement en développement

```bash
npm run dev
```

Ouvre la fenêtre Electron avec le hot-reload Vite.

## Build de production

```bash
npm run dist
```

Génère l'installeur `.exe` dans le dossier `release/`.

## Stack technique

| Couche | Techno |
|--------|--------|
| Framework desktop | Electron 32 |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Build tool | electron-vite |
| Base de données | SQLite via better-sqlite3 (local, AppData) |
| Packaging | electron-builder → .exe NSIS + Portable |

## Architecture

```
src/
  main/          # Process principal Electron (IPC + SQLite)
    index.ts     # Fenêtre + handlers IPC
    db.ts        # Toutes les opérations SQLite
    seed.ts      # Données de démonstration
  preload/
    index.ts     # Bridge contextBridge → window.api
  renderer/
    index.html
    src/
      features/  # Logique métier (projects, commands)
      components/# Composants UI réutilisables
      hooks/     # useProjects, useCommands
      lib/       # ipc.ts (appels window.api)
      types/     # Types TypeScript partagés
```

## Fonctionnalités

- Gestion de projets (nom, description, couleur)
- Commandes par projet et catégorie
- Tags libres
- Favoris
- Recherche en temps réel (titre, commande, description, tags)
- Copie en 1 clic dans le presse-papier
- Thème clair / sombre
- Données de démonstration au premier lancement

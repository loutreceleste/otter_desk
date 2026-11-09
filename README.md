# OtterDesk 🦦

[![Dernière version](https://img.shields.io/github/v/release/loutreceleste/otter_desk?sort=semver&label=derni%C3%A8re%20version)](https://github.com/loutreceleste/otter_desk/releases/latest)

Gestionnaire local de commandes CLI pour développeurs, sous macOS et Windows.

Organisez, retrouvez et réutilisez vos commandes par projet et par catégorie : copie en un
clic, ou, sur macOS, **envoi direct vers un terminal VS Code, iTerm2 ou Terminal.app**.

## Télécharger OtterDesk

### macOS — Apple Silicon (M1, M2, M3 et suivants)

**[⬇︎ Télécharger OtterDesk pour macOS (.dmg)](https://github.com/loutreceleste/otter_desk/releases/latest/download/OtterDesk-mac-arm64.dmg)**

**[Voir la dernière version et ses nouveautés](https://github.com/loutreceleste/otter_desk/releases/latest)**

Ces liens pointent toujours vers la dernière version stable publiée. Ils deviennent actifs
dès la publication de la première release.

Installation :

1. Téléchargez le DMG.
2. Ouvrez le fichier.
3. Glissez **OtterDesk** dans **Applications**.
4. Lancez OtterDesk.

> **Premier lancement.** OtterDesk est signé ad hoc mais **n'est pas notarisé par Apple**
> (pas de compte Apple Developer). macOS bloque donc la première ouverture d'une copie
> téléchargée :
>
> 1. Double-cliquez sur OtterDesk dans **Applications** : macOS affiche un message indiquant
>    qu'il n'a pas pu vérifier l'application. Fermez ce message (**Terminé**).
> 2. Ouvrez **Réglages Système › Confidentialité et sécurité**, descendez jusqu'à la section
>    **Sécurité** et cliquez sur **Ouvrir quand même** en face d'OtterDesk (le bouton reste
>    visible environ une heure après la tentative d'ouverture).
> 3. Confirmez avec **Ouvrir quand même**, puis saisissez votre mot de passe.
>
> Ces étapes ne sont nécessaires qu'une fois par version. Depuis macOS 15, le clic droit ›
> **Ouvrir** ne suffit plus. Si macOS indique que l'application « est endommagée », ou en
> cas de blocage persistant, retirez l'attribut de quarantaine dans un terminal :
> `xattr -dr com.apple.quarantine /Applications/OtterDesk.app`

### Windows — 64 bits (Windows 10 et 11)

**[⬇︎ Télécharger OtterDesk — Installateur (.exe)](https://github.com/loutreceleste/otter_desk/releases/latest/download/OtterDesk-Windows-Setup-x64.exe)**

**[⬇︎ Télécharger OtterDesk — Version portable (.exe)](https://github.com/loutreceleste/otter_desk/releases/latest/download/OtterDesk-Windows-Portable-x64.exe)**

Ces liens pointent toujours vers la dernière version stable publiée. Aucune installation de
Node.js ni d'outil de développement n'est nécessaire.

**Installation classique** (recommandée) :

1. Téléchargez l'installateur Windows.
2. Exécutez le fichier `.exe`.
3. L'installation se fait en un clic, sans droits administrateur, pour votre compte
   Windows uniquement. OtterDesk se lance à la fin de l'installation.
4. Ensuite, lancez OtterDesk depuis le menu **Démarrer** ou le raccourci du Bureau.

Pour désinstaller : **Paramètres › Applications › Applications installées › OtterDesk**.
Vos données sont conservées.

**Version portable** :

1. Téléchargez la version portable.
2. Placez le fichier dans le dossier de votre choix (par exemple une clé USB).
3. Exécutez-le directement : aucune installation n'est nécessaire.

La version portable ne s'installe pas, mais elle conserve ses données dans votre dossier
utilisateur Windows (`%APPDATA%\otter-desk`), comme la version installée : les deux versions
partagent donc les mêmes projets et commandes. Son démarrage est un peu plus lent, car elle
se décompresse à chaque lancement.

> **Avertissement SmartScreen.** Les exécutables OtterDesk ne sont pas encore signés avec un
> certificat de signature de code. Au premier lancement, Windows peut afficher « Windows a
> protégé votre ordinateur » : cliquez sur **Informations complémentaires**, vérifiez que le
> fichier s'appelle bien `OtterDesk-Windows-…-x64.exe`, puis sur **Exécuter quand même**. Votre
> navigateur peut aussi signaler un fichier « peu téléchargé » : choisissez **Conserver**.
> Ne désactivez ni SmartScreen ni Windows Defender. Pour vérifier l'intégrité du fichier,
> comparez son empreinte à celle du fichier `SHA256SUMS.txt` de la release :
> `Get-FileHash .\OtterDesk-Windows-Setup-x64.exe -Algorithm SHA256` (PowerShell).

Sous Windows, l'envoi direct vers un terminal n'est pas disponible (fonction macOS) : utilisez
**Copier**. Le raccourci global afficher / masquer est **Ctrl+Shift+Space**.

## Fonctionnalités

- Projets (nom, description, couleur), commandes par catégorie, tags libres, favoris
- Notes par projet (éditeur riche)
- Recherche en temps réel (titre, commande, description, tags)
- Copie en 1 clic dans le presse-papier
- **macOS : envoi d'une commande vers un terminal précis** (VS Code, iTerm2, Terminal.app),
  avec affichage automatique du terminal destinataire
- Raccourci global afficher / masquer : **⌘⌥⇧D** sur macOS, **Ctrl+Shift+Space** sur Windows
- Thème clair / sombre, typographies Funnel Display (interface) et IBM Plex Mono (commandes)
- Export / import JSON, sauvegarde automatique avant import
- Données de démonstration au premier lancement

## Envoyer une commande vers un terminal (macOS)

À côté du bouton **Copier**, le bouton **Envoyer** (icône terminal) ouvre la liste des
terminaux disponibles, regroupés par application et par projet :

```
Envoyer vers…
VS Code — bulle-back-end
  ● zsh            prêt
  ● npm            occupé : npm run dev
  ● Claude Code    occupé : claude
VS Code — johanna-kinesiologue
  ● zsh            prêt
iTerm2 — Fenêtre 1
  ● Onglet 1 — ~/projets/bulle (-zsh)          prêt
  ● Onglet 2 · panneau 2 — claude               occupé : claude
Terminal.app
  ● Fenêtre 1 — zsh   exécution uniquement
```

Chaque cible est identifiée par un identifiant interne unique (fenêtre VS Code + terminal,
session iTerm2, onglet Terminal) : deux terminaux portant le même nom ne sont jamais confondus.
Les fenêtres sont numérotées dans leur ordre de création, ce numéro ne change donc pas quand
vous passez d'une fenêtre à l'autre.

Le bouton **Envoyer** n'est actif que pour une commande sur une seule ligne (sinon, utilisez
**Copier**). Pour une commande à plusieurs étapes, chaque étape a son propre bouton.

- **Clic sur un terminal : insérer.** La commande est saisie sans être exécutée. Relisez-la,
  puis appuyez sur Entrée dans le terminal.
- **▶ Exécuter : insérer puis exécuter.** OtterDesk indique que la commande a été
  *transmise*. Le résultat s'affiche dans le terminal : OtterDesk ne prétend pas qu'elle a
  réussi.
- Le dernier terminal utilisé pour chaque projet est mis en avant. S'il n'existe plus,
  OtterDesk le signale et demande de choisir une autre cible. Aucune commande n'est jamais
  envoyée ailleurs à votre insu.

### Afficher le terminal après l'envoi

Préférence dans **À propos › Préférences**, **activée par défaut**. Après la transmission,
OtterDesk met au premier plan le terminal destinataire :

- **VS Code** : la fenêtre du projet concerné passe au premier plan, avec le panneau Terminal
  visible et le terminal exact sélectionné. Cela fonctionne avec plusieurs fenêtres et
  plusieurs projets ouverts.
- **iTerm2** : la bonne fenêtre, le bon onglet et le bon panneau sont sélectionnés, puis iTerm2
  passe au premier plan.
- **Terminal.app** : la bonne fenêtre et le bon onglet passent au premier plan.

Aucun nouveau terminal ni aucune nouvelle fenêtre n'est créé. Désactivée, l'option laisse
OtterDesk au premier plan. Si la commande est transmise mais que l'affichage échoue,
OtterDesk l'indique (« Commande transmise, mais impossible d'afficher le terminal ») sans
jamais renvoyer la commande. Le choix est mémorisé localement.

### Terminaux compatibles

| Application | Insérer | Exécuter | Détails |
|-------------|:-------:|:--------:|---------|
| VS Code (terminaux intégrés, plusieurs fenêtres) | ✅ | ✅ | via l'extension compagnon, état fourni par Shell Integration |
| iTerm2 (fenêtres, onglets, panneaux divisés) | ✅ | ✅ | AppleScript officiel (`write text … newline no`), sans Python ni module à installer ; état déduit du programme au premier plan |
| Terminal.app | — | ✅ | AppleScript : pas d'insertion sans exécution possible, exécution toujours confirmée |

**Autorisations macOS** : iTerm2 et Terminal.app sont pilotés par AppleScript. À la première
utilisation, macOS demande « OtterDesk souhaite contrôler iTerm2 / Terminal » ; elles se
gèrent ensuite dans **Réglages Système › Confidentialité et sécurité › Automatisation**.
OtterDesk ne lance jamais une application qui est fermée.

### Règles de sécurité

- Toutes les règles ci-dessous sont appliquées par le processus principal d'OtterDesk, et non
  par l'interface. Seules les commandes **enregistrées** dans OtterDesk peuvent être
  envoyées : le texte est relu dans la base au moment de l'envoi.
- Les confirmations s'affichent dans une **boîte de dialogue macOS** ouverte par OtterDesk.
  « Annuler » est le choix par défaut (Entrée ou Échap). L'état du terminal est revérifié
  après la confirmation : s'il a changé entre-temps, rien n'est envoyé.
- Une commande sur plusieurs lignes, ou contenant des caractères de contrôle, n'est jamais
  envoyée : utilisez Copier.
- **Terminal occupé** (commande ou CLI interactif en cours, ex. `claude`) : l'exécution est
  refusée, et l'insertion demande une confirmation, car c'est le programme en cours qui
  recevra le texte.
- **État inconnu** (pas de Shell Integration) : l'exécution demande une confirmation.
- **Commande potentiellement destructrice** (`rm -rf`, `git reset --hard`, `git push -f`,
  `docker system prune`, `DROP TABLE`, `sudo`…) : l'exécution demande une confirmation.
- Double-clic : un seul envoi par terminal à la fois (y compris pendant une confirmation), et
  une même commande n'est pas renvoyée deux fois en moins de 1,5 s.
- **Pas de réponse du terminal** (délai dépassé) : la commande a peut-être été transmise.
  OtterDesk l'indique et bloque un renvoi identique pendant 10 s. Vérifiez le terminal avant
  de recommencer.
- Limite d'API : ni VS Code, ni iTerm2, ni Terminal.app ne permettent de lire ce qui est déjà
  tapé sur la ligne de commande. Si une saisie est en cours, la commande insérée s'y ajoute.
- iTerm2 : l'état *prêt* ou *occupé* est déduit du programme au premier plan du terminal (un
  shell signifie prêt ; un autre programme, comme `npm` ou `claude`, signifie occupé).

### Dépannage

| Symptôme | Solution |
|----------|----------|
| « VS Code : Installez l'extension… » | Installer l'extension (ci-dessous) puis **Connecter VS Code…** |
| « Aucune fenêtre VS Code connectée » | Vérifier l'élément « OtterDesk » dans la barre d'état de VS Code ; commande **OtterDesk : Afficher l'état de la connexion** |
| VS Code non appairé après une mise à jour d'OtterDesk | Refaire **Connecter VS Code…** (le secret chiffré dépend de la signature de l'app) |
| « Terminal.app : autorisez OtterDesk… » / « iTerm2 : autorisez OtterDesk… » | **Réglages Système › Confidentialité et sécurité › Automatisation** › OtterDesk › Terminal / iTerm2 |
| « Commande transmise, mais impossible d'afficher le terminal » (VS Code) | Mettre à jour l'extension VS Code (version ≥ 0.2.0) |
| Le raccourci ⌘⌥⇧D est signalé « inactif » dans À propos | Le système l'a refusé : libérez-le dans l'application qui l'utilise, puis relancez OtterDesk |
| ⌘⌥⇧D déclenche une autre action | macOS accepte qu'une autre application déclare la même combinaison sans le signaler à OtterDesk : vérifiez les raccourcis de vos applications |
| Un terminal VS Code reste en « état inconnu » | Activer Shell Integration (`terminal.integrated.shellIntegration.enabled`) ou ouvrir un nouveau terminal |
| Bouton **Envoyer** grisé | La commande (ou l'étape) fait plusieurs lignes : utilisez **Copier** |
| « Code incorrect, ou serveur qui n'est pas OtterDesk » (VS Code) | Vérifiez le code affiché par OtterDesk ; après 3 erreurs ou 2 minutes, cliquez sur **Nouveau code** |
| « Aucun appairage en cours » (VS Code) | Le code a expiré ou a été annulé : relancez **Connecter VS Code…** dans OtterDesk |
| « Pas de confirmation de … : la commande a peut-être été transmise » | Regardez le terminal avant de renvoyer : la commande y est peut-être déjà |
| « OtterDesk est endommagé et ne peut pas être ouvert » | `xattr -dr com.apple.quarantine /Applications/OtterDesk.app` (voir Premier lancement) |

## Extension VS Code « OtterDesk — Terminal Bridge »

L'extension permet à OtterDesk de voir les terminaux intégrés de **toutes vos fenêtres
VS Code** et d'envoyer une commande au terminal exact choisi. Elle n'est pas publiée sur le
Marketplace et n'est pas incluse dans l'application : on l'installe manuellement, à partir
d'un fichier `.vsix` publié avec chaque version d'OtterDesk. Il n'y a pas d'installation
automatique.

### Installation

1. Téléchargez **[otterdesk-terminal-bridge.vsix](https://github.com/loutreceleste/otter_desk/releases/latest/download/otterdesk-terminal-bridge.vsix)**
   (dernière release). Le fichier arrive en général dans `~/Downloads`.
2. Installez-le **une seule fois**. Il sera actif dans toutes les fenêtres VS Code :
   - **Depuis VS Code** (le plus simple) : vue **Extensions** (⇧⌘X) › menu `…` en haut de la
     vue › **Install from VSIX…** (*Installer à partir d'un VSIX…*), puis choisissez le fichier ;
   - **ou dans un terminal**, si la commande `code` est installée (VS Code › palette de
     commandes › *Shell Command: Install 'code' command in PATH*) :
     ```bash
     code --install-extension ~/Downloads/otterdesk-terminal-bridge.vsix
     ```
   L'élément **OtterDesk** apparaît alors dans la barre d'état de VS Code.
3. Appairage, une seule fois également. OtterDesk doit être lancé :
   - dans OtterDesk : bouton **Envoyer** d'une commande › **Connecter VS Code…** ; un code
     `XXXX-XXXX` s'affiche (valable 2 minutes, 3 essais) ;
   - dans VS Code : palette de commandes (⇧⌘P) › **OtterDesk : Connecter à OtterDesk**,
     puis saisissez le code (ou cliquez sur l'élément **OtterDesk** de la barre d'état).

   Toutes les fenêtres VS Code se connectent alors automatiquement, et se reconnectent
   après un redémarrage d'OtterDesk ou de VS Code.
4. Premier envoi : dans OtterDesk, bouton **Envoyer** d'une commande › choisissez le
   terminal VS Code (clic pour insérer, **▶ Exécuter** pour exécuter).

Pour construire le VSIX depuis les sources : `cd vscode-extension && npm ci && npm run package`.

### Mises à jour

- **Extension** : à chaque nouvelle version d'OtterDesk, téléchargez le VSIX de la release et
  réinstallez-le (même méthode, ou `code --install-extension ~/Downloads/otterdesk-terminal-bridge.vsix --force`),
  puis rechargez les fenêtres VS Code (palette › *Developer: Reload Window*). L'appairage est
  conservé.
- **OtterDesk** : remplacez l'application dans **Applications** par celle du nouveau DMG (puis
  refaites l'étape *Premier lancement*). Chaque version étant signée ad hoc, macOS peut demander
  l'accès au trousseau pour « otter-desk Safe Storage » : choisissez **Toujours autoriser**.
  Si l'accès est refusé, ou si VS Code n'est plus connecté, refaites **Connecter VS Code…**.

**Révocation** : OtterDesk › **Connexion VS Code** › **Révoquer l'appairage**, ou VS Code ›
**OtterDesk : Oublier l'appairage OtterDesk**.

### Sécurité de la connexion locale

- Socket Unix local (fichier `terminal-bridge.sock` en droits `0600`, dans le dossier de
  données d'OtterDesk) : **aucun port réseau ouvert**.
- Appairage explicite par code à usage unique (3 essais au maximum). Ni le code ni le secret
  ne circulent en clair.
- Authentification **mutuelle** à chaque connexion (HMAC-SHA256) : OtterDesk n'accepte que
  l'extension appairée, et l'extension n'accepte d'ordres que de l'OtterDesk appairé.
- Le secret est stocké dans le Trousseau macOS : `safeStorage` côté OtterDesk,
  `SecretStorage` côté VS Code. Il n'est jamais écrit en clair ni versionné.
- Chaque message est validé strictement. L'extension revérifie chaque commande (une seule
  ligne, sans caractères de contrôle, terminal existant, pas d'exécution s'il est occupé).

Détails techniques : [vscode-extension/README.md](vscode-extension/README.md).

## Développement

### Prérequis

- [Node.js](https://nodejs.org/) LTS ≥ 22.12 (testé avec Node 26 LTS), npm ≥ 11
- macOS : Command Line Tools d'Xcode (`xcode-select --install`). Homebrew n'est pas nécessaire.

Installation de Node.js avec nvm :

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
# nouveau terminal, puis :
nvm install --lts && nvm alias default 'lts/*'
```

> **Terminal de VS Code** : il peut définir `ELECTRON_RUN_AS_NODE=1`, ce qui empêche
> Electron de démarrer (`Cannot read properties of undefined (reading 'requestSingleInstanceLock')`).
> Lancez `unset ELECTRON_RUN_AS_NODE` avant `npm run dev`.

### Commandes

```bash
npm ci               # dépendances (lockfile)
npm run dev          # lancement en développement (hot-reload)
npm test             # tests (sécurité des commandes, protocole, pont VS Code)
npm run dist:mac     # DMG arm64 → release/OtterDesk-<version>-arm64.dmg (sur un Mac)
npm run dist:win     # installateur NSIS + .exe portable x64 → release/ (Windows, ou macOS en compilation croisée)
```

Les scripts d'installation des dépendances sont filtrés par le champ `allowScripts` du
`package.json` (npm ≥ 11). Seuls esbuild et fsevents sont autorisés. Le script de
better-sqlite3 est refusé : le binaire SQLite précompilé (N-API) est fourni par le paquet,
aucune compilation native n'est donc nécessaire, ni sous macOS ni sous Windows.

Icônes : `npm run build` génère les icônes dérivées de `resources/icon.png` uniquement si
elles sont absentes. Après une modification du logo :
`FORCE_ICONS=mac node scripts/generate-icon.js` (cibles : `ico`, `mac`, `tray`, `all`).

### Stack technique

| Couche | Techno |
|--------|--------|
| Framework desktop | Electron 45 |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Typographies | Funnel Display (interface) et IBM Plex Mono (commandes), embarquées en WOFF2, licence SIL OFL 1.1 ; voir `src/renderer/src/fonts/` |
| Build tool | electron-vite |
| Base de données | SQLite via better-sqlite3 13 (N-API, binaires précompilés) |
| Packaging | electron-builder 26 → `.dmg` arm64 (macOS), `.exe` NSIS + Portable (Windows) |
| Extension VS Code | TypeScript, esbuild, @vscode/vsce |

### Architecture

```
src/
  main/                  # Processus principal Electron
    index.ts             # Fenêtre, menu, tray, handlers IPC
    db.ts / seed.ts      # SQLite
    terminals/           # Envoi vers les terminaux (macOS)
      terminalService.ts # Règles d'envoi (confirmation native, occupation, anti double-clic)
      sendRequest.ts     # Validation stricte des requêtes du renderer (référence à une commande)
      types.ts           # Interface TerminalProvider (VS Code, Terminal.app, iTerm2…)
      vscode/            # Pont local (socket Unix, appairage, authentification)
      iterm2/            # Fournisseur iTerm2 (AppleScript)
      terminalApp/       # Fournisseur Terminal.app (AppleScript)
      macApps.ts         # osascript, état des terminaux (ps), numérotation des fenêtres
  preload/index.ts       # Bridge contextBridge → window.api
  renderer/src/          # Interface React
    features/terminals/  # Bouton Envoyer, menu, appairage
  shared/                # Code partagé main / renderer / extension
    terminalBridge/      # Protocole et cryptographie du pont
    commandSafety.ts     # Validation des commandes, détection des commandes dangereuses
vscode-extension/        # Extension compagnon VS Code (projet indépendant)
tests/                   # Tests node:test
.github/workflows/       # Construction des releases
```

Pour ajouter un terminal (Ghostty, Warp…), implémentez `TerminalProvider`
(`src/main/terminals/types.ts`), puis enregistrez-le dans `createTerminals()`
(`src/main/terminals/index.ts`).

## Publication d'une version

Les versions suivent [SemVer](https://semver.org/lang/fr/) (`MAJEUR.MINEUR.CORRECTIF`) et
le tag Git correspondant est `vX.Y.Z`.

**Première release (0.3.0)** : `package.json` est déjà en `0.3.0`. Une fois les modifications
committées sur `main` :

```bash
git push origin main
git tag v0.3.0
git push origin v0.3.0
```

**Versions suivantes**, sur un arbre de travail propre :

1. **Numéro de version** : `npm version patch` (ou `minor`, `major`) `-m "chore: release v%s"`.
   La commande met à jour `package.json`, crée un commit et le tag `vX.Y.Z`.
2. **Envoi** : `git push origin main --follow-tags`.
3. **Construction automatique** (GitHub Actions, workflow *Release macOS*), sur un runner
   macOS arm64 :
   - installation propre (`npm ci`), vérification des types et tests ;
   - DMG arm64 et VSIX ;
   - vérification des artefacts (architecture, signature, module SQLite, contenu du DMG) ;
   - en parallèle, sur un runner Windows : installateur NSIS et version portable x64, puis
     **tests de fumée** de l'application réellement construite (application décompressée,
     installation silencieuse, version portable) : démarrage, SQLite, persistance,
     projets et commandes, bouton Copier, barre de titre Windows, intégrations macOS absentes ;
   - création d'une **release en brouillon** contenant :
     - `OtterDesk-<version>-arm64.dmg` (archive versionnée),
     - `OtterDesk-mac-arm64.dmg` (nom stable, utilisé par le lien du README),
     - `OtterDesk-<version>-Setup-x64.exe` et `OtterDesk-Windows-Setup-x64.exe` (nom stable),
     - `OtterDesk-<version>-Portable-x64.exe` et `OtterDesk-Windows-Portable-x64.exe` (nom stable),
     - `otterdesk-terminal-bridge.vsix`,
     - `SHA256SUMS.txt` (toutes plateformes).

   Si le build macOS **ou** Windows échoue, aucune release n'est créée. Si une release existe
   déjà pour le tag, le workflow s'arrête.
4. **Relecture puis publication** : sur GitHub › Releases, relisez le brouillon (les notes
   sont générées automatiquement), puis cliquez sur **Publish release**.
5. **Vérification** : les liens « Télécharger » du README et le badge pointent désormais
   vers cette version, sans aucune modification du README.

Le workflow peut aussi être relancé manuellement pour un tag existant : onglet *Actions* ›
*Release* › *Run workflow* (`scope` = `complete`).

**Compléter une release existante avec Windows** (`scope` = `windows-only`) : le workflow
construit et teste uniquement Windows à partir du tag indiqué, vérifie les sommes des fichiers
déjà publiés, puis prépare les exécutables et un nouveau `SHA256SUMS.txt` (lignes existantes
inchangées + exécutables Windows) dans l'artefact `release-complement-windows`. Les fichiers
macOS ne sont jamais modifiés, et le workflow refuse d'agir si la release contient déjà des
`.exe`. Cochez **attach** pour ajouter directement ces fichiers à la release ; sinon,
relisez l'artefact puis ajoutez-les vous-même (GitHub › Releases › *Edit*, ou
`gh release upload vX.Y.Z OtterDesk-*.exe` puis
`gh release upload vX.Y.Z SHA256SUMS.txt --clobber`).

**Validation après publication** (les liens ne fonctionnent qu'une fois la release publiée,
pas en brouillon) :

```bash
curl -sIL https://github.com/loutreceleste/otter_desk/releases/latest/download/OtterDesk-mac-arm64.dmg | grep -E "^HTTP"
curl -sIL https://github.com/loutreceleste/otter_desk/releases/latest/download/otterdesk-terminal-bridge.vsix | grep -E "^HTTP"
curl -sIL https://github.com/loutreceleste/otter_desk/releases/latest/download/OtterDesk-Windows-Setup-x64.exe | grep -E "^HTTP"
curl -sIL https://github.com/loutreceleste/otter_desk/releases/latest/download/OtterDesk-Windows-Portable-x64.exe | grep -E "^HTTP"
# dans un dossier contenant les fichiers téléchargés depuis la release :
shasum -a 256 -c SHA256SUMS.txt
```

La dernière ligne `HTTP` de chaque `curl` doit indiquer `200`.

**Alternative manuelle** (GitHub CLI) :

```bash
npm run dist:mac && npm run dist:win && (cd vscode-extension && npm ci && npm run package) && npm run release:assets
gh release create vX.Y.Z release/github/* --draft --generate-notes --title "OtterDesk X.Y.Z"
```

## Données

Base SQLite `otterdesk.db` dans le dossier de données de l'application :

| OS | Emplacement |
|----|-------------|
| macOS | `~/Library/Application Support/otter-desk/` |
| Windows | `%APPDATA%\otter-desk\` |

Le mode développement et l'application installée utilisent la même base.

### Export / import et migration Windows → macOS

1. Sur Windows, dans OtterDesk : **Exporter**, puis enregistrez le fichier JSON.
2. Transférez le fichier sur le Mac.
3. Sur le Mac, dans OtterDesk : **Importer**, puis choisissez le fichier.

L'import :

- valide entièrement le fichier avant toute écriture ;
- crée une **sauvegarde automatique** de la base dans `backups/` ;
- est transactionnel : en cas d'erreur, rien n'est modifié ;
- **ajoute** les projets importés aux projets existants. Supprimez les projets de
  démonstration avant l'import, et n'importez pas deux fois le même fichier.

## Licence

[MIT](LICENSE) © 2026 Edward Peytavin. Les polices Funnel Display et IBM Plex Mono sont
distribuées sous licence SIL Open Font License 1.1 (voir `src/renderer/src/fonts/`).

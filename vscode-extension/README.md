# OtterDesk — Terminal Bridge (extension VS Code)

Extension compagnon d'[OtterDesk](https://github.com/loutreceleste/otter_desk) pour macOS.
Elle permet à OtterDesk d'envoyer une commande **vers un terminal intégré précis** d'une
fenêtre VS Code : bon projet, bon terminal, sans copier-coller.

## Fonctionnement

- Installée une fois, l'extension s'active automatiquement dans **chaque fenêtre** VS Code
  (`onStartupFinished`).
- Chaque fenêtre s'enregistre auprès d'OtterDesk avec son workspace et la liste de ses
  terminaux (nom, position, dossier courant, état).
- OtterDesk affiche ces terminaux dans « Envoyer vers… » ; la commande est envoyée au
  terminal choisi via `Terminal.sendText()` :
  - **Insérer** : la commande est saisie sans Entrée (le terminal reçoit le focus dans VS Code) ;
  - **Exécuter** : la commande est saisie puis validée.
- **Affichage après l'envoi** (préférence d'OtterDesk, activée par défaut) : l'extension
  sélectionne le terminal exact, affiche le panneau Terminal et met **sa** fenêtre — celle du
  projet — au premier plan (`workbench.action.focusWindow`). Elle ne confirme l'affichage
  qu'après avoir constaté que la fenêtre a reçu le focus. Nécessite l'extension ≥ 0.2.0
  (protocole v2) ; une extension 0.1.x continue de recevoir les commandes, sans affichage.
- L'état du terminal provient de **Shell Integration** : *prêt*, *occupé* (ex. `claude`,
  `npm run dev` en cours) ou *inconnu* (pas de Shell Integration). L'exécution automatique
  est refusée dans un terminal occupé.

## Sécurité

- Communication **locale uniquement**, par un socket Unix (fichier en droits `0600` dans le
  dossier de données d'OtterDesk) : aucun port réseau ouvert.
- **Appairage explicite** : un code à 8 caractères, valable 2 minutes (3 essais), est affiché
  par OtterDesk et saisi dans VS Code. Ni le code ni le secret ne circulent en clair.
- **Authentification mutuelle** à chaque connexion (HMAC-SHA256) : l'extension n'accepte
  aucune demande d'un programme qui ne prouve pas être l'OtterDesk appairé.
- Le secret est stocké dans le **SecretStorage** de VS Code (Trousseau macOS) et partagé par
  toutes les fenêtres ; côté OtterDesk, il est chiffré via le Trousseau.
- Chaque demande est revalidée par l'extension : commande sur une seule ligne, sans
  caractères de contrôle, terminal existant, pas d'exécution dans un terminal occupé.

## Commandes

| Commande | Rôle |
|----------|------|
| **OtterDesk : Connecter à OtterDesk** | Saisir le code d'appairage affiché par OtterDesk |
| **OtterDesk : Oublier l'appairage OtterDesk** | Supprime le secret (toutes les fenêtres) |
| **OtterDesk : Afficher l'état de la connexion** | État, reconnexion, journal |

L'élément « OtterDesk » de la barre d'état indique l'état de la connexion.

## Réglages

- `otterdesk.dataDirectory` : dossier de données d'OtterDesk (par défaut
  `~/Library/Application Support/otter-desk`).

## Limites connues

- VS Code ne permet pas de lire la saisie en cours d'un terminal : si du texte est déjà
  tapé sur la ligne de commande, la commande insérée s'y ajoute.
- Sans Shell Integration (ou dans un terminal qui exécute directement un CLI interactif),
  l'état est *inconnu* : OtterDesk demande une confirmation avant toute exécution.
- Les identifiants de terminaux sont propres à une session VS Code : après un redémarrage
  de VS Code, il faut choisir à nouveau le terminal dans OtterDesk.

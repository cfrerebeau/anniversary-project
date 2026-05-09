# Quizz

Quiz multi-joueurs façon Kahoot, **100 % local** : un serveur ASP.NET Core sur ta machine, les joueurs se connectent depuis leur téléphone via le WiFi local. Aucune connexion internet requise une fois le projet build.

## Fonctionnalités

- **Pas d'authentification** : les joueurs entrent juste un pseudo, un cookie `playerId` les identifie entre les refresh.
- **Temps réel via SignalR** : leaderboard, compteur de réponses et timer synchronisés sur tous les écrans.
- **3 vues séparées** : page joueur (téléphone), page host (contrôle du jeu), page affichage (grand écran / vidéoproj).
- **Scoring style Kahoot** : plus tu réponds vite, plus tu gagnes.
- **Questions en JSON** éditables à la main, 2 à 4 options par question, time limit global ou par question.

## Prérequis

Deux options selon que tu compiles toi-même ou que tu télécharges un binaire prêt à l'emploi :

- **Depuis les sources** : .NET SDK 10.0+ et une connexion internet pour le premier build (téléchargement de `signalr.min.js`).
- **Binaire pré-compilé** : aucun runtime nécessaire. Télécharge la release pour ta plateforme dans [GitHub Releases](../../releases) — l'archive contient l'exécutable, `wwwroot/` et `questions.json`.

## Lancer un binaire de release

```bash
# Linux / macOS
tar xzf Quizz-vX.Y.Z-linux-x64.tar.gz
./Quizz --urls=http://0.0.0.0:5000

# Windows (PowerShell)
Expand-Archive Quizz-vX.Y.Z-win-x64.zip
.\Quizz\Quizz.exe --urls=http://0.0.0.0:5000
```

> ⚠️ **`--urls=http://0.0.0.0:5000` est nécessaire** pour exposer le serveur sur toutes les interfaces réseau (sinon ASP.NET ne bind que sur `localhost` et les téléphones ne peuvent pas se connecter). Tu peux changer le port en remplaçant `5000` par autre chose dans la commande.

## Structure

```
Quizz/
├── Quizz.slnx
├── src/Quizz/                 # serveur ASP.NET Core
│   ├── Quizz.csproj
│   ├── Program.cs            # bootstrap, /api/join, /api/title, hub /hub
│   ├── GameService.cs        # état du jeu (singleton) + scoring
│   ├── QuizHub.cs            # hub SignalR
│   ├── questions.json        # tes questions
│   └── wwwroot/              # pages statiques (index/play/host/display)
└── test/Quizz.Tests/          # 22 tests xUnit sur GameService
```

## Lancer le serveur depuis les sources

```bash
dotnet run --project src/Quizz -- --urls=http://0.0.0.0:5000
```

> Le `--` sépare les arguments `dotnet run` des arguments passés à l'application elle-même.

Au démarrage, le serveur affiche les URLs accessibles depuis le LAN :

```
=== Quizz Quiz ===
Joueurs   :
  http://192.168.1.42:5000
Host      :
  http://192.168.1.42:5000/host.html
Affichage :
  http://192.168.1.42:5000/display.html
```

| Rôle | URL | Qui l'utilise |
|---|---|---|
| Joueurs | `http://<ip>:5000` | les téléphones |
| Host | `http://<ip>:5000/host.html` | celui qui pilote le quiz |
| Affichage | `http://<ip>:5000/display.html` | grand écran / vidéoproj |

> Pense à autoriser le port **5000 entrant** dans ton pare-feu local pour que les téléphones puissent se connecter.

## Déroulement d'une partie

1. **Lobby** — les joueurs rejoignent depuis `/`, le grand écran liste les pseudos en temps réel.
2. **Host clique « Démarrer »** — la première question est diffusée à tous les écrans simultanément.
3. **Joueurs répondent** sur leur téléphone (boutons colorés, verrouillés après le clic).
4. **Host clique « Révéler la réponse »** — bonne réponse mise en évidence sur le grand écran avec les comptages, chaque joueur voit son résultat (✓/✗ et points gagnés).
5. **Host clique « Afficher le classement »** — top 5 affiché sur tous les écrans.
6. **Host clique « Question suivante »** — on recommence. Après la dernière question, classement final.
7. **« Réinitialiser »** remet les scores à zéro en gardant les pseudos.

## Format de `questions.json`

```json
{
  "title": "Quiz Quizz",
  "defaultTimeLimit": 20,
  "questions": [
    {
      "text": "Quelle est la capitale de la France ?",
      "options": ["Paris", "Lyon", "Marseille", "Bordeaux"],
      "correctIndex": 0
    },
    {
      "text": "Le soleil est-il une étoile ?",
      "options": ["Oui", "Non"],
      "correctIndex": 0,
      "timeLimit": 10
    }
  ]
}
```

- `options` : 2 à 4 réponses
- `correctIndex` : index 0-based de la bonne réponse
- `timeLimit` (optionnel) : durée en secondes pour cette question, sinon `defaultTimeLimit`

Le fichier est chargé une seule fois au démarrage du serveur.

## Scoring

```
gain = 1000 × (1 − 0.5 × (temps_réponse / time_limit))
```

| Cas | Points |
|---|---|
| Bonne réponse instantanée | ~1000 |
| Bonne réponse à la dernière seconde | ~500 |
| Mauvaise réponse | 0 |
| Pas de réponse | 0 |

## Stack

- **Backend** : ASP.NET Core 10 + SignalR (équivalent natif de Socket.IO en .NET)
- **Frontend** : HTML/CSS/JS vanilla, client SignalR JS téléchargé localement par MSBuild
- **État** : en mémoire dans un singleton (les scores sont perdus si on redémarre)
- **Tests** : xUnit

## Développement

```bash
dotnet build              # build solution complète
dotnet test               # lance les 22 tests
dotnet run --project src/Quizz -- --urls=http://0.0.0.0:5000
```

## Releases

À chaque tag `v*` poussé sur le repo, GitHub Actions ([.github/workflows/release.yml](../.github/workflows/release.yml)) compile des binaires self-contained pour Linux x64, Windows x64, macOS x64 et macOS arm64, puis les attache automatiquement à une GitHub Release.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Les artefacts sont des archives contenant l'exécutable + `wwwroot/` + `questions.json`. Aucun runtime .NET n'est requis sur la machine cible.

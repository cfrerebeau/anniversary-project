# Quizz

Quiz multi-joueurs façon Kahoot, **100 % local** : un serveur ASP.NET Core sur ta machine, les joueurs se connectent depuis leur téléphone via le WiFi local. Aucune connexion internet requise une fois le projet build.

## Fonctionnalités

- **Pas d'authentification** : les joueurs entrent juste un pseudo, un cookie `playerId` les identifie entre les refresh.
- **Temps réel via SignalR** : leaderboard, compteur de réponses et timer synchronisés sur tous les écrans.
- **3 vues séparées** : page joueur (téléphone), page host (contrôle du jeu), page affichage (grand écran / vidéoproj).
- **Scoring style Kahoot** : plus tu réponds vite, plus tu gagnes.
- **Questions en JSON** éditables à la main, 2 à 4 options par question, time limit global ou par question.

## Prérequis

- .NET SDK 10.0 ou plus
- Connexion internet uniquement au **premier build** (téléchargement de `signalr.min.js`). Ensuite tout marche offline.

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

## Lancer le serveur

```bash
dotnet run --project src/Quizz
```

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
dotnet run --project src/Quizz
```

# IZOUKINI WORKOUT

Application web progressive en français pour suivre une séance d'entraînement
d'environ une heure. La page affiche immédiatement le programme, sans compte ni
écran intermédiaire.

## Programme

- Extension jambe: 3 séries de 8 à 12 répétitions
- Tirage vertical (Lat Pulldown): 3 séries de 8 à 12 répétitions
- Curl marteau haltère: 3 séries de 8 à 12 répétitions
- Extension triceps couché: 3 séries de 8 à 12 répétitions
- Chest Fly machine (pectoraux): 3 séries de 8 à 12 répétitions
- Planche: 1 min 30, 1 min et 45 secondes
- Push-ups: une série au maximum

L'application ne demande et n'enregistre aucun poids. Cocher les deux premières
séries d'un exercice lance automatiquement 30 secondes de repos. Une fois les
séries terminées, cocher l'exercice lance 2 minutes de repos avant le suivant.

## Ouvrir localement

Depuis la racine du dépôt:

```bash
python3 -m http.server 4173 --directory workout-app
```

Ouvrir ensuite `http://127.0.0.1:4173/`. La progression est conservée uniquement
dans le navigateur avec `localStorage`.

## Ajouter sur l'écran d'accueil d'un iPhone

Le site doit être publié sur une adresse HTTPS pour garantir le mode hors ligne
et l'affichage autonome. Sur l'iPhone:

1. Ouvrir l'adresse publiée dans Safari.
2. Appuyer sur Partager.
3. Choisir Sur l'écran d'accueil.
4. Appuyer sur Ajouter.

Le manifeste, les icônes, les métadonnées Apple et le service worker sont déjà
inclus. Le déploiement public reste une étape séparée.

## Vérifier

```bash
python3 workout-app/tests/check_app.py
```

Le script valide le programme, les temps de repos, l'absence de champ de poids,
les métadonnées iPhone, le manifeste, les icônes et les ressources hors ligne.

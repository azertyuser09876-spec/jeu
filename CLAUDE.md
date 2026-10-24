# Le Vide — notes pour Claude

Jeu solo en français, HTML/CSS/JS pur, qui doit toujours se lancer en ouvrant `index.html` (file://).
Vision et versions prévues : `ROADMAP.md`. Historique : `CHANGELOG.md`.

## Méthode (c'est elle qui fait réussir le projet)

1. Avant une version : écrire la liste de ses points (dans ROADMAP.md si elle évolue).
2. Un point à la fois : code → tests → `node tests/run.js` + `node tests/smoke.js` → un commit par point.
3. Release : version dans `src/core/vide.js`, entrée dans `CHANGELOG.md`, case cochée dans `ROADMAP.md`, push.
4. Ne jamais passer à la version suivante si la précédente a un test rouge ou un défaut connu.
5. Le joueur donne la direction, pas le détail : prendre les décisions de design et les expliquer brièvement.

## Architecture

- **Pas de modules ES** (incompatibles avec file://). Chaque fichier est une IIFE qui enrichit `globalThis.Vide`.
- `src/core/` : logique pure, **aucun accès au DOM, à `window`, `localStorage` ni `performance`**.
  Tout y est testable dans node. `src/app/` : canvas, contrôles, interface, stockage.
- L'ordre des scripts compte. Un nouveau fichier `src/core/x.js` s'ajoute dans **`index.html` et `tests/tests.html`**
  (`tests/run.js` lit la liste dans `tests/tests.html`). Un nouveau fichier de test s'ajoute dans `tests/tests.html`.
- **État persistant** (`State.create`) = uniquement ce qui se sauvegarde. Le reste (particules, vitesse, onde…)
  vit dans l'objet `game` de `sim.js` et se recalcule.
- Simulation à **pas fixe** (`CONFIG.step`) ; `Sim.step(game, dt, input)` est déterministe pour une graine donnée.
- Les caractéristiques (`Stats.compute`) se recalculent à chaque pas à partir de l'état : pas de cache à invalider.
- **Contenu = données**, chaque catalogue dans son fichier : améliorations (`upgrades.js`), espèces (`species.js`),
  bâtiments (`buildings.js`), ombres (`SHADOW_KINDS` dans `shadows.js`), zones (`zones.js`), colosses
  (`colossi.js`, corps et attaques dans `colossus.js`), récit (`lore.js`). Les `id` sont stockés dans les
  sauvegardes : ne jamais les renommer.
- **Boutique** : tout ce qui s'achète s'inscrit au catalogue (`catalog.js`) avec un onglet ; l'interface
  l'affiche sans rien savoir de l'article. Coûts multi-ressources (`wallet.js` : lumière ✦, échos ◆, souvenirs ✧).
- **Événements** : la simulation signale ce qui arrive avec `Sim.emit(game, type, données)` ; l'interface
  (`away.js`), le son (`audio.js`) et le rendu les lisent chaque image. Ajouter un message = une entrée dans
  `MESSAGES` (away.js).
- **Modules du cœur** : `sim.js` orchestre ; `field.js` (particules), `territory.js`, `garden.js`, `colony.js`
  (êtres et comportements par rôle), `structures.js` (bâtiments), `shadows.js`, `combat.js` (vitalité, armée,
  projectiles, tours), `zones.js`, `colossus.js`, `offline.js` (absence), `renaissance.js`, `save.js`.
- **Améliorations héritées** (`legacy: true`, payées en souvenirs) : rangées dans `state.legacy`, elles survivent
  aux renaissances ; `modify(stats, niveau)` permet de cumuler avec une autre amélioration.

## Sauvegardes

- Toute modification de la forme de l'état persistant : incrémenter `FORMAT` dans `src/core/save.js`
  **et** ajouter la migration `MIGRATIONS[ancien]`, **et** l'adapter dans `sanitize`, **et** ajouter un test.
- `sanitize` doit accepter n'importe quelle donnée sans planter.

## Équilibrage

- Après tout réglage, lancer `node tests/balance.js 60` : le robot joue une heure sans défendre activement.
  Vérifier que la progression ne cale pas et ne s'emballe pas.
- Améliorations sans maximum : pour une même source de revenu, Σ ln(multiplicateur par niveau) / ln(croissance
  du prix) doit rester < 0,75 (garde-fou dans tests/economy.test.js — y rattacher toute nouvelle amélioration
  illimitée). Une marge est nécessaire : d'autres facteurs (nombre d'êtres, jardin…) grandissent en même temps.
- Éviter les impasses : toujours vérifier qu'un joueur ne peut pas se bloquer (ex. population pleine sans bâtisseur
  possible — d'où les bâtisseurs hors population).

## Style

- Textes du jeu, commentaires et messages de commit en français.
- Ambiance « vide » : sobre, sombre, peu d'éléments ; l'interface n'apparaît que lorsqu'elle devient utile.
- Mobile et ordinateur doivent fonctionner (tactile + souris + clavier par `e.code`).
- Vérifier le rendu par capture d'écran (Playwright) après tout changement visuel.

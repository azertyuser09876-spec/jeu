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
  bâtiments (`buildings.js`), types de villages (`VILLAGE_TYPES` dans `villages.js`), ombres (`SHADOW_KINDS` dans `shadows.js`), zones (`zones.js`), colosses
  (`colossi.js`, corps et attaques dans `colossus.js`), récit (`lore.js`). Les `id` sont stockés dans les
  sauvegardes : ne jamais les renommer.
- **Boutique** : tout ce qui s'achète s'inscrit au catalogue (`catalog.js`) avec un onglet ; l'interface
  l'affiche sans rien savoir de l'article. Coûts multi-ressources (`wallet.js` : lumière ✦, échos ◆, souvenirs ✧).
- **Événements** : la simulation signale ce qui arrive avec `Sim.emit(game, type, données)` ; l'interface
  (`away.js`), le son (`audio.js`) et le rendu les lisent chaque image. Ajouter un message = une entrée dans
  `MESSAGES` (away.js).
- **Villages** (`state.villages`) : il n'y a plus de foyer central. Chaque village a son cœur, sa surface (économie),
  sa forme (`cells`, grille de 40, voir `territory.js`), ses êtres, ses bâtiments, son rendement. Les bâtiments et le
  type n'agissent que sur leur village : `Villages.local(state, village)` (ou `Villages.statsOf(game, village)` en jeu).
  La boutique des êtres et des plans vise le village où l'on se trouve (`Villages.current`). Tests : `VideTest.village`.
- **Plan des villages** (`plan.js`) : plan radial fixe (boulevards tous les `Plan.STREET`, `Plan.AVENUES` avenues
  orientées par `Plan.turn(v)`, îlots d'emplacements). `Structures.site` passe par `Plan.choose` (place selon
  `def.ring`, la défense près des avenues). Un bâtiment posé ne bouge plus.
- **Enceintes** (`walls.js`, village.walls = [{ n, work, broken }]) : murailles sur les boulevards, portes au bout des
  avenues (ouvertes à la lumière seulement). Tout ce qui bouge passe par `Walls.hold` (après son pas) et, pour aller
  quelque part, par `Walls.route` (la porte la mieux placée) ; `game.walled` liste les villages à enceinte achevée.
  Les colosses ne sont jamais arrêtés. Solidité des pans : `game.wallHp`.
- **Intendant** (`steward.js`) : part de la lumière d'un village mise en réserve et dépensée seule (jamais d'échos).
- **Bâtiments** : `family` (ordre en boutique), `only` (type de village), `scope: 'global'` (effet sur tous les
  villages, via `Structures.modifyGlobal`), `ward` (ralentit les ombres).
- **Routes, échanges, cités** : `roads.js` (state.roads ; tracé `Roads.route(state, a, b)` par les portes, courbe,
  troncs communs : `Roads.network`/`Roads.trunks` ; le travail se compte sur la distance entre cœurs), `trade.js` (village.stock, caravanes : la charge ne
  quitte l'expéditeur qu'à l'arrivée), `cities.js` (fusion au contact, village.extra et village.districts ; une
  cité doit toujours valoir au moins ses villages).
- **Expéditions** (`expeditions.js`, state.expeditions) : lancées depuis la carte, elles marchent et peuvent être
  attaquées ; les colons en route comptent dans le prix des fondations. **Capacités** (`abilities.js`) : ruée,
  fanal (state.beacon, récolte abstraite selon la zone), retour.
- **Nids d'ombre** (`nests.js`, state.nests, state.cleared) : apparition, obscurité, raids ; ordre « siege » de
  l'armée (`Combat.anchor`), cœur ciblé via `Nests.target`, `Nests.hit`.
- **Colosses** (`colossus.js`) : `state.studied` (sceaux dévoilés par les érudits ; un sceau voilé ne se brise
  pas), phases (`fury`, `PHASE`), marche sur un village (mode 'march', pendant le jeu seulement : `game.marchClock`),
  `Colossus.engaged` pour tout ce qui peut s'en prendre à lui. Engins de siège : `engines.js` (state.engines, bâtis
  par l'expédition 'sappers'). Rôles des colosses apaisés : `allies.js`.
  Corps singuliers (vol, cloche, nuée, dormeur) : `beasts.js`, branchés par `Vide.Beasts[kind]` (crochets décrits
  en tête de colossus.js) ; une attaque peut porter ses crochets (`start`, `strike`, `step`) ; dessin :
  `draw-beasts.js` (`Vide.Draw.beasts`, `Vide.Draw.beastAttacks`).
- **Tableaux** (cinématiques, côté app) : `cinema.js` (lecteur, déclenché par les événements, met le jeu en
  pause), `scenes.js` (tableaux : plans { d, draw(g) }, peintre de colosses en constellations). Vus :
  `state.cinematics`. Un tableau par colosse se fabrique à la demande ('rencontre:' + id).
- **Performances** : `grid.js` (grille spatiale) pour tout voisinage d'êtres ; ne pas réintroduire de boucle sur
  tous les êtres à chaque pas et pour chaque être (banc d'essai : 400 êtres sous 12 ms par pas, test colony).
- **Modules du cœur** : `sim.js` orchestre ; `field.js` (particules), `territory.js`, `villages.js`, `garden.js`, `colony.js`
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
- Après tout réglage d'un colosse (ou de l'armée, de la pulsation), lancer `node tests/duel.js` : un robot
  affronte chaque colosse avec l'équipement attendu à son éveil (`KIT`). Aucun ne doit rester « NON » ; viser
  quelques minutes de combat chacun.
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

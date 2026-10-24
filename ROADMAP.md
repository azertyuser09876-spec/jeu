# Feuille de route

## Vision

Une lumière seule dans un vide infini, qui grandit.

- **Territoire de lumière** qui s'étend physiquement, lentement, même en ton absence : tu reviens, il est plus grand.
- **Êtres de lumière autonomes** qui récoltent, construisent des bâtiments et interagissent entre eux.
- **Colosses** : créatures immenses et majestueuses (esprit *Shadow of the Colossus*), qu'il faut traquer,
  comprendre et vraiment mériter.
- **Vide infini, avec des zones** qui changent les règles (lumière, dangers, ambiance).
- **Progression** : de « je fais tout seul » à « mon peuple vit sans moi ».

## Méthode

Pour chaque version : une liste de points → un point à la fois → tests → release (version, CHANGELOG).
On ne passe jamais à la version suivante tant que la précédente n'est pas solide.

## Versions

### [x] 0.1 — Noyau
Déplacement, récolte, améliorations, pulsation, sauvegarde versionnée, ambiance.

### [x] 0.2 — Territoire
1. Interface en onglets, catalogue générique d'achats (prépare les êtres, bâtiments, armée).
2. Le foyer : on retourne à l'origine pour l'allumer ; le territoire naît et s'étend lentement.
3. Rayonnement : le territoire produit de la lumière selon sa surface ; dans le territoire, la pulsation
   se recharge plus vite. Améliorations Expansion, Fertilité, Mémoire.
4. Absence : au retour (page fermée ou onglet caché), le territoire a grandi et a produit — écran
   « pendant ton absence… » (durée plafonnée par Mémoire).
5. Sauvegarde format 2 + migration.

### [x] 0.3 — Premières lueurs
1. Le jardin : le territoire fait naître sa propre lumière.
2. Les lueurs : êtres autonomes qui cherchent la lumière du jardin, la portent et la déposent au foyer.
3. Améliorations des êtres (Agilité, Charge, Ferveur), plafond de population.
4. Absence : les lueurs continuent de travailler (rendement mesuré).
5. Sauvegarde format 3.

### [x] 0.4 — Vie autonome
1. Les bâtisseurs, deuxième espèce d'êtres.
2. Bâtiments planifiés par le joueur, placés et construits seuls par la colonie (Nid, Phare, Prisme).
3. Interactions : les lueurs ravitaillent les chantiers, les êtres se rencontrent et dansent.
4. Sauvegarde format 4.

### [x] 0.5 — Les ombres
1. Vitalité de la lumière, ombres qui rôdent (Errante, Rôdeuse, Massive), marées qui visent le territoire.
2. La pulsation blesse les ombres ; les ombres vaincues laissent des échos (◆), seconde ressource.
3. L'armée : Gardien (mêlée), Étincelle (distance), Veilleuse (soin) — combat automatique en temps réel.
4. Ordres de groupe : garder le foyer, escorter la lumière, chasser.
5. Tour de lumière, réparation des bâtiments, améliorations de combat.
6. Sauvegarde format 5.

### [x] 0.6 — Les zones
1. Le vide se découpe en zones (Calme, Brume, Courants, Murmure, Éclat, Gouffre) selon la distance.
2. Chaque zone change les règles : densité, lumière rare, courants, brouillard, ombres errantes.
3. Annonce de zone, teintes, carte des régions explorées.
4. Sauvegarde format 6.

### [x] 0.7 — Le premier colosse
1. Le Veilleur : créature immense à quatre pattes, marche procédurale, repaire lointain, battement à suivre.
2. Combat : attaques annoncées (piétinement, souffle), sceaux à briser à la pulsation,
   l'armée le fait plier (genou à terre).
3. Apaisé, il rejoint le territoire et le protège.
4. Sauvegarde format 7.

### [x] 0.8 — Échos du vide
1. Son génératif (WebAudio) : récolte, pulsation, êtres, ombres, nappe d'ambiance par zone ; réglage dans le menu.
2. Récit discret : fragments qui se révèlent selon la progression, journal dans le menu.
3. Sauvegarde format 8.

### [x] 0.9 — D'autres colosses
1. La Tisseuse (huit pattes, toiles qui ralentissent) et le Léviathan (serpent du Gouffre).
2. Colosses décrits par des données : corps, attaques, sceaux, bienfaits.

### [x] 1.0 — Renaissance
1. Renaissance : se dissoudre pour renaître plus fort (souvenirs ✧, bienfaits permanents).
2. Équilibrage complet au robot, finitions, documentation.

## Vers 2.0 — les villages (retours de jeu sur la 1.0)

Ce qui change de fond : **il n'y a plus de base centrale**. L'origine n'est plus qu'un lieu de naissance.
Le joueur fonde des **villages** où il veut, d'un **type qu'il choisit** ; chacun a son territoire de lumière
qui pousse selon ses habitants (pas un disque), son cœur qui blanchit lentement. Les villages se relient,
échangent (soldats contre ressources…), grandissent jusqu'à devenir des **cités** (village énorme ou villages
qui fusionnent, plusieurs spécialisations). Plus tard, ou trop loin, **les ombres bâtissent aussi**.
Perdue, la lumière se disperse (animation) et renaît dans un village, ou à l'origine.

### [x] 1.1 — Retouches et caméra
1. Carte peinte : zones en dégradés fondus, brouillard sur l'inexploré, plus de texte sur les zones.
2. Pattes des colosses : genoux toujours pliés du même côté, pas limités, rotation sur place (plus de
   pattes qui virevoltent).
3. Caméra : zoom (molette, pincement, + / −) et recul automatique quand un colosse est proche.
4. Écran titre animé au lancement.
5. Options : réduire les secousses, exporter / importer sa sauvegarde.

### [x] 1.2 — Villages
1. Plus de foyer central : l'origine n'est qu'un lieu de naissance. On fonde un village là où l'on se trouve,
   en choisissant son type (Jardins, Bastion, Atelier, Observatoire, Sanctuaire), chacun avec ses effets.
   Êtres, bâtiments, jardin propres à chaque village ; boutique contextuelle (village où l'on se trouve).
   Migration : l'ancien territoire devient le premier village. Sauvegarde format 10.
   (Un seul point : le modèle de données change d'un bloc, avec sa migration.)
2. Territoire de lumière vivant (grille) : il pousse là où vivent et travaillent les habitants, autour des
   bâtiments ; les zones pleines blanchissent, et ce blanc se répand plus lentement encore.
3. Architecture propre à chaque type de village (cœur, bâtiments, teinte du territoire).
4. Dispersion : animation, puis renaissance dans le village le plus proche (ou à l'origine).

### [x] 1.3 — Autonomie et bâtiments
1. Population sans plafond fixe (logements) ; intendant de village qui construit seul avec la part de
   lumière que tu lui confies.
2. Nouveaux bâtiments par familles (économie, vie, savoir, défense) et bâtiments propres à chaque type.
3. Performances : grille spatiale pour des centaines d'êtres.

### [x] 1.4 — Routes, échanges, cités
1. Relier des villages par des routes de lumière ; caravanes visibles.
2. Ressources de village (matière ◇, savoir ✎, soldats) et échanges automatiques entre villages reliés.
3. Cités : villages dont les territoires se touchent, ou village devenu énorme — plusieurs spécialisations.

### [x] 1.5 — Expéditions et capacités
1. Expéditions choisies sur la carte : colons (fondent au loin), éclaireurs (révèlent), escortes.
2. Capacités de la lumière : élan (ruée), fanal (lumière posée), retour (vers un village).

### [ ] 1.6 — Les ombres bâtissent
1. Villages d'ombre (territoire d'obscurité, flèches noires) après tes premiers villages ou trop loin ;
   ils lancent les raids.
2. Les assiéger avec l'armée, les détruire, reprendre le terrain.

### [ ] 1.7 — Colosses redoutables
1. Colosses bien plus grands (caméra qui recule), sceaux voilés tant qu'ils ne sont pas étudiés (érudits),
   phases à chaque sceau brisé, attaques plus dures.
2. La relève : balistes et chaînes construites sur place par des sapeurs, troupes de siège.
3. Colosses qui marchent sur un village (seulement pendant le jeu) ; colosses apaisés avec un vrai rôle.

### [ ] 1.8 — Nouveaux colosses
L'Oiseau d'aube (vole, à clouer au sol), la Méduse (sceaux au rythme de ses pulsations), la Nuée
(milliers de fragments), le Colosse endormi (on peut bâtir sur son dos).

### [ ] 1.9 — Cinématiques
Tableaux peints en code qui racontent sans texte : ouverture, première rencontre, apaisement, renaissance.

### [ ] 2.0 — Équilibrage et finitions

## Après 1.0 — pistes

- D'autres colosses (le corps et les attaques sont des données : un oiseau aux ailes immenses, une méduse…).
- Des zones plus rares (une zone inversée où la lumière blesse, un sanctuaire sans ombre…).
- Une deuxième génération d'êtres (spécialisations, êtres qui en éveillent d'autres).
- Des défis de renaissance (renaître avec des contraintes pour des souvenirs supplémentaires).
- Exporter / importer sa sauvegarde (changer d'appareil).

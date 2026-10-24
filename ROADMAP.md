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

### [ ] 1.0 — Renaissance
1. Renaissance : se dissoudre pour renaître plus fort (souvenirs ✧, bienfaits permanents).
2. Équilibrage complet au robot, finitions, documentation.

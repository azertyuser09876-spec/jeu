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

### [x] 1.6 — Les ombres bâtissent
1. Villages d'ombre (territoire d'obscurité, flèches noires) après tes premiers villages ou trop loin ;
   ils lancent les raids.
2. Les assiéger avec l'armée, les détruire, reprendre le terrain.

### [x] 1.7 — Colosses redoutables
1. Colosses bien plus grands (caméra qui recule), sceaux voilés tant qu'ils ne sont pas étudiés (érudits),
   phases à chaque sceau brisé, attaques plus dures.
2. La relève : balistes et chaînes construites sur place par des sapeurs, troupes de siège.
3. Colosses qui marchent sur un village (seulement pendant le jeu) ; colosses apaisés avec un vrai rôle.

### [x] 1.8 — Nouveaux colosses
1. L'Oiseau d'aube (après le Veilleur) : il vole, ses sceaux hors d'atteinte ; il pique et souffle des rafales.
   On le cloue au sol (chaînes, balistes, harpons, étincelles), ou on guette ses rares posés. Apaisé, il
   t'accompagne et révèle le lointain.
2. La Méduse (après l'Oiseau et la Tisseuse) : une cloche qui pulse ; ses sceaux ne s'ouvrent qu'au rythme de
   ses pulsations ; fouets de tentacules, ondes. Apaisée, elle soigne le village le plus abîmé.
3. La Nuée (après le Léviathan) : des centaines de fragments qui protègent ses noyaux ; la pulsation les
   disperse, l'armée les dévore. Apaisée, elle récolte la lumière autour de toi.
4. Le Dormeur (quand tous les autres sont apaisés) : immense, il ne combat pas ; on apaise ses rêves debout sur
   son dos, face à ses cauchemars. Éveillé, il te laisse bâtir sur son dos.

### [x] 1.9 — Cinématiques
Tableaux peints en code qui racontent sans texte : ouverture, première rencontre, apaisement, renaissance.
1. Le projecteur : un lecteur de tableaux plein écran (bandes noires, fondus, un toucher pour passer) ; le monde
   attend ; les tableaux vus restent dans la sauvegarde et se revoient depuis le menu ; on peut les couper.
2. L'ouverture : le vide plein, la brisure, les gardiens qui s'endorment, la dernière lueur — puis l'éveil.
3. Rencontres et apaisements : chaque colosse se dresse et ouvre les yeux ; apaisé, l'or gagne son corps et il
   rejoint le ciel des colosses apaisés.
4. Renaissance et épilogue : la lumière se dissout et renaît sous le ciel des colosses ; quand le Dormeur
   s'éveille, les sept constellations se rejoignent.

### [x] 2.0 — Équilibrage et finitions
1. Le duelliste : un robot qui affronte chaque colosse avec ce qu'on possède quand il s'éveille. Il vérifie
   qu'aucun n'est impossible, mesure la durée du combat et les coups encaissés ; réglages en conséquence.
2. La partie longue : robot de deux heures avec renaissances ; corriger ce qui cale ou s'emballe.
3. Finitions : aide et textes à jour, réglage « animations réduites » (tableaux, secousses), performances
   avec tous les colosses et des centaines d'êtres, mobile.
4. Release 2.0 : présentation du jeu (README), captures, journal.

## Après 2.0 — du vide au champ de bataille

Retours sur la 2.0 : le ressenti est bon. Le monde est vide au début ; il doit finir en vrai champ de bataille.
Réponses du joueur : pendant l'absence, **tout est possible** (on peut perdre des villages, des colosses) ;
la guerre arrive **avec les premiers avant-postes ennemis**, d'abord douce, sans forcément d'attaques ;
les murailles **bloquent tout, sauf les colosses** (ta lumière passe par les portes).

### [x] 2.1 — Les fondations
1. Prix fixes : seuls les améliorations (de la lumière, générales) renchérissent ; recruter un être ou bâtir
   coûte toujours le même prix. Ce qui limite désormais : les logements (population), les casernes (armée), la
   place (des emplacements selon la surface du village) et un nombre maximal de chaque bâtiment par village.
2. Le blanc en cinq nuances, jusqu'au blanc pur ; plus une cellule est blanche, plus elle tient (prépare la
   guerre). Affichage du territoire refait.
3. Équilibrage (robots) de cette nouvelle économie.

### [x] 2.2 — Des villages bâtis avec logique
Choix : un plan **radial**, comme les villes fortifiées en étoile. Des boulevards en anneaux, quatre avenues qui
rayonnent du cœur vers quatre portes (alignées d'une enceinte à l'autre), des îlots entre eux.
1. Le plan : chaque bâtiment à sa place selon son rôle (vie et savoir au centre, logis autour, production plus
   loin, défense au bord et près des avenues, donc des portes). Les emplacements sont fixes : un bâtiment posé y
   reste quand le village grandit. Le gouverneur (intendant) suit ce plan ; les villages existants s'y rangent.
2. Les murailles : un achat par village (« enceinte »), au prix de sa longueur, bâti par les bâtisseurs, sur un
   boulevard ; une couche de plus quand le village grandit. Elles bloquent tout — ta lumière, les êtres, les
   ombres — sauf les colosses. Les portes s'ouvrent à la lumière, jamais aux ombres : elles doivent abattre un pan
   (une brèche, que les bâtisseurs relèvent).
3. Circuler : les êtres et ta lumière passent par les portes (les avenues les y mènent) ; de grandes routes
   (autoroutes) partent des portes qui se font face ; les caravanes les suivent.
4. Refonte graphique : bâtiments, rues, enceintes, territoires, carte.

### [x] 2.3 — Les bases des ombres
Choix : les nids deviennent des bases, bâties comme tes villages mais en négatif — un territoire de noirceur
(les mêmes cellules, cinq nuances de noir), un plan radial, des ouvrages d'ombre, des remparts dont les portes ne
s'ouvrent qu'aux ombres.
1. De vraies bases : un territoire de noirceur qui grandit avec l'âge (ni lui ni tes villages n'empiètent l'un sur
   l'autre), en cinq nuances (plus noir, plus dur à reprendre) ; des ouvrages : fosses (raids plus nombreux,
   défenseurs), flèches (elles tirent sur la lumière), remparts d'ombre (ils arrêtent la lumière ; ton armée en
   siège les abat). Elles bâtissent et se fortifient avec le temps.
2. Les avant-postes : une base mûre essaime vers tes villages ; le premier avant-poste ouvre la guerre, douce
   d'abord (tension : des ombres rôdent sans attaquer), puis de plus en plus rude.
3. Prendre une base : abattre son cœur rend son terrain au vide, ou à ton village s'il le touche.

### [ ] 2.4 — Le monde vit
Demandé en cours de route : les créatures intermédiaires sont tuables et convertibles par les deux camps, selon la
sous-faction de qui les affronte ; les sous-factions sont choisies au début par le joueur, et un village fondé
depuis un autre a de grandes chances d'être de la même.
1. [x] De nouvelles unités dans les deux camps. Lumière : le porte-bouclier (il attire les coups et en encaisse la
   moitié), le lancier (longue allonge ; il brise ouvrages et remparts). Ombres : la fouisseuse (elle passe sous
   les murailles), la cracheuse (elle crache de loin), la bélière (elle enfonce les murailles).
2. Les sous-factions : en plus de son type, chaque village a la sienne — les Éleveurs (ils apprivoisent créatures
   et faune), les Illuminés (ils purifient les créatures d'ombre ; leur blanc avance plus vite), les Lames (elles
   tuent : plus fortes contre les créatures, plus d'échos). Les bases aussi — les Dévoreurs (ils tuent et s'en
   nourrissent), les Corrupteurs (ils retournent les créatures de lumière), les Meutes (plus de créatures ; elles
   apprivoisent la faune). Le joueur choisit celle de son premier village ; un village fondé depuis un autre (un
   avant-poste depuis sa base) en hérite le plus souvent.
3. Les créatures intermédiaires, plus grandes et plus travaillées que les êtres, aux corps articulés : loups (en
   meute), scolopendre, cerf (gardien d'un village, il s'achète). Tuables ou convertibles par les deux camps : à
   bout de forces, une créature est apprivoisée, purifiée ou corrompue — selon la sous-faction de qui l'abat — au
   lieu de mourir, et rejoint ce village ou cette base.
4. Des colosses plus grands (×1,4) et bien plus solides (sceaux ×2), réglés avec le duelliste.
5. La vie du monde : de vrais convois sur les routes (plusieurs chariots, attaquables, la charge perdue s'ils
   tombent) ; une faune neutre dans le vide (lucioles qui fuient, raies de lumière qui planent, une baleine du vide
   dans les régions lointaines), qui ne fait pas de mal — les Éleveurs et les Meutes l'apprivoisent.

### [ ] 2.5 — Les gouverneurs
1. Chaque village (et chaque base d'ombre) a un gouverneur et un budget : il bâtit selon le plan, recrute, lance
   des expéditions, fonde (des villages de sa sous-faction, le plus souvent), relie, forme des cités, conquiert.
2. Les deux camps ont le même cerveau ; leur ambition grandit avec le temps.

### [ ] 2.6 — La guerre
1. Les fronts : territoire, bâtiments et troupes se gagnent et se perdent, des deux côtés ; le blanc pur et la
   noirceur profonde tiennent le plus longtemps.
2. Des colosses disputés : les ombres peuvent corrompre un colosse apaisé, et on peut le reprendre.
3. La vue stratégique : en dézoomant, le monde passe en mode abstrait (fronts, armées, ordres).
4. L'absence : la guerre continue (tout peut arriver), et un résumé t'attend au retour.

### [ ] 3.0 — Le champ de bataille
Équilibrage complet (deux robots qui s'affrontent), performances (des milliers d'unités), finitions.

## Pistes

- Des zones plus rares (une zone inversée où la lumière blesse, un sanctuaire sans ombre…).
- Une deuxième génération d'êtres (spécialisations, êtres qui en éveillent d'autres).
- Des défis de renaissance (renaître avec des contraintes pour des souvenirs supplémentaires).
- Un village qui voyage (sur le dos d'un colosse en marche).

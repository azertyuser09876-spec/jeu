# Historique des versions

## 1.6.0 — Les ombres bâtissent

- **Nids d'ombre** : après ton deuxième village, un nid naît à bonne distance de tes villages, puis un autre
  toutes les 15 minutes de jeu. Loin de l'origine, des régions dangereuses en abritent déjà, découverts en
  approchant.
  - Chaque nid grandit avec l'âge : son obscurité s'étend, son cœur se durcit.
  - Il lance des raids, de plus en plus gros, sur le village le plus proche.
  - Son obscurité épuise ta lumière hors de tes territoires, et le vide y fait naître bien moins de particules.
  - Des flèches sombres au bord de l'écran les signalent.
- **Le siège** : nouvel ordre « assiéger » (B). Ton armée va au nid le plus proche, disperse ses défenseurs et
  frappe son cœur ; ta pulsation le blesse aussi. Détruit, il rend beaucoup d'échos, et sa région est libérée
  pour de bon : une clairière où le vide fait naître 30 % de lumière en plus.
- Deux fragments du récit (24 au total).
- Sauvegarde au format 17 (nids, régions libérées).
- 283 tests de logique, 35 vérifications navigateur.

## 1.5.0 — Expéditions et capacités

- **Expéditions, choisies sur la carte** : toucher un point ouvre un petit panneau.
  - **Éclaireurs** : ils révèlent les régions autour du point, puis rentrent.
  - **Colons** : trois lueurs vont fonder au loin un village du type choisi, au prix d'une fondation.
  - **Escorte** (en option) : deux gardiens les accompagnent.

  Elles partent du village le plus proche et marchent vraiment. Les ombres des zones traversées les attaquent :
  attaquée, une expédition s'arrête pour faire face, et l'escorte frappe ; à bout de forces, elle est perdue.
  Elles avancent aussi pendant l'absence.
- **Capacités de la lumière** (onglet lumière, trois niveaux chacune) :
  - **Ruée** (Maj) : un élan bref et fulgurant, invulnérable.
  - **Fanal** (F) : une lumière posée qui récolte seule la lumière alentour, même en ton absence ; repasse
    la reprendre.
  - **Retour** (R) : après une courte concentration, ta lumière se rassemble au village le plus proche.

  De petits boutons apparaissent au-dessus de la pulsation.
- Sauvegarde au format 16 (expéditions, fanal).
- 273 tests de logique, 34 vérifications navigateur.

## 1.4.0 — Routes, échanges, cités

- **Routes de lumière** : depuis un village, en planifier une vers le plus proche qui ne lui est pas encore
  relié. Les bâtisseurs des deux bouts la construisent, chacun depuis son cœur. Sur une route achevée, ta
  lumière file 60 % plus vite.
- **Ressources et échanges** :
  - L'**atelier** produit de la matière ◇ : un village qui en a bâtit 50 % plus vite.
  - L'**observatoire** produit du savoir ✎ : un village qui en a grandit 25 % plus vite.
  - Le **bastion** forme des soldats avec la réserve de son intendant, et les envoie aux villages reliés mal
    défendus, contre de la lumière de leur réserve.
  - Des **caravanes** visibles portent les surplus le long des routes. Sous le compteur : le village où l'on
    est et ses ressources.
- **Cités** : quand deux territoires se touchent, les villages fusionnent. La cité réunit tout (surface,
  forme, êtres, bâtiments, routes), cumule leurs spécialités, et ses anciens cœurs deviennent des quartiers
  reliés par des avenues de lumière. Chaque quartier garde sa croissance, ses places et son jardin. Un village
  immense peut aussi ajouter une spécialité. Une cité a des contours plus nets, un bord dense comme un rempart.
- Sauvegarde au format 14 (routes, ressources, cités).
- 260 tests de logique, 32 vérifications navigateur.

## 1.3.0 — Autonomie et bâtiments

- **L'intendant** : chaque village peut lui confier 10, 25 ou 50 % de la lumière qu'il produit. Il la dépense
  seul, en achetant le moins cher de ses souhaits : lueurs tant qu'il y a de la place, un bâtisseur, des
  **logis** (nids) quand la population est pleine, des relais et des phares quand le territoire s'étend.
  La population n'a plus de plafond fixe : un village confié grandit seul. Il ne recrute pas d'armée (elle
  coûte des échos). Pendant ton absence, il met de côté sa part et la dépense ; l'écran d'absence le raconte.
- **Nouveaux bâtiments**, rangés par familles (économie, vie, savoir, défense) :
  - Fontaine (jardin +25 %), Source (soins +50 %, êtres rallumés plus tôt), Archive (+1 h d'absence pour
    tout ton monde), Rempart (ralentit de moitié les ombres qui le longent).
  - Propres à un type de village : Serre (jardins), Citadelle (bastion), Fonderie (atelier : chantiers plus
    rapides partout), Lunette (observatoire : croissance plus rapide partout), Autel (sanctuaire : blanc ×2).
- **Performances** : grille spatiale ; des centaines d'êtres restent fluides (400 êtres : 2,3 ms par pas,
  51 images/s dans un navigateur sans carte graphique).
- La lumière dorée ne dépasse jamais une particule sur deux.
- Sauvegarde au format 11 (intendants).
- 240 tests de logique, 31 vérifications navigateur.

## 1.2.0 — Villages

Il n'y a plus de base centrale. L'origine n'est plus que le lieu où naît la lumière.

- **Fonder un village** là où l'on se trouve, en choisissant son type :
  - **Jardins** : la lumière y naît plus dense, les lueurs portent davantage.
  - **Bastion** : bâtiments plus solides, territoire qui brûle deux fois plus les ombres, armée plus forte.
  - **Atelier** : chantiers bien plus rapides, un bâtisseur de plus.
  - **Observatoire** : territoire qui grandit plus vite, pulsation qui s'y recharge plus vite.
  - **Sanctuaire** : soins deux fois plus rapides, êtres plus résistants, cœur qui blanchit plus vite.

  Le premier coûte ✦ 150, le deuxième ✦ 50 k, puis ×20.
- **Chaque village vit à part** : son territoire, son jardin, ses êtres (qui y récoltent, y déposent et s'y
  rallument), ses bâtiments, son rendement pendant l'absence. Les êtres et les plans s'achètent dans le village
  où l'on se trouve ; les fondations ne se proposent qu'au-dehors.
- **Territoire vivant** : une grille de cellules qui pousse au bord, là où le village attire sa lumière (près du
  cœur, vers ses bâtiments, en grandes ondulations), avec une silhouette propre au type : pétales, octogone,
  carré, rayons, disque. **Le cœur blanchit** lentement, et ce blanc se répand plus lentement encore ; dans le
  blanc, les ombres brûlent trois fois plus et la lumière dorée naît deux fois plus souvent.
- **Architecture** : chaque cœur a son dessin (fleur, remparts à tourelles, engrenage, arcs et astres en orbite,
  ondes) ; les bâtiments portent un halo aux couleurs de leur village.
- **Les marées visent un village** (d'autant plus souvent qu'il est vaste) ; les ombres rongent son cœur ;
  l'armée défend son propre village.
- **Dispersion** : la lumière éclate où elle tombe, l'écran s'éteint, puis ses éclats se rassemblent au village
  le plus proche (ou à l'origine) et une onde rouvre le monde.
- Carte : la vraie forme de chaque village et son blanc. Une petite flèche indique le village le plus proche.
- Souvenirs : Racines agrandit tous tes villages ; Éveil précoce place ses lueurs dans le premier village fondé.
- Sauvegarde au format 10 : l'ancien territoire devient un premier village de jardins, à l'origine, avec ses
  êtres, ses bâtiments et son rendement.
- 226 tests de logique, 30 vérifications navigateur ; robot d'équilibrage qui fonde et rejoint ses villages.

## 1.1.0 — Retouches et caméra

Premiers retours de jeu sur la 1.0.

- **Carte peinte** : les régions se fondent en dégradés, l'inexploré reste dans le brouillard, plus aucun
  texte sur la carte (les colosses y sont marqués d'un simple anneau doré).
- **Pattes des colosses** : les genoux restent toujours tournés vers l'extérieur du corps, chaque pas est
  limité en longueur, et les colosses tournent plus lentement — fini les pattes qui virevoltaient.
- **Caméra** : zoom à la molette, au pincement (deux doigts) ou avec + et −, gardé d'une session à l'autre ;
  la caméra **recule d'elle-même** quand un colosse approche, pour qu'on le voie en entier.
- **Éveil** : une animation sans un mot au lancement — un point s'allume dans le noir, des éclats
  convergent vers lui, puis une onde dévoile le monde. Un clic ou une touche l'abrège.
- **Options** dans le menu : secousses réduites (suit par défaut « réduire les animations » du système),
  **exporter / importer** la partie sous forme de code.
- Le menu défile sur petit écran.
- 199 tests de logique, 29 vérifications navigateur.

## 1.0.0 — Renaissance

- **Renaissance** (onglet souvenirs) : après 4 M de lumière récoltée depuis le dernier départ, se dissoudre
  pour renaître. Souvenirs ✧ gagnés selon la racine carrée de la lumière récoltée. Repartent de zéro :
  lumière, améliorations, territoire, êtres, bâtiments, échos. Restent : colosses (et leurs bienfaits),
  zones explorées, journal, souvenirs. Confirmation avant de renaître, bannière, nouveau fragment du récit.
- **5 bienfaits éternels** en souvenirs : Éclat ancien (toute lumière ×), Racines (foyer déjà allumé,
  territoire plus vaste), Éveil précoce (lueurs dès le départ), Souffle ancien (pulsation plus rapide),
  Mémoire profonde (absence plus longue).
- Statistiques de partie dans le menu (ombres dissipées, colosses apaisés, renaissances).
- Robot d'équilibrage : mode `--renaissance` pour comparer les vies successives ; corrigé un retour au
  foyer intempestif du robot.
- Mise en page mobile revue (messages, bannières, jauge de combat).
- **Équilibrage** : un emballement tardif (révélé par le robot corrigé) est maîtrisé — Éclat, Ferveur et
  Fertilité réglées, garde-fou plus strict ; la progression ralentit en douceur sur deux heures de jeu.
- Sauvegarde au format 9 : toutes les parties depuis la 0.1 se chargent.
- 193 tests de logique, 24 vérifications navigateur.

## 0.9.0 — D'autres colosses

- **La Tisseuse**, fileuse des courants (après le Veilleur) : araignée colossale à **huit pattes** qui marche
  par tétrapodes alternés. Elle lance des **toiles** annoncées qui ralentissent fortement ta lumière et tes
  êtres. Quatre sceaux. Apaisée : +10 places de population, êtres 30 % plus rapides.
- **Le Léviathan**, nageur des profondeurs (après la Tisseuse) : serpent immense de 30 vertèbres qui
  **ondule** réellement, nageoires qui battent. Sa **charge** est annoncée par un couloir, puis il fonce
  et frappe tout ce qui reste sur sa ligne. Quatre sceaux le long du dos. Apaisé : échos ×2, mémoire +12 h.
- **Colosses décrits par des données** : corps à pattes (quadrupède, arachnide) ou serpent, attaques
  (piétinement, souffle, toile, charge), sceaux, bienfaits, textes. Chacun se fait entendre une fois
  le précédent apaisé, et vit plus loin que lui.
- 3 nouveaux fragments du récit (21 au total).
- 182 tests de logique, 23 vérifications navigateur.

## 0.8.0 — Échos du vide

- **Son génératif** (WebAudio, aucun fichier) : chaque particule récoltée tinte sur une gamme pentatonique,
  la pulsation souffle, les dépôts au foyer carillonnent, les naissances montent en arpège, les marées
  grondent, les ombres s'éteignent en un souffle sourd ; le Veilleur fait trembler le sol à chaque pas,
  et son **battement de cœur** s'entend de plus en plus fort à mesure qu'on approche.
- **Nappe d'ambiance** propre à chaque zone, qui glisse doucement d'une note à l'autre (étouffée par le brouillard).
- **Réglages du son** dans le menu (activer / couper, volume), gardés à part de la sauvegarde.
- **Récit discret** : 18 fragments qui se révèlent au fil de la progression (premier foyer, première ombre,
  chaque zone, le Veilleur…), affichés comme des citations, et un **journal** dans le menu.
- Sauvegarde au format 8.
- 174 tests de logique, 23 vérifications navigateur.

## 0.7.0 — Le premier colosse

- **Le Veilleur**, gardien des confins : une créature immense à quatre pattes (près de la moitié de l'écran),
  faite de lumière pâle — silhouette, côtes, colonne, queue qui ondule.
- **Marche procédurale** : chaque pied reste planté au sol et ne se lève que quand le corps s'en éloigne trop,
  par paires diagonales ; genoux calculés par cinématique inverse ; chaque pas lourd fait trembler l'écran.
- **Le trouver** : après 15 ombres vaincues, un battement immense s'entend — une flèche dorée bat comme
  un cœur sur le bord de l'écran, vers son repaire lointain (6 500 unités, direction propre à chaque partie).
- **Le combat** : ses attaques sont toujours annoncées — **piétinement** (cercles au sol) et **souffle**
  (cône) — on peut les esquiver. **Trois sceaux** (tête, dos, queue) à briser dans l'ordre à la pulsation.
  **L'armée** frappe ses pattes et remplit une jauge : plein, il **pose un genou à terre** (plus d'attaques,
  sceaux à double dégâts). S'éloigner : il renonce et ses sceaux se referment.
- **Apaisé**, il devient doré, rejoint ton territoire et en fait la ronde : croissance du territoire ×2,
  et ses pas écrasent les ombres qui approchent.
- Jauge de combat (nom, sceaux, genou), bannière de rencontre, repère sur la carte.
- Sauvegarde au format 7.
- 165 tests de logique, 23 vérifications navigateur.

## 0.6.0 — Les zones

- **Le vide se découpe en régions** irrégulières (stables pour une partie), dont la nature dépend
  de la distance au foyer : plus loin, plus riche et plus dangereux.
  - **Le Calme** autour du foyer : sûr, aucune ombre errante.
  - **La Brume** : lumière abondante, brouillard qui resserre la vue.
  - **Les Courants** : un flot qui emporte ta lumière et les particules.
  - **Le Murmure** : ombres nombreuses, lumière rare ×3, échos ×1,5.
  - **L'Éclat** : lumière rare ×6, ombres redoutables, échos ×2.
  - **Le Gouffre** : le fond du vide, lumière rare ×10, échos ×3, massives.
- **Annonce de zone** (nom en grand, description à la découverte), **teinte** de la lumière et de la
  poussière propre à chaque zone, **brouillard** qui se lève en douceur.
- **Carte** des régions explorées (touche M ou bouton en haut à droite), avec territoire et bâtiments.
- Sauvegarde au format 6.
- 146 tests de logique, 21 vérifications navigateur.

## 0.5.0 — Les ombres

- **Marées d'ombres** : attirées par le territoire (dès un rayon de 160), elles arrivent d'une direction
  annoncée (message + flèche violette sur le bord) et grossissent avec le temps.
  **Errante** (attaque le plus proche), **Rôdeuse** (traque les êtres), **Massive** (vise les bâtiments).
  Loin du territoire, des ombres errent aussi près de ta lumière.
- **Le territoire brûle les ombres** qui y entrent : une marée finit toujours par s'éteindre.
- **Vitalité** : ta lumière peut être blessée (anneau autour d'elle, voile violet), se régénère
  (plus vite dans le territoire) ; à zéro, elle se **disperse** et renaît au foyer en perdant 10 % de sa lumière.
- **La pulsation blesse les ombres.** Les ombres vaincues laissent des **échos ◆**, seconde ressource.
- **L'armée**, en combat automatique : **Gardien** (mêlée), **Étincelle** (traits à distance),
  **Veilleuse** (soigne les êtres et ta lumière). Ordres de groupe : **garder** le territoire,
  **escorter** ta lumière, **chasser** au loin (barre d'ordres ou touches G, E, C).
- **Les êtres et les bâtiments peuvent tomber** : un être vaincu se rallume au foyer après 20 s,
  un bâtiment éteint ne fonctionne plus jusqu'à ce que les bâtisseurs le réparent. Les ombres au foyer
  rongent ta réserve de lumière.
- **Tour de lumière** (bâtiment, lumière + échos) qui tire sur les ombres.
- **5 améliorations de combat** : Brûlure, Intensité, Vigueur, Tranchant (en échos), Résonance.
- Sauvegarde au format 5.
- 131 tests de logique, 19 vérifications navigateur ; robot d'équilibrage avec les combats.

## 0.4.0 — Vie autonome

- **Les bâtisseurs**, deuxième espèce : ils vivent au foyer (hors population, 2 au plus).
- **Bâtiments** : tu achètes un plan, la colonie choisit l'emplacement (à la bonne distance du foyer,
  loin des autres) et le construit seule. **Nid** (+4 places), **Prisme** (relais de dépôt loin du foyer,
  lumière ×1,25), **Phare** (+25 % de croissance du territoire, faisceau tournant).
- **Interactions** : les lueurs ravitaillent les chantiers actifs sur leur chemin ; deux êtres oisifs
  qui se croisent dansent un instant ensemble.
- **Absence** : les chantiers avancent pendant que tu n'es pas là.
- Amélioration Ardeur (vitesse de construction).
- **Équilibrage** : Éclat et Ferveur réglées pour que le revenu ne s'emballe plus (test garde-fou ajouté).
- Sauvegarde au format 4.
- 109 tests de logique, 17 vérifications navigateur.

## 0.3.0 — Premières lueurs

- **Le jardin** : la lumière naît d'elle-même dans le territoire, d'autant plus qu'il est grand.
- **Les lueurs**, premiers êtres autonomes : chacune repère la lumière libre la plus proche, la réserve
  (deux lueurs ne visent jamais la même), la ramasse, et rapporte sa charge au foyer, qui s'illumine.
  Sans travail, elles flânent dans le territoire. Le joueur peut aussi récolter le jardin.
- **Améliorations** : Agilité, Charge, Ferveur (onglet êtres), Floraison (territoire).
  Population limitée à 6 pour l'instant.
- **Absence** : les êtres continuent au rythme mesuré avant ton départ.
- Sauvegarde au format 3 (migration depuis la 0.2).
- 93 tests de logique, 16 vérifications navigateur.

## 0.2.0 — Le territoire

- **Le foyer** : en revenant à l'origine, on l'allume (✦ 150). Un territoire de lumière naît autour de lui.
- **Le territoire grandit lentement**, toujours, même sans toi : sa surface croît à vitesse constante,
  son rayon de plus en plus doucement. Contour organique, lueurs qui dérivent à l'intérieur.
- **Rayonnement** : le territoire produit de la lumière selon sa surface. Dans le territoire,
  la pulsation se recharge deux fois plus vite.
- **3 améliorations de territoire** : Expansion, Fertilité, Mémoire.
- **Absence** : au retour (page rouverte ou onglet réaffiché), le territoire a grandi et rayonné —
  écran « pendant ton absence ». Durée prise en compte : 4 h, +1 h par niveau de Mémoire.
- **Boutique en onglets** (touche Tab), catalogue générique d'achats, messages discrets.
- Sauvegarde au format 2 : les parties de la 0.1 se chargent sans perte.
- 79 tests de logique, 15 vérifications navigateur.

## 0.1.0 — Le noyau

Première version jouable : une lumière seule dans le vide.

- **Déplacement** à la souris / au doigt maintenu, ou au clavier (ZQSD, WASD, flèches).
- **Vide infini** rempli de particules de lumière qui naissent en fondu autour du joueur ;
  particules rares dorées (×10).
- **Attraction et récolte** : les particules attrapées poursuivent la lumière.
- **Pulsation** (Espace) : une onde attrape tout ce qu'elle traverse, puis se recharge.
- **5 améliorations** : Portée, Élan, Éclat, Densité, Pulsation.
- **Interface progressive** : rien au départ, chaque élément apparaît quand il devient utile.
- **Sauvegarde automatique** versionnée (format 1), avec migrations et nettoyage des données abîmées.
- **Menu** (Échap) : pause, contrôles, statistiques, recommencer.
- **Ambiance** : poussière en parallaxe, foyer d'origine, traînée, vignettage, ouverture.
- 55 tests de logique, test de fumée navigateur, robot d'équilibrage.

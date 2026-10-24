# Historique des versions

## 2.4.0 — Le monde vit

Le vide se peuple : de nouvelles unités, des créatures qui changent de camp, des sous-factions, des colosses plus
grands, des convois et une faune — et un menu d'achat refait.

- **Nouvelles unités** : le porte-bouclier (il attire les coups des ombres proches et n'en encaisse que la moitié),
  le lancier (longue allonge ; ses coups comptent quatre fois contre ouvrages et remparts d'ombre). Côté ombres :
  la cracheuse (elle frappe de loin), la fouisseuse (elle passe sous les murailles), la bélière (elle les enfonce).
- **Sous-factions** : à chaque fondation, on choisit le type **et** la sous-faction — Éleveurs (ils apprivoisent ;
  deux êtres de plus), Illuminés (ils purifient ; blanc ×1,4), Lames (×1,5 contre les créatures, deux fois plus
  d'échos) — et on la change quand on veut, village par village. Un village né d'un autre (des colons) en hérite le
  plus souvent, ou mute ; tous restent amis. Les bases d'ombre ont les leurs : Dévoreurs, Corrupteurs, Meutes.
- **Créatures intermédiaires**, aux corps articulés : loups, scolopendres, cerfs (un cerf de lumière s'achète
  comme gardien d'un village). Tuables ou convertibles par les deux camps : à bout de forces, une créature est
  apprivoisée, purifiée ou corrompue selon la sous-faction de qui l'abat, et rejoint ce village ou cette base. Les
  bases mûres ont une garnison ; avec la guerre, leurs raids lâchent des meutes. La lumière des territoires les
  ronge.
- **Colosses** plus grands (×1,4) et bien plus solides (sceaux ×2) : de 3 à 7 minutes de combat chacun pour le
  duelliste.
- **Convois** : les caravanes roulent sur leurs routes en chariots ; attaqués, ils s'arrêtent pour faire face ; s'ils
  tombent, la charge est perdue. **Faune du vide**, neutre : lucioles, raies de lumière, baleine du vide —
  apprivoisées par ta pulsation si tu es Éleveur, prises par les bases de Meutes.
- **Menu d'achat refait** : un onglet pour le village où l'on est (sa fiche : type, sous-faction à changer d'un
  geste, population, armée, place, enceintes ; ses achats en sections), un compositeur de fondation (type,
  sous-faction, prix), « lumière », « monde » (ce qui vaut pour tous tes villages), « souvenirs ».
- Corrigé en route : les bases lointaines lâchaient des meutes dès les premières minutes (elles ne viennent plus
  qu'avec la guerre).
- Sauvegarde : format 25 (sous-factions, créatures attachées).
- 396 tests de logique, 42 vérifications navigateur.

## 2.3.0 — Les bases des ombres

Les ombres bâtissent pour de bon : leurs nids deviennent des bases, en négatif de tes villages, et leur
essaimage ouvre la guerre.

- **De vraies bases** : un cœur noir et un territoire de noirceur (les mêmes cellules que tes territoires, en cinq
  nuances de noir jusqu'au noir pur) qui grandit avec l'âge. Ni la base ni tes villages n'empiètent l'un sur
  l'autre. Sur leur plan radial, elles bâtissent seules : **fosses** (raids plus nombreux, défenseurs de plus),
  **flèches** (elles tirent sur toi, tes êtres, tes expéditions), puis des **remparts d'ombre** — sans porte pour
  la lumière, que les ombres traversent.
- **Le siège** : l'armée frappe le rempart qui l'arrête jusqu'à la brèche, abat les ouvrages (les flèches
  d'abord), puis le cœur ; ta pulsation touche aussi ouvrages et remparts.
- **Les avant-postes** : une base mûre, née près de tes villages, essaime vers le plus proche (les bases des régions
  lointaines restent chez elles). Le premier avant-poste **ouvre la
  guerre** — douce d'abord (la tension : des ombres rôdent autour de tes villages sans attaquer, puis s'en vont),
  puis âpre, puis rude en une heure : vrais raids, plus gros, raids, constructions et essaimage plus rapides. Une
  ligne discrète sous ta lumière dit où elle en est. Pendant l'absence, tout est possible : des avant-postes
  naissent, la guerre s'ouvre et mûrit (résumé au retour).
- **Prendre une base** : abattre son cœur rend son terrain au vide, ou à ton village s'il le touche (une lumière
  neuve, qui blanchira).
- Dessin : un voile violet sombre qui s'épaissit à chaque nuance, le noir pur cerné de violet au cœur, remparts à
  double liseré, fosses, flèches et leurs traits ; sur la carte, le territoire réel des bases. On dit désormais
  « base d'ombre » (le « nid » est un logis de tes villages).
- Performances : flèches, murailles et onde ne calculent plus que ce qui est à portée. Le robot d'équilibrage
  suit les bases et la guerre : elle s'ouvre vers 50 min, devient âpre vers une heure ; la progression reste saine.
- Sauvegarde : format 23 (territoire, ouvrages, remparts et avant-postes des bases ; la guerre).
- 370 tests de logique, 41 vérifications navigateur.

## 2.2.0 — Des villages bâtis avec logique

Chaque village devient une ville en étoile : un plan, des rues, des portes, des enceintes.

- **Le plan** : autour du cœur, des boulevards en anneaux et quatre avenues orientées selon le village ; entre
  eux, des îlots. Chaque bâtiment y prend sa place selon son rôle : vie et savoir au centre, logis autour,
  production plus loin, défense au bord, près des avenues et répartie d'une porte à l'autre ; les quarts du
  village se remplissent à parts égales. Un bâtiment posé ne bouge plus quand le village grandit ; l'intendant
  suit le plan ; les villages existants s'y rangent (une cité garde ses bâtiments et des places autour de ses
  anciens cœurs).
- **Les enceintes** : un achat par village, au prix de sa longueur, monté par les bâtisseurs qui en suivent le
  front ; une couche de plus quand le village grandit. Elles arrêtent tout — ta lumière, les êtres, les ombres,
  les expéditions — sauf les colosses. Les portes, au bout des avenues, s'ouvrent à la lumière, jamais aux
  ombres : une ombre bloquée frappe le pan qui l'arrête jusqu'à la brèche, que les bâtisseurs relèvent (aussi
  pendant l'absence).
- **Circuler** : êtres et expéditions passent par la porte qui fait le moins de détour. Les routes partent du cœur
  par l'avenue la mieux tournée, passent la porte, puis une grande route **courbe** (un peu d'ondulation, propre
  à chaque route) rejoint l'autre village en contournant ceux qui sont sur son chemin. Les routes qui sortent
  par la même porte **partagent un tronc** plus large, puis se séparent à un carrefour. Les caravanes suivent le
  tracé ; ta lumière y file tout du long.
- **Graphismes** : boulevards et avenues dessinés dans le territoire, parcelles sous les bâtiments (teintées par
  famille, reliées au boulevard), enceintes à double trait avec bornes aux portes, brèches et pans frappés
  visibles, chantier qui progresse ; sur la carte, routes courbes, troncs et enceintes.
- Sauvegarde : format 21 (plan, enceintes).
- 360 tests de logique, 41 vérifications navigateur.

## 2.1.0 — Les fondations

Premier pas de « du vide au champ de bataille » : une économie qui ne renchérit plus que sur ce qui le mérite,
et un blanc qui mûrit pour de bon.

- **Prix fixes** : recruter un être ou bâtir coûte toujours le même prix. Seules les améliorations (de la
  lumière, générales), les fondations et les routes renchérissent.
- **Ce qui limite désormais** : les logements (population : les nids), les casernes (toute l'armée d'un village
  partage un plafond : 3 au départ, +4 par caserne, +4 dans un bastion), la place (un emplacement à bâtir par lot
  de 40 000 de surface) et un nombre maximal de chaque bâtiment par village. La boutique affiche ×n/max et la
  place restante ; les messages disent quoi faire (« population pleine : un nid », « armée au complet : une
  caserne », « plus de place : le territoire doit grandir »).
- **Nouvelle caserne** (enclos, rangs, fanions) ; l'intendant respecte la place et les maximums.
- **Le blanc en cinq nuances** : il mûrit nuance après nuance, chacune plus lente que la précédente, jusqu'au
  blanc pur au cœur ; les nuances pâles restent vers le bord. Plus une cellule est blanche, plus elle tient
  (prépare la guerre). À l'écran, les nuances s'empilent et le blanc pur est cerné d'un liseré ; même dégradé sur
  la carte.
- **Équilibrage** : le robot d'équilibrage joue désormais comme un joueur (il économise pour le bâtisseur puis le
  nid d'un village plein). Aucune impasse : bâtisseur vers 5 min, ~3 M à 30 min, puis une croissance qui ralentit
  doucement jusqu'à deux heures ; chaque renaissance atteint le million plus vite.
- 342 tests de logique, 41 vérifications navigateur.

## 2.0.1 — Le monde ne file plus

- **Villages qui semblaient se déplacer** : dans les Courants (et l'Éclat), le courant emportait ta lumière *et*
  les particules ; comme la caméra te suit, tout cela paraissait immobile et c'était le village, pourtant fixe,
  qui filait à l'écran. Le courant n'emporte plus que ta lumière ; les particules restent posées, et de longues
  traînées pâles montrent le sens du flot.
- **Carte** : le fondu entre régions ne dépasse plus ~120 unités du monde ; dézoomée, la carte garde des
  frontières nettes (un village proche d'une frontière ne semble plus changer de région).
- 340 tests de logique, 41 vérifications navigateur.

## 2.0.0 — Équilibrage et finitions

La boucle est bouclée : du vide plein d'autrefois à la lueur seule, des premiers villages aux sept colosses
apaisés, jusqu'à l'épilogue.

- **Le duelliste** (`node tests/duel.js`) : un robot affronte chaque colosse avec ce qu'on possède à son éveil,
  sans engins. Les sept sont apaisables, en une minute et demie à quatre minutes de combat pour un joueur adroit.
  Réglages qui en découlent : la Méduse et la Nuée pliaient sans cesse sous une armée devenue grande (leur jauge
  est bien plus solide), la Tisseuse un peu plus solide, sceaux de la Méduse et de la Nuée renforcés, la Nuée
  perd moins d'éclats sous les coups, le Dormeur a des rêves plus tenaces et des cauchemars plus nombreux.
- **La partie longue** : deux heures de robot, avec et sans renaissances ; la progression reste saine.
  - Un colosse ne marche plus sur des villages sans défense (une vie qui recommence) : il lui faut face à lui au
    moins quatre soldats ; et une vie neuve repart avec l'horloge des marches.
- **Corrections** : la carte cadre le repaire d'un colosse entendu même hors des régions explorées (on peut y
  envoyer des érudits) ; la barre du colosse s'affiche près du Dormeur endormi.
- **Accessibilité** : le réglage « secousses, éclairs » adoucit aussi l'éclair plein écran de l'ouverture.
- **Performances** : 426 êtres, tous les colosses et la Nuée à l'écran à 60 images par seconde.
- README : présentation, captures, aide à jour.
- 339 tests de logique, 41 vérifications navigateur.

## 1.9.0 — Cinématiques

Des tableaux peints en code, sans un mot, qui racontent l'histoire du vide.

- **L'ouverture** (une partie neuve) : le vide était plein, une lumière immense entourée des colosses ; elle se
  fend et éclate ; ses éclats filent au loin, et chaque colosse s'endort autour de l'un d'eux. Il ne reste
  qu'une lueur — toi.
- **Rencontres** : chaque colosse se dresse au-dessus de ta lueur minuscule, et ouvre les yeux.
- **Apaisements** : l'or gagne son corps, puis il prend sa place dans le ciel des colosses apaisés.
- **Renaissance** : ta lumière se dissout, tes villages s'éteignent ; le ciel des colosses demeure, et à
  l'aube une lueur se rallume.
- **Épilogue** : quand le Dormeur s'éveille, les sept constellations se rejoignent et la lumière d'avant
  renaît.
- Plein écran, bandes noires, fondus ; un toucher, Échap, Espace ou Entrée passe le tableau ; le monde attend.
  Les tableaux vus se revoient depuis le menu (« tableaux ») ; un réglage permet de les couper.
- Sauvegarde au format 19 (tableaux vus ; une partie en cours compte ce qu'elle a déjà vécu comme vu).
- 338 tests de logique, 41 vérifications navigateur.

## 1.8.0 — Nouveaux colosses

Quatre colosses de plus, chacun avec sa façon d'être affronté — et un rôle une fois apaisé.

- **L'Oiseau d'aube** (après le Veilleur) : il vole, hors d'atteinte de la pulsation et du corps à corps. Il
  tourne autour de toi, pique au ras du sol, souffle des rafales qui repoussent, fait pleuvoir des plumes.
  Cloue-le au sol : une chaîne le tire à terre, sa jauge pleine (traits, harpons, balistes) l'y abat ; il se
  pose aussi, rarement, de lui-même. Apaisé, il t'accompagne et révèle le lointain ; ta lumière file plus vite.
- **La Méduse** (après l'Oiseau et la Tisseuse) : une cloche qui pulse et avance par à-coups. Ses sceaux ne
  s'ouvrent qu'au sommet de chaque pulsation : frappe au bon moment. Fouet de tentacules, séisme, toiles.
  Apaisée, elle flotte jusqu'au village le plus abîmé et le répare à chaque pulsation.
- **La Nuée** (après le Léviathan) : des centaines d'éclats autour de quatre noyaux. Tant qu'ils entourent le
  noyau, il est à l'abri : ton onde les détruit, ton armée les dévore, ils renaissent. Leur contact brûle.
  Assaut sur l'endroit marqué, tourbillon qui se referme sur toi. Apaisée, elle tourne autour de toi et rabat la
  lumière (portée ×1,5).
- **Le Dormeur** (quand tous les autres sont apaisés) : immense, il ne combat pas. Ses rêves sont sur son dos ;
  tiens-toi sur lui pour les apaiser, et affronte les cauchemars que chacun libère. Éveillé, il te laisse bâtir
  sur son dos : ce village grandit trois fois plus vite et rayonne deux fois plus.
- La barre du colosse dit ce qui protège son sceau (en vol, refermée, protégée).
- Les colosses apaisés font leur ronde plus loin, selon leur taille : le village reste visible.
- Cinq fragments du récit (29 au total).
- 337 tests de logique, 36 vérifications navigateur.

## 1.7.0 — Colosses redoutables

- **Bien plus grands** : chaque colosse a pris une fois et demie à presque deux fois sa taille. La caméra recule
  et se tourne vers lui pour qu'on le voie presque entier, et soi tout petit à côté.
- **Sceaux voilés** : tant qu'ils ne sont pas étudiés, la pulsation glisse dessus. Depuis la carte, envoie des
  **érudits** au repaire d'un colosse : à l'abri, ils l'observent et dévoilent un sceau après l'autre (deux fois
  plus vite si leur village a du savoir ✎), même pendant l'absence. L'armée peut déjà le faire plier.
- **Phases** : chaque sceau brisé le relève en rugissant. Son rugissement est un **séisme**, un anneau qui
  s'étend, percé de quelques brèches où se glisser (ou à franchir d'une ruée). Ensuite il est plus vif, frappe
  plus souvent, annonce ses coups plus tard, et gagne une attaque : séisme, **balayage** (un souffle étroit qui
  parcourt un large arc), **pluie de toiles**. Ses coups font plus mal.
- **La relève** : depuis la carte, des **sapeurs** (deux bâtisseurs) bâtissent sur place une **baliste** (de
  lourds traits qui le font plier, ou qui visent un nid) ou une **chaîne** (elle retient le colosse qui passe :
  ralenti, à genou plus longtemps ; elle s'use puis cède). Ses pas et ses séismes écrasent les engins.
  Le **harponneur**, troupe de siège, frappe sept fois plus fort colosses et cœurs de nids ; l'ordre
  « assiéger » vise aussi un colosse en combat près du village.
- **Ils marchent sur tes villages** : pendant le jeu seulement, un colosse déjà rencontré quitte parfois son
  repaire pour piétiner ton village le plus proche. Provoque-le, ou fais-le plier, pour le détourner.
- **Apaisés, ils ont un rôle** : le Veilleur marche vers le danger et l'écrase (et tient tête à un colosse en
  marche), la Tisseuse tisse tes routes en chantier, le Léviathan porte tes expéditions, trois fois plus vite et
  hors d'atteinte des ombres.
- Sauvegarde au format 18 (sceaux étudiés, engins de siège).
- 314 tests de logique, 36 vérifications navigateur.

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

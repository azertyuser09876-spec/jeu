// Réglages du jeu. Toutes les distances sont en unités du monde.
(function (Vide) {
  'use strict';

  Vide.CONFIG = {
    // Pas de simulation fixe : la logique avance toujours par tranches de 1/60 s.
    step: 1 / 60,
    maxStepsPerFrame: 8,

    // Surface du monde visible à l'écran (unités²), identique quel que soit l'appareil :
    // un téléphone en portrait ne voit ni plus ni moins de vide qu'un écran large.
    viewArea: 700 * 1000,

    player: {
      radius: 6,
      speed: 150,        // vitesse de base (unités / s)
      acceleration: 6,   // réactivité du démarrage et du freinage
    },

    // Particules de lumière flottant dans le vide, générées autour de la lumière du joueur.
    field: {
      density: 0.00007,  // particules par unité² (avant améliorations)
      radius: 1300,      // elles naissent dans ce rayon autour du joueur (couvre l'écran même dézoomé)…
      despawnRadius: 1450, // …et s'effacent au-delà de celui-ci
      maxParticles: 1500,  // plafond pour garder un affichage fluide
      refillTime: 6,     // secondes pour reremplir un champ entièrement vidé
      fadeIn: 1.5,       // durée d'apparition en fondu
      drift: 5,          // vitesse de dérive lente
      spawnGap: 30,      // marge hors du rayon d'attraction pour qu'aucune ne soit gratuite
      rareChance: 0.02,
      rareValue: 10,
    },

    attraction: {
      radius: 60,        // rayon d'attraction de base
      pullSpeed: 140,    // vitesse d'une particule qui vient d'être attrapée…
      pullAccel: 900,    // …puis accélération tant qu'elle n'a pas rejoint la lumière
      collectRadius: 9,
    },

    // Capacité active : une onde part de la lumière et attrape toutes les particules qu'elle traverse.
    pulse: {
      radius: 180,       // portée de base de l'onde
      cooldown: 12,      // secondes avant de pouvoir recommencer
      waveSpeed: 700,    // vitesse d'expansion de l'onde
    },

    // Territoire de lumière autour du cœur de chaque village. Sa surface croît linéairement dans le temps :
    // le rayon grandit donc de plus en plus lentement, sans jamais s'arrêter.
    territory: {
      startRadius: 60,
      growth: 70,            // unités² gagnées par seconde (avant améliorations)
      yield: 4e-5,           // lumière par seconde et par unité² de territoire
      insidePulseBoost: 2,   // la pulsation se recharge plus vite dans le territoire
      offlineCap: 4 * 3600,  // durée d'absence prise en compte (avant améliorations)
      // Forme : une grille de cellules, ajoutées une à une là où le village attire sa lumière.
      cell: 40,              // côté d'une cellule (unités)
      noise: 0.35,           // irrégularité du bord
      pull: 0.6,             // attrait des bâtiments (le territoire pousse vers eux)
      pullRange: 160,
      // Blanc : les cellules pleines blanchissent lentement depuis le cœur, et le blanc se répand plus lentement
      // encore, sans dépasser une part du rayon.
      whiteTime: 600,        // secondes pour 100 pas de blanc (les nuances les plus blanches sont plus lentes :
                             // le cœur atteint le blanc pur en un peu moins d'une heure)
      whiteReach: 0.75,      // le blanc reste dans cette fraction du rayon
      whiteBurn: 3,          // dans le blanc, les ombres brûlent d'autant plus
      whiteRare: 2,          // … et la lumière dorée naît d'autant plus souvent
    },

    // Villages : le joueur les fonde où il veut. Le premier est bon marché, les suivants de plus en plus chers.
    villages: {
      firstCost: 150,
      cost: 50000,       // deuxième village…
      growth: 20,        // …puis ×20 à chaque nouveau village
      gap: 450,          // distance minimale entre le cœur d'un nouveau village et le bord d'un autre
      reach: 40,         // marge autour du territoire où l'on est encore « dans » le village (boutique)
      max: 40,
      lotArea: 40000,    // un emplacement à bâtir de plus par tant de surface (un carré de 200 de côté)
    },

    // Créatures intermédiaires (voir creatures.js).
    creatures: {
      convertAt: 0.25,    // à ce reste de vie, une créature est retournée (si la sous-faction de qui la frappe le peut)…
      convertHp: 0.6,     // …et repart avec cette part de sa vie
      sense: 650,         // une bête des ombres lâchée dans un raid repère ses proies à cette distance
      garrisonFrom: 4,    // une base entretient des loups dès ce niveau…
      scolopendreFrom: 7, // …et une scolopendre dès celui-ci
      raidFrom: 4,        // ses raids lâchent une meute dès ce niveau…
      raidChance: 0.5,    // …une fois sur deux
      // La faune du vide : combien de bêtes sauvages autour de la lumière, selon la zone…
      fauna: { calme: 2, brume: 3, courants: 3, murmure: 2, eclat: 3, gouffre: 2 },
      faunaEvery: 2,      // …regardé toutes les 2 s ;
      faunaNear: 2200,    // elles comptent à cette distance…
      faunaSpawn: [1300, 1800], // …naissent à cette distance (hors de la vue)…
      faunaFar: 3600,     // …et s'effacent au-delà de celle-ci
      packTame: 6,        // secondes dans le territoire d'une base de Meutes avant d'être prise par la meute
    },

    // Gouverneurs (voir governors.js, steward.js).
    governors: {
      pocket: 0.15,        // en économisant, il ne s'accorde que des dépenses de moins de ce part du prix visé…
      pocketWant: 0.5,     // …et presque aussi voulues (au moins cette part de l'envie)
      // Ses stats invisibles (voir governors.js) :
      horizon: 600,        // il veut ce qui rend le plus de son prix en 10 min
      floorRate: 5,        // production supposée (✦/s) d'un village qui commence…
      lueurYield: 2,       // …et d'une lueur, au moins
      lotTime: 60,         // quand la place manque, un emplacement à bâtir vaut tant de secondes de production
      fade: 0.8,           // chaque exemplaire de plus d'un bâtiment rapporte d'autant moins
      ringFade: 0.35,      // chaque anneau d'enceinte de plus protège d'autant moins
      colonyYield: 0.3,    // une colonie rapporte d'abord cette part de ce que rapporte un village, en moyenne
      campaignRisk: 0.3,   // une campagne met en jeu cette part de ce que vaut l'armée
      ambitionTime: 2400,  // son ambition grandit sur ce temps (de jeu pour un village, d'âge pour une base)
      warThreat: 0.4,      // menace ressentie dès que la guerre est ouverte…
      baseThreat: 0.5,     // …une base d'ombre à moins de baseNear du bord du village…
      baseNear: 4000,
      tideThreat: 0.2,     // …des marées qui viennent
      militiaFrom: 0.35,   // menace à partir de laquelle il lève une milice…
      militia: 6,          // …jusqu'à ce nombre de soldats (davantage si la menace grandit)…
      militiaPrice: 2,     // …payés en lumière, deux fois le prix d'un gardien
      wallFrom: 0.35,      // menace à partir de laquelle il monte des enceintes
      ambitionFrom: 0.25,  // ambition à partir de laquelle il relie, fait des cités…
      colonsFrom: 0.4,     // …lance des colons…
      colonyReach: 900,    // (à cette distance au-delà de l'écart minimal entre villages)
      colonyClear: 2500,   // (loin des bases d'ombre)
      campaignFrom: 0.5,   // …et mène une campagne contre une base proche…
      campaignArmy: 8,     // …avec au moins tant de soldats…
      campaignRange: 6000, // …jusqu'à cette distance…
      campaignRetreat: 3,  // …et rentre quand il n'en reste que tant
      // La cité qui va avec chaque sous-faction.
      specialty: { eleveurs: 'jardins', illumines: 'sanctuaire', lames: 'bastion' },
    },

    // Sous-factions (voir factions.js).
    factions: {
      inherit: 0.85,     // chance qu'un village fondé depuis un autre (un avant-poste depuis sa base) en hérite
    },

    // Les fronts (voir fronts.js) : là où un village touche une base, les cellules du contact se disputent.
    fronts: {
      every: 4,            // un tour toutes les 4 s
      bite: 0.6,           // chance qu'une cellule neuve cède à un assaut…
      hold: 0.9,           // …moins cette part pour une cellule de blanc pur ou de noirceur profonde
      perSoldier: 0.25,    // pression d'un village : par soldat…
      perTower: 0.6,       // …par tour (une citadelle en vaut deux)
      darkBase: 0.5,       // pression d'une base (en guerre ouverte) : de base…
      perLevel: 0.25,      // …par niveau…
      perBeast: 0.3,       // …par bête de sa garnison (le tout multiplié par la rudesse de la guerre)
      tellEvery: 60,       // un message par front et par camp, au plus chaque minute
      creepEvery: 10,      // en guerre ouverte, la noirceur d'une base rampe d'une cellule vers ton village toutes les 10 s
    },

    // La guerre pendant l'absence (voir absence.js).
    absence: {
      turn: 20,            // un tour toutes les 20 s d'absence
      frontSteps: 1500,    // tours de front, au plus, sur toute une absence
      perSoldier: 1,       // défense d'un village contre un assaut : par soldat…
      perTower: 2.5,       // …par tour (une citadelle en vaut deux)…
      perWall: 3,          // …par enceinte debout
      echoPerWeight: 2,    // échos d'un assaut repoussé, par point de poids
      breakEvery: 4,       // un bâtiment éteint par tant de poids qui passe…
      maxBroken: 3,        // …au plus tant par assaut
      siegeDps: 3,         // ce qu'un soldat en campagne fait à une base, par seconde
      siegeLoss: 0.004,    // soldats perdus par seconde de siège et par niveau de la base
    },

    // La guerre (voir war.js) : elle s'ouvre avec le premier avant-poste.
    war: {
      ramp: 3600,        // elle atteint sa plus grande âpreté en une heure
      calm: 0.15,        // en deçà de cette âpreté, la tension : les avant-postes ne font que rôder
      pace: 1,           // au plus rude, les ombres vont deux fois plus vite (raids, constructions, essaimage)
      raidFrom: 0.7,     // taille des raids à l'ouverture de la guerre…
      raidTo: 2,         // …et au plus rude
      prowlers: 3,       // rôdeuses envoyées par un avant-poste pendant la tension…
      prowlTime: 90,     // …qui tournent autour de ton village ce temps-là, puis s'en vont
    },

    // Enceintes (voir walls.js).
    walls: {
      thickness: 16,     // épaisseur d'une muraille
      gate: 24,          // demi-largeur d'une porte
      segment: 90,       // longueur d'un pan (chacun a sa solidité)
      hp: 600,           // solidité d'un pan
      costPerUnit: 8,    // prix (lumière) par unité de longueur
      workPerUnit: 0.12, // travail des bâtisseurs par unité de longueur
      minBoulevard: 2,   // la première enceinte suit au moins le deuxième boulevard
      layerGap: 2,       // boulevards entre deux enceintes
      reach: 0.95,       // une enceinte reste dans cette part du rayon du territoire…
      inside: 0.85,      // … avec au moins cette part de son tracé dans le territoire
      shadowDamage: 1,   // coups d'une ombre sur un pan, en part de ses dégâts
    },

    // Routes entre villages.
    roads: {
      costPerUnit: 12,   // lumière par unité de longueur…
      growth: 1.6,       // …×1,6 à chaque nouvelle route
      buildSpeed: 8,     // longueur bâtie par seconde et par bâtisseur (aux deux bouts)
      maxLength: 6000,   // portée maximale d'une route
      near: 45,          // distance à la route où la lumière file plus vite…
      speedBonus: 1.6,   // …et de combien
    },

    // Ressources et échanges entre villages reliés (voir trade.js).
    trade: {
      matterRate: 0.03,      // ◇ par seconde et par habitant d'un atelier
      knowledgeRate: 0.015,  // ✎ par seconde et par habitant d'un observatoire
      matterUse: 0.05,       // ◇ consommée par seconde et par bâtisseur
      knowledgeUse: 0.03,    // ✎ consommé par seconde
      matterBoost: 1.5,      // chantiers d'un village qui a de la matière
      knowledgeBoost: 1.25,  // croissance d'un village qui a du savoir
      cap: 200,              // stock maximal de chaque ressource
      surplus: 20,           // un village garde ce stock pour lui…
      want: 60,              // …et en reçoit tant qu'il en a moins que ça
      load: 15,              // charge d'une caravane
      every: 10,             // une caravane au plus toutes les 10 s, par route et par sens
      caravanSpeed: 140,
      convoyHp: 150,         // solidité d'un convoi (les ombres peuvent s'en prendre à lui)…
      soldierConvoyHp: 260,  // …et d'un convoi de soldats ;
      convoyEngage: 90,      // une ombre à cette distance l'arrête
      trainEvery: 45,        // un bastion forme un gardien toutes les 45 s (s'il peut le payer)
      soldierPrice: 0.6,     // part du prix d'un gardien payée par le village qui le reçoit
    },

    // Cités : un village devenu immense peut ajouter une spécialité (les villages qui se touchent fusionnent).
    cities: {
      radius: 700,       // rayon à partir duquel un village peut se spécialiser davantage
      cost: 5e6,         // prix de la première spécialité ajoutée…
      growth: 8,         // …×8 pour chacune des suivantes
    },

    // Expéditions lancées depuis la carte (voir expeditions.js).
    expeditions: {
      speed: 70,         // unités par seconde
      range: 12000,      // portée depuis le village de départ
      max: 4,            // expéditions en route en même temps
      colonists: 3,      // lueurs qui partent fonder un village
      scouts: 2,
      escort: 2,         // gardiens qui les accompagnent (en option)
      scoutCost: 1.5,    // lumière par unité de distance, pour des éclaireurs
      reveal: 2600,      // rayon révélé par les éclaireurs
      engage: 90,        // une ombre plus proche que ça arrête l'expédition, qui fait face
      scholars: 2,       // érudits qui partent étudier un colosse
      scholarCost: 3,    // lumière par unité de distance, pour des érudits
      studyRange: 1900,  // ils l'observent à cette distance de son repaire
      studyTime: 45,     // secondes d'observation pour dévoiler un sceau…
      knowledgeSpeed: 2, // …deux fois moins si leur village a du savoir
    },

    // Capacités de la lumière (voir abilities.js).
    abilities: {
      dashTime: 0.3,       // durée d'une ruée…
      dashSpeed: 3.2,      // …à cette fois la vitesse de la lumière
      dashCooldown: 7,
      beaconCooldown: 20,
      beaconRadius: 170,   // le fanal récolte ce qui naît dans ce rayon
      beaconReach: 45,     // repasser à cette distance reprend sa réserve
      recallChannel: 1.5,  // concentration avant le retour
      recallCooldown: 60,
    },

    // Colosses : leur marche sur tes villages (pendant le jeu seulement, voir colossus.js) et leurs rôles une fois
    // apaisés (voir allies.js).
    colossi: {
      scale: 1.4,          // taille de tous les colosses (sur celle de leur catalogue)…
      sealScale: 2,        // …et solidité de leurs sceaux
      marchFirst: 420,     // secondes de jeu avant la première marche…
      marchEvery: 600,     // …puis entre deux marches
      marchStay: 45,       // secondes passées à piétiner le village
      marchRange: 14000,   // il ne marche que sur un village à cette distance…
      marchArmy: 4,        // …et seulement si tu as au moins cette armée
      footStructure: 60,   // un pas sur un bâtiment (le double pour une patte abattue exprès)
      stompEvery: 3,       // en marche sur un village, il abat une patte toutes les 3 s
      guardStagger: 60,    // jauge remplie par seconde par le Veilleur qui affronte un colosse en marche
      weave: 45,           // longueur de route tissée par seconde par la Tisseuse
      carry: 3,            // le Léviathan porte une expédition trois fois plus vite
      // Les colosses disputés (voir corruption.js).
      corruptRange: 7000,  // en guerre ouverte, une base mûre ronge les colosses apaisés à cette distance…
      corruptLevel: 4,     // …dès ce niveau…
      corruptTime: 900,    // …une base, guerre au plus fort, le corrompt en 15 min (deux, deux fois plus vite)
      purify: 0.35,        // une pulsation qui le touche efface cette part de ce qui est rongé
      corruptWarn: 0.5,    // tu es prévenu quand la moitié est rongée
    },

    // Engins de siège bâtis par des sapeurs (voir engines.js).
    engines: {
      max: 8,
      sappers: 2,          // bâtisseurs qui partent en sapeurs
      buildTime: 50,       // secondes de chantier sur place
      cost: { baliste: 15000, chaine: 9000 },
      footDamage: 40,      // un pas de colosse sur un engin
      quakeDamage: 60,     // un séisme qui le traverse
      ballista: { range: 1500, reload: 3.5, stagger: 90, nestDamage: 45 },
      // Chaîne : portée, vitesse du colosse retenu, jauge remplie par seconde, usure par seconde (vie 30),
      // et vitesse à laquelle passe sa mise à genou.
      chain: { range: 450, slow: 0.35, stagger: 30, wear: 1, kneel: 0.5 },
    },

    // Nids d'ombre (voir nests.js).
    nests: {
      firstAfter: 2,              // un nid naît quand tu as fondé ce nombre de villages…
      firstDelay: 120,            // …un peu après…
      every: 900,                 // …puis un autre toutes les 15 min de jeu
      answer: 180,                // une base abattue près de tes villages : les ombres en lèvent une autre 3 min plus tard
      max: 6,                     // nids près de tes villages, au plus
      spawnDistance: [2600, 3800], // distance au village choisi
      farChance: 0.35,            // part des régions dangereuses lointaines qui abritent un nid…
      farFrom: 7000,              // …au-delà de cette distance de l'origine
      levelEvery: 300,            // un niveau de plus toutes les 5 min (jusqu'à maxLevel)
      maxLevel: 8,
      hp: 500,
      hpPerLevel: 250,
      regen: 4,                   // points de vie regagnés par seconde
      darkening: 1.5,             // le noir gagne ses nuances une fois et demie plus vite que le blanc
      income: 0.8,                // noirceur gagnée par seconde et par niveau : le budget du gouverneur d'une base…
      fundsHold: 600,             // …qui en garde au plus 10 min…
      think: 2,                   // …et réfléchit toutes les 2 s
      price: {                    // ce que coûtent ses gestes, en noirceur
        fosse: 180, fleche: 140, rempart: 260, loup: 60, scolopendre: 200, outpost: 500,
        raid: 22,                 // un assaut : par point de poids de ses ombres
        prowl: 30,                // des rôdeuses (un avant-poste, pendant la tension)
      },
      wallLevels: [4, 7],         // niveaux où elle se ceint d'un rempart d'ombre (un de plus à chacun)
      wallWork: 4,                // travail par seconde sur son rempart (elle le monte seule)
      workEchoes: 12,             // échos rendus par un ouvrage abattu
      outpostLevel: 3,            // une base essaime dès ce niveau…
      outpostEvery: 600,          // …au plus un avant-poste toutes les 10 min (plus vite quand la guerre est rude), payé par son gouverneur…
      outpostsPer: 2,             // …au plus deux vivants par base…
      outpostRange: 6000,         // …et seulement si l'un de tes villages est à cette distance (les bases lointaines restent chez elles)
      outpostDistance: [1400, 2600], // à cette distance de sa base, vers ton village le plus proche…
      outpostGap: 900,            // …et au moins à cette distance du bord de tes villages
      outpostSize: 0.6,           // un avant-poste est plus petit…
      outpostMaxLevel: 5,         // …et ne dépasse pas ce niveau
      radius: 260,                // rayon de l'obscurité au niveau 1…
      radiusPerLevel: 60,         // …et à chaque niveau
      raidEvery: 140,
      raidJitter: 30,
      raidRange: 7000,
      raidBase: 2,
      raidPerLevel: 1.2,
      reliefRange: 9000,          // une base assiégée appelle ses voisines à cette distance…
      reliefEvery: 45,            // …qui frappent le village assiégeant toutes les 45 s (plus souvent en guerre rude)…
      reliefScale: 0.6,           // …d'une vague plus petite qu'un raid
      campaignLevel: 6,           // en guerre rude, une base de ce niveau peut mener campagne…
      campaignScale: 3,           // …une vague triple, contre ton village le plus faible…
      campaignEvery: 420,         // …au plus toutes les 7 min
      drain: 3,                   // vitalité perdue par seconde dans l'obscurité (hors de tes territoires)
      darkField: 0.2,             // le vide y fait naître si peu de particules
      siegeRange: 9000,           // l'armée assiège un nid jusqu'à cette distance de son village
      defenders: 3,               // attaqué, un nid fait jaillir ce nombre d'ombres (+ son niveau)…
      defendEvery: 6,             // …toutes les 6 s au plus
      echoes: 60,                 // échos rendus par un nid détruit…
      echoesPerLevel: 30,         // …et par niveau
      clearing: 1.3,              // une région libérée fait naître plus de lumière
    },

    // Renaissance : souvenirs = ⌊√(lumière récoltée depuis la dernière renaissance / unit)⌋.
    renaissance: {
      threshold: 4e6,    // lumière à récolter (depuis la dernière renaissance) pour pouvoir renaître
      unit: 4e5,         // 4 M de lumière → 3 souvenirs ; 100 M → 15
    },

    // Le jardin : la lumière qui naît dans le territoire, récoltée par les lueurs.
    garden: {
      density: 0.00015,  // particules par unité² de territoire
      max: 300,
      refillTime: 8,
      foyerGap: 45,      // pas de particule collée au cœur du village…
      reach: 650,        // …mais toujours à cette distance d'un foyer (cœur, ancien cœur, relais)
      rareChance: 0.03,
    },

    // Êtres de lumière.
    colony: {
      cap: 6,            // population maximale de départ (logements : nids)
      armyCap: 3,        // armée maximale de départ d'un village (casernes)
      depositRadius: 16, // distance au cœur (ou au relais) pour déposer une charge
      pickRadius: 7,     // distance pour ramasser une particule
      separation: 14,    // les êtres s'écartent un peu les uns des autres
      rateMemory: 30,    // secondes de lissage du rendement mesuré (sert pendant l'absence)
      feedWork: 1,       // travail apporté à un chantier par unité de lumière livrée par une lueur
      danceRange: 45,    // deux êtres oisifs plus proches que ça peuvent danser ensemble
      danceTime: 3,
      repairRate: 6,     // points de structure réparés par seconde de bâtisseur
      regenDelay: 5,     // secondes sans blessure avant de se régénérer
      regen: 2,          // points de vie régénérés par seconde
      downTime: 20,      // secondes avant qu'un être vaincu se rallume au cœur de son village
    },

    // Combat : vitalité de la lumière, pulsation offensive, projectiles.
    combat: {
      vitality: 100,
      regenDelay: 4,         // secondes sans blessure avant de régénérer
      regen: 15,             // vitalité regagnée par seconde (×3 dans le territoire)
      insideRegen: 3,
      invulnerable: 3,       // secondes d'invulnérabilité après avoir été dispersé
      dispersalLoss: 0.1,    // fraction de la lumière perdue quand on est dispersé
      pulseDamage: 15,
      knockback: 180,
      projectileSpeed: 380,
      projectileLife: 1.2,
      projectileHit: 12,     // distance de touche d'un projectile
      foyerDrain: 1,         // lumière dévorée par point de dégât infligé au cœur d'un village
    },

    // Ombres : marées qui visent le territoire, rôdeuses du vide lointain.
    shadows: {
      taunt: 240,          // un porte-bouclier attire les ombres à cette distance
      firstTideRadius: 160,  // les marées commencent quand le territoire atteint ce rayon
      tideInterval: 110,
      tideJitter: 25,
      tideDistance: 520,     // distance au bord du territoire où naît une marée
      tideSpread: 90,
      tideBase: 1.5,         // « budget » d'une marée : base + par marée passée + par rayon
      tidePerWave: 0.7,
      tidePerRadius: 1 / 180,
      territoryBurn: 2,      // la lumière du territoire ronge les ombres qui y entrent (pv par seconde)
      sense: 380,            // distance à laquelle une ombre repère une proie
      max: 90,
      despawn: 2600,         // une ombre trop loin du joueur et des villages se dissipe
      roamBeyond: 300,       // au-delà du bord du territoire + cette distance, la zone fait errer ses ombres
      roamRate: 1 / 18,      // apparitions par seconde (multipliées par la dangerosité de la zone)
      roamMax: 5,
    },
  };
})(globalThis.Vide);

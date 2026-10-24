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
      whiteTime: 300,        // secondes pour qu'une cellule blanchisse entièrement
      whiteReach: 0.6,       // le blanc reste dans cette fraction du rayon
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
      trainEvery: 45,        // un bastion forme un gardien toutes les 45 s (s'il peut le payer)
      soldierPrice: 0.6,     // part du prix d'un gardien payée par le village qui le reçoit
    },

    // Cités : un village devenu immense peut ajouter une spécialité (les villages qui se touchent fusionnent).
    cities: {
      radius: 700,       // rayon à partir duquel un village peut se spécialiser davantage
      cost: 5e6,         // prix de la première spécialité ajoutée…
      growth: 8,         // …×8 pour chacune des suivantes
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
      foyerGap: 45,      // pas de particule collée au cœur du village
      rareChance: 0.03,
    },

    // Êtres de lumière.
    colony: {
      cap: 6,            // population maximale de départ
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

// Écran « pendant ton absence… » et petits messages (toasts) au bas de l'écran.
(function (Vide) {
  'use strict';
  const { util } = Vide;
  const $ = (id) => document.getElementById(id);

  function formatDuration(seconds) {
    const s = Math.round(seconds);
    if (s < 60) return `${s} s`;
    const minutes = Math.floor(s / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  // --- Absence ---

  const away = { open: false };

  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

  // La guerre pendant l'absence (voir absence.js) : ce qui s'est gagné et perdu.
  function battle(b) {
    if (!b) return [];
    const lines = [];
    if (b.taken.light || b.taken.shadow) {
      lines.push(`La guerre a continué. Sur les fronts, la lumière a repris ${plural(b.taken.light, 'parcelle', 'parcelles')}, `
        + `les ombres en ont pris ${b.taken.shadow}.`);
    }
    if (b.lost.length) {
      lines.push(`Perdu aux ombres : ${b.lost.map((t) => Vide.Structures.def(t).name.toLowerCase()).join(', ')}.`);
    }
    if (b.raids.repelled) lines.push(`${plural(b.raids.repelled, 'assaut repoussé', 'assauts repoussés')}.`);
    if (b.raids.broken) {
      lines.push(`${plural(b.raids.broken, 'assaut a', 'assauts ont')} éteint ${plural(b.broken.length, 'bâtiment', 'bâtiments')} : `
        + 'tes bâtisseurs les relèveront.');
    }
    for (const t of b.fallen) lines.push(`La campagne ${of(t)} a abattu sa base d’ombre.`);
    for (const t of b.retreats) lines.push(`L’armée ${of(t)}, trop amenuisée, est rentrée de campagne.`);
    for (const id of b.corrupted) lines.push(`Les ombres ont pris ${named(id)} : reprends-le, sceau après sceau.`);
    if (b.echoes > 0) lines.push(`La guerre t’a laissé ◆ ${util.formatNumber(b.echoes)}.`);
    return lines;
  }

  function show(report) {
    const lines = [];
    if (report.radiusAfter > report.radiusBefore) {
      const growth = `rayon ${Math.round(report.radiusBefore)} → ${Math.round(report.radiusAfter)}`;
      lines.push(report.villages > 1
        ? `Tes ${report.villages} villages se sont étendus (le plus grand : ${growth}).`
        : `Ton village s’est étendu : ${growth}.`);
    }
    if (report.radiated > 0) lines.push(`Les territoires ont rayonné ✦ ${util.formatNumber(report.radiated)} de lumière.`);
    if (report.brought > 0) lines.push(`Tes êtres ont rapporté ✦ ${util.formatNumber(report.brought)} au cœur des villages.`);
    if (report.cities) lines.push(`Des villages se sont rejoints : ${report.cities > 1 ? report.cities + ' cités sont nées' : 'une cité est née'}.`);
    if (report.beacon > 0) lines.push(`Ton fanal a gardé ✦ ${util.formatNumber(report.beacon)} pour toi.`);
    for (const e of report.expeditions || []) {
      if (e.type === 'settled') lines.push(`Des colons ont fondé ${to(e.village)}.`);
      if (e.type === 'scouted') lines.push('Des éclaireurs ont exploré au loin.');
      if (e.type === 'engineBuilt') lines.push(`Des sapeurs ont achevé ${e.engine === 'chaine' ? 'une chaîne' : 'une baliste'}.`);
      if (e.type === 'studied') lines.push(`Les érudits ont dévoilé un sceau ${ofNamed(e.id)} (${e.revealed}/${e.total}).`);
    }
    if (report.war) lines.push('Un avant-poste d’ombre s’est dressé : la guerre a commencé.');
    else if (report.outposts) lines.push(`${report.outposts} avant-poste${report.outposts > 1 ? 's' : ''} d’ombre de plus.`);
    lines.push(...battle(report.battle));
    if (report.walls) lines.push(`${report.walls} enceinte${report.walls > 1 ? 's' : ''} achevée${report.walls > 1 ? 's' : ''}.`);
    if (report.roads) lines.push(`${report.roads} route${report.roads > 1 ? 's' : ''} achevée${report.roads > 1 ? 's' : ''}.`);
    if (report.built.length) {
      const names = report.built.map((type) => Vide.Structures.def(type).name.toLowerCase());
      lines.push(`Les bâtisseurs ont achevé : ${names.join(', ')}.`);
    }
    if (report.kept > 0) {
      const beings = report.steward.filter((w) => w.kind === 'being').length;
      const plans = report.steward.length - beings;
      const deeds = [beings ? `éveillé ${beings} être${beings > 1 ? 's' : ''}` : '',
        plans ? `planifié ${plans} bâtiment${plans > 1 ? 's' : ''}` : ''].filter(Boolean);
      lines.push(`Tes gouverneurs ont mis de côté ✦ ${util.formatNumber(report.kept)}`
        + (deeds.length ? ` et ont ${deeds.join(' et ')}.` : '.'));
    }
    if (report.capped) {
      lines.push(`Le territoire ne se souvient que de ${formatDuration(report.applied)} (amélioration Mémoire).`);
    }

    $('away-duration').textContent = formatDuration(report.seconds);
    const list = $('away-lines');
    list.textContent = '';
    for (const text of lines) {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    }
    $('away').hidden = false;
    away.open = true;
  }

  function close() {
    $('away').hidden = true;
    away.open = false;
  }

  // --- Messages ---

  const MESSAGES = {
    village: (e) => (e.first
      ? `${Vide.Villages.type(e.village).name} : ton premier village naît. Son territoire grandira, même sans toi.`
      : `Un nouveau village naît : ${Vide.Villages.type(e.village).name}.`),
    birth: (e) => (e.first ? FIRST_BIRTH[e.species] : null),
    built: (e) => `${Vide.Structures.def(e.building).name} achevé.`,
    tide: (e) => (e.first
      ? 'Une marée d’ombres approche, attirée par ton territoire. Ta pulsation peut les blesser.'
      : `Une marée d’ombres approche (${e.count}).`),
    shadowDown: (e) => (e.first ? 'Une ombre se dissipe et laisse un écho ◆. Les échos éveillent une armée.' : null),
    dispersed: (e) => `Ta lumière se disperse… et renaît ${e.village ? 'au village le plus proche' : 'à l’origine'}. `
      + `✦ ${util.formatNumber(e.lost)} perdue.`,
    steward: (e) => {
      // Ses gestes d'ambition, toujours annoncés.
      const who = `Le gouverneur ${of(e.village)}`;
      if (e.kind === 'colons') return `${who} envoie des colons fonder un village.`;
      if (e.kind === 'city') return `${who} en fait une cité.`;
      if (e.kind === 'road') return `${who} lance une route vers le village le plus proche.`;
      if (e.kind === 'campaign') return `${who} mène son armée contre une base d’ombre.`;
      if (seen.steward) return null;
      seen.steward = true;
      return `${who} agit seul (${Vide.Steward.label(e)}). Il dépense la part de lumière que tu lui confies.`;
    },
    campaignEnd: (e) => (e.recalled ? `L’armée ${of(e.village)} rentre : tu as rappelé sa campagne.`
      : e.won ? `La campagne ${of(e.village)} a abattu sa base d’ombre.`
        : `L’armée ${of(e.village)}, trop amenuisée, rentre de campagne.`),
    campaignOrder: (e) => `L’armée ${of(e.village)} part en campagne.`,
    caravanOut: (e) => {
      if (seen.caravan) return null;
      seen.caravan = true;
      const what = { matiere: 'de la matière ◇ (ses chantiers iront plus vite)',
        savoir: 'du savoir ✎ (son territoire grandira plus vite)', soldat: 'un soldat, contre de la lumière' }[e.kind];
      return `Une caravane part ${of(e.from)} vers ${to(e.to)} : ${what}.`;
    },
    trained: (e) => (seen.trained ? null : (seen.trained = true,
      'Le bastion forme un soldat avec la réserve de son intendant. En trop, ses soldats iront aux villages reliés.')),
    city: (e) => `Deux villages se rejoignent : une cité naît (${e.types.map((t) => Vide.Villages.type(t).name).join(' · ')}). `
      + 'Elle garde leurs spécialités.',
    expedition: (e) => {
      if (e.kind === 'colons') return `Des colons partent fonder ${to(e.type)} au loin. Les ombres pourraient les attaquer en chemin.`;
      if (e.kind === 'scholars') return `Des érudits partent étudier ${named(e.colossus)} depuis un abri.`;
      if (e.kind === 'sappers') return `Des sapeurs partent bâtir ${e.engine === 'chaine' ? 'une chaîne' : 'une baliste'} au loin.`;
      return 'Des éclaireurs partent explorer au loin.';
    },
    studying: (e) => `Les érudits ont trouvé leur abri. Ils observent ${named(e.id)}.`,
    studied: (e) => (e.revealed < e.total
      ? `Les érudits ont percé un voile : un sceau ${ofNamed(e.id)} se dévoile (${e.revealed}/${e.total}).`
      : `Tous les sceaux ${ofNamed(e.id)} sont dévoilés. Les érudits rentrent.`),
    scouted: (e) => (e.zones.length
      ? `Les éclaireurs ont trouvé : ${e.zones.map((z) => Vide.Zones.get(z).name).join(', ')}. Ils rentrent.`
      : 'Les éclaireurs ont exploré au loin (voir la carte). Ils rentrent.'),
    returned: (e) => `Les ${{ scholars: 'érudits', sappers: 'sapeurs' }[e.kind] || 'éclaireurs'} sont rentrés au village.`,
    siteStarted: (e) => `Les sapeurs arrivent : le chantier ${e.engine === 'chaine' ? 'de la chaîne' : 'de la baliste'} commence.`,
    engineBuilt: (e) => (e.engine === 'chaine'
      ? 'La chaîne est ancrée : un colosse qui passera à sa portée sera entravé.'
      : 'La baliste est dressée : elle tirera sur un colosse qui passera à sa portée (ou sur une base d’ombre).'),
    siteLost: () => 'Le chantier a été écrasé. Les sapeurs rentrent.',
    engineLost: (e) => (e.reason === 'snapped'
      ? 'La chaîne cède sous l’effort.'
      : `${e.kind === 'chaine' ? 'Une chaîne' : 'Une baliste'} est écrasée par le colosse.`),
    chained: (e) => `Les chaînes se tendent et retiennent ${named(e.id)} !`,
    settled: (e) => `Les colons arrivent et fondent ${to(e.village)}.`,
    colonsJoined: (e) => `La place était prise : les colons rejoignent ${to(e.village)} le plus proche.`,
    expeditionLost: (e) => `Les ombres ont dévoré une expédition (${{ colons: 'colons', scholars: 'érudits', sappers: 'sapeurs' }[e.kind] || 'éclaireurs'}).`,
    beacon: () => (seen.beacon ? null : (seen.beacon = true,
      'Ton fanal brille : il récoltera seul la lumière alentour, même en ton absence. Repasse la reprendre.')),
    beaconCollected: (e) => `Le fanal te rend ✦ ${util.formatNumber(e.light)}.`,
    nest: (e) => (e.first
      ? (e.far
        ? 'Une base d’ombre, ici, au loin : les ombres bâtissent aussi. Sa noirceur épuise ta lumière.'
        : 'Les ombres bâtissent aussi : une base d’ombre est née non loin de tes villages. Elle grandira, se fortifiera, lancera des raids.')
      : (e.far ? 'Une base d’ombre, dans cette région.' : 'Une nouvelle base d’ombre est née.'))
      + ' Ton armée peut l’assiéger (B).',
    nestDestroyed: (e) => (e.first
      ? `La base s’effondre. ◆ ${util.formatNumber(e.echoes)}. Sa région est libérée : le vide y fait naître plus de lumière.`
      : `Une base d’ombre s’effondre. ◆ ${util.formatNumber(e.echoes)}.`)
      + (e.village ? ` Son terrain rejoint ${to(e.village)} : il blanchira.` : ''),
    raid: (e) => (e.kind === 'relief'
      ? `Des ombres volent au secours de leur base assiégée : elles frappent ${to(e.village)}, dont l’armée est au loin (${e.count}).`
      : e.kind === 'campaign'
        ? `Une base d’ombre mène campagne contre ${to(e.village)}, ton village le plus faible (${e.count}) !`
        : `Un raid d’ombres part d’une base vers ${to(e.village)} (${e.count}).`),
    outpost: (e) => (e.first
      ? 'Un avant-poste d’ombre se dresse sur le chemin de tes villages.'
      : 'Un nouvel avant-poste d’ombre se dresse.'),
    war: () => 'La guerre commence. Douce, d’abord : des ombres viendront rôder autour de tes villages. Elle ne le restera pas.',
    prowl: (e) => `Des ombres rôdent autour ${of(e.village)}, sans attaquer… pour l’instant.`,
    nestBuilt: (e) => (e.kind === 'rempart' ? 'Une base d’ombre se ceint d’un rempart : il arrête la lumière. Ton armée devra l’abattre.' : null),
    workDown: (e) => `${Vide.darkWork(e.kind).name} d’ombre abattue. ◆ ${util.formatNumber(e.echoes)}.`,
    darkBreach: () => 'Une brèche dans le rempart d’ombre.',
    front: (e) => (e.side === 'light'
      ? `Le front avance : la noirceur recule devant ${to(e.village)}.`
      : `Le front recule : la noirceur mord sur le territoire ${of(e.village)}.`),
    structureLost: (e) => `Les ombres s’emparent d’un bâtiment ${of(e.village)} : ${Vide.Structures.def(e.kind).name.toLowerCase()}.`,
    convoyLost: (e) => (e.kind === 'soldat'
      ? `Un convoi de soldats tombe sous les ombres, entre ${to(e.from)} et ${to(e.to)}.`
      : `Un convoi tombe sous les ombres, entre ${to(e.from)} et ${to(e.to)} : sa charge est perdue.`),
    converted: (e) => {
      const k = Vide.Creatures.kind(e.kind);
      const [un, ee] = k.plural ? ['Des', k.fem ? 'es' : 's'] : k.fem ? ['Une', 'e'] : ['Un', ''];
      const joins = k.plural ? 'rejoignent' : 'rejoint';
      const f = Vide.Factions.def(e.faction);
      const what = e.faction === 'illumines' ? 'purifié' : e.faction === 'corrupteurs' ? 'corrompu' : 'apprivoisé';
      const name = k.name.charAt(0).toLowerCase() + k.name.slice(1);
      if (e.to === 'light') return `${un} ${name} ${what}${ee} par les ${f.name} ${joins} ${to(e.owner)}.`;
      if (e.from === 'wild') return `${un} ${name}, ${what}${ee} par les ${f.name}, ${joins} une base d’ombre.`;
      return `${un} ${name} de lumière, ${what}${ee} par les ${f.name}, passe${k.plural ? 'nt' : ''} à l’ombre.`;
    },
    creatureDown: (e) => {
      if (e.side !== 'shadow' || !e.echoes) return null;
      const k = Vide.Creatures.kind(e.kind);
      return `${k.fem ? 'Une' : 'Un'} ${k.name.toLowerCase()} d’ombre abattu${k.fem ? 'e' : ''}. ◆ ${util.formatNumber(e.echoes)}.`;
    },
    road: (e) => {
      const [a, b] = [e.a, e.b].map((t) => Vide.Villages.type(t).name);
      if (e.woven) return `La Tisseuse achève la route ${a} — ${b}.`;
      return e.first
        ? `Une route relie ${a} et ${b}. Ta lumière y file plus vite ; bientôt, les caravanes y passeront.`
        : `Route achevée : ${a} — ${b}.`;
    },
    heartAttacked: (e) => `Des ombres rongent le cœur d’un village (${Vide.Villages.type(e.village).name}) !`,
    broken: (e) => `${Vide.Structures.def(e.building).name} s’éteint sous les ombres. Les bâtisseurs le répareront.`,
    repaired: (e) => `${Vide.Structures.def(e.building).name} brille de nouveau.`,
    wallDone: (e) => (e.layers > 1
      ? `Une enceinte de plus autour ${of(e.village)}.`
      : `${Vide.Villages.type(e.village).name} a son enceinte : ses portes ne s’ouvrent qu’à la lumière.`),
    breach: (e) => `Une brèche dans l’enceinte ${of(e.village)} : les ombres entrent.`,
    wallRepaired: (e) => `L’enceinte ${of(e.village)} est relevée.`,
    heartbeat: (e) => Vide.Colossus.def(e.id).heartbeat,
    colossusFound: (e) => (e.sleeper
      ? 'Il dort. Ses rêves sont ses sceaux : monte sur son dos pour les apaiser.'
        + (e.veiled ? ' Ils sont voilés : tes érudits doivent d’abord les étudier.' : '')
      : e.veiled
      ? 'Ses sceaux sont voilés : ta pulsation n’y peut rien. Envoie des érudits l’étudier (carte, M). Ton armée peut déjà le faire plier.'
      : 'Brise ses sceaux avec ta pulsation. Ton armée peut le faire plier.'),
    sealBroken: (e) => (e.left ? `Un sceau se brise. Encore ${e.left}.` : null),
    veiled: (e) => (seen['veiled' + e.id] ? null : (seen['veiled' + e.id] = true,
      'Ce sceau est voilé : ton onde glisse dessus. Tes érudits doivent d’abord l’étudier.')),
    phase: (e) => (e.veiled
      ? 'Il se redresse en rugissant, plus furieux. Le sceau suivant est encore voilé.'
      : 'Il se redresse en rugissant : plus vif, et une attaque de plus. Glisse-toi dans les brèches de l’onde.'),
    kneel: (e) => {
      const d = Vide.Colossus.def(e.id);
      return `${d.name} ${d.kneelText} ! Ses sceaux sont vulnérables.`;
    },
    web: () => (seen.web ? null : (seen.web = true, 'Une toile ! Elle ralentit tout ce qui s’y prend. Sors-en vite.')),
    colossusTamed: (e) => {
      const d = Vide.Colossus.def(e.id);
      return d.stays ? `${d.name} s’éveille, sans bouger. ${d.reward.text}` : `${d.name} s’apaise et rejoint tes villages. ${d.reward.text}`;
    },
    renaissance: 'Tu te dissous… et renais. Tes souvenirs t’attendent dans l’onglet souvenirs.',
    loreBatch: (e) => `Ton journal s’est rempli de ${e.count} fragments du récit (menu ≡).`,
    aloft: (e) => (seen.aloft ? null : (seen.aloft = true,
      'Il vole trop haut : ta pulsation ne l’atteint pas. Cloue-le au sol (chaînes, balistes, harpons, étincelles), '
      + 'ou guette ses posés.')),
    asleep: () => (seen.asleep ? null : (seen.asleep = true,
      'Ses rêves sont sur son dos : tiens-toi sur lui pour les atteindre.')),
    nightmare: (e) => `Un rêve s’apaise… et ses cauchemars s’éveillent (${e.count}) ! Encore ${e.left}.`,
    shielded: () => (seen.shielded ? null : (seen.shielded = true,
      'Ses éclats protègent son noyau : disperse-les d’une onde, ou laisse ton armée les dévorer, puis frappe.')),
    closed: (e) => (seen.closed ? null : (seen.closed = true,
      'Sa cloche est refermée : ses sceaux ne s’ouvrent qu’au sommet de chaque pulsation. Frappe au bon moment.')),
    landed: () => 'L’Oiseau d’aube se pose… vite, ses sceaux sont à portée !',
    gale: () => (seen.gale ? null : (seen.gale = true, 'Une rafale ! Elle repousse tout ce qui se tient devant lui.')),
    sighted: (e) => `L’Oiseau d’aube a aperçu au loin : ${e.zones.map((z) => Vide.Zones.get(z).name).join(', ')}.`,
    march: (e) => (e.corrupted
      ? `Le sol tremble : ${named(e.id)} se retourne contre ${to(e.village)} !`
      : `Le sol tremble : ${named(e.id)} quitte son repaire et marche sur ${to(e.village)} !`),
    corrupting: (e) => `Les ombres rongent ${named(e.id)} : ta pulsation, si elle l’atteint, les chasse.`,
    purified: (e) => `Ta pulsation chasse les ombres ${ofNamed(e.id)}.`,
    colossusCorrupted: (e) => `Les ombres ont pris ${named(e.id)} : son rôle et son bienfait sont perdus. Reprends-le, sceau après sceau.`,
    colossusRetaken: (e) => `Tu reprends ${named(e.id)} aux ombres. ${Vide.Colossus.def(e.id).reward.text}`,
    rampage: (e) => `${Vide.Colossus.def(e.id).name} piétine ${to(e.village)} ! Provoque-le, ou fais-le plier, pour le détourner.`,
    colossusLeaves: (e) => `${Vide.Colossus.def(e.id).name} s’en retourne à son repaire.`,
    guardClash: (e) => `Le Veilleur se dresse contre ${named(e.id)} !`,
    carried: (e) => `Le Léviathan emporte tes ${{ colons: 'colons', scholars: 'érudits', sappers: 'sapeurs' }[e.kind] || 'éclaireurs'} sur son dos.`,
    colossusLost: (e) => `${Vide.Colossus.def(e.id).name} se détourne et retourne à son repaire.`,
    beingDown: () => (seen.beingDown ? null : (seen.beingDown = true, 'Un être s’éteint… il se rallumera au cœur de son village.')),
    // Les danses sont fréquentes : on n'en parle qu'une fois par session.
    dance: () => (seen.dance ? null : (seen.dance = true, 'Deux êtres se croisent… et dansent un instant ensemble.')),
  };

  const seen = {};

  // « de l'atelier », « des jardins », « vers le bastion »…
  const article = (t, de) => {
    const name = Vide.Villages.type(t).name.toLowerCase();
    if (name.endsWith('s')) return (de ? 'des ' : 'les ') + name;
    if (/^[aeiouéèh]/.test(name)) return (de ? 'de l’' : 'l’') + name;
    return (de ? 'du ' : 'le ') + name;
  };
  const of = (t) => article(t, true);
  const to = (t) => article(t, false);
  // « le Veilleur », « du Veilleur », « de la Tisseuse ».
  const named = (id) => Vide.Colossus.def(id).name.replace(/^L/, 'l');
  const ofNamed = (id) => Vide.Colossus.def(id).name.replace(/^Le /, 'du ').replace(/^La /, 'de la ').replace(/^L’/, 'de l’');

  // Message à la naissance du premier être de chaque espèce.
  const FIRST_BIRTH = {
    lueur: 'Une lueur s’éveille. Elle récoltera le jardin de son village pour toi.',
    batisseur: 'Un bâtisseur s’éveille. Planifie un bâtiment : il choisira où le construire.',
    gardien: 'Un gardien s’éveille. Donne des ordres à l’armée : garder, escorter, chasser.',
    etincelle: 'Une étincelle s’éveille. Elle frappe les ombres de loin.',
    veilleuse: 'Une veilleuse s’éveille. Elle soignera les êtres et ta lumière.',
    harponneur: 'Un harponneur s’éveille. Ses harpons sont faits pour les colosses et les cœurs des nids (ordre : siège).',
  };

  const toast = { queue: [], current: null, until: 0 };

  // Historique des derniers messages (utile aux tests et au débogage).
  const history = [];

  function notify(text, kind) {
    if (!text) return;
    toast.queue.push({ text, kind: kind || '' });
    // La file ne doit jamais déborder : les plus anciens messages ordinaires cèdent la place.
    if (toast.queue.length > 8) {
      const i = toast.queue.findIndex((m) => m.kind !== 'lore');
      toast.queue.splice(i >= 0 ? i : 0, 1);
    }
    history.push(text);
    if (history.length > 30) history.shift();
  }

  // Traduit les événements de la simulation en messages.
  // Bannière : un nom en grand (zone, colosse) et une ligne en dessous.
  function showTitle(name, sub, tint) {
    const el = $('zone-banner');
    $('zone-name').textContent = name;
    $('zone-desc').textContent = sub;
    el.style.setProperty('--zone', `rgb(${tint.join(',')})`);
    el.classList.remove('shown');
    void el.offsetWidth;
    el.classList.add('shown');
  }

  // Bannière de zone : son nom, et sa description à la première découverte.
  function showZone(id, discovered) {
    const zone = Vide.Zones.get(id);
    showTitle(zone.name, discovered ? zone.desc : '', zone.tint);
  }

  function readEvents(game) {
    const discovered = new Set(game.events.filter((e) => e.type === 'zoneDiscovered').map((e) => e.zone));
    for (const e of game.events) {
      if (e.type === 'zoneEnter') showZone(e.zone, discovered.has(e.zone));
      if (e.type === 'lore') notify(`« ${Vide.Lore.get(e.id).text} »`, 'lore');
      if (e.type === 'renaissance') showTitle('Renaissance', `${e.count}ᵉ vie · ${util.formatNumber(e.memories)} souvenirs ✧`, [255, 226, 160]);
      if (e.type === 'colossusFound') {
        const d = Vide.Colossus.def(e.id);
        showTitle(d.name, d.epithet, [255, 226, 160]);
      }
      const text = typeof MESSAGES[e.type] === 'function' ? MESSAGES[e.type](e) : MESSAGES[e.type];
      notify(text);
    }
    game.events.length = 0;
  }

  function updateToast(now) {
    const el = $('toast');
    if (toast.current && now < toast.until) return;
    if (toast.current) {
      toast.current = null;
      el.classList.remove('shown');
      toast.until = now + 600; // laisse le temps au fondu de sortie
      return;
    }
    if (now < toast.until || !toast.queue.length) return;
    toast.current = toast.queue.shift();
    el.textContent = toast.current.text;
    el.className = toast.current.kind;
    el.classList.add('shown');
    toast.until = now + 3500 + toast.current.text.length * (toast.current.kind === 'lore' ? 60 : 40);
  }

  function init() {
    $('away-close').addEventListener('click', close);
  }

  away.init = init;
  away.show = show;
  away.close = close;
  away.notify = notify;
  away.readEvents = readEvents;
  away.updateToast = updateToast;
  away.formatDuration = formatDuration;
  away.history = history;
  Vide.Away = away;
})(globalThis.Vide);

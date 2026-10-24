// Récit discret : de courts fragments qui se révèlent au fil de la progression, et restent dans le journal.
// Ajouter un fragment = ajouter une entrée (id stable : il est stocké dans les sauvegardes).
(function (Vide) {
  'use strict';

  const zone = (id) => (state) => state.zones.discovered.includes(id);
  const builtAny = (state) => Vide.Structures.all(state).some((b) => Vide.Structures.isDone(b));

  Vide.LORE = [
    { id: 'eveil', when: (s) => s.totalLight >= 1,
      text: 'Au commencement, il n’y avait que le vide. Puis une lueur. Toi.' },
    { id: 'souvenirs', when: (s) => s.totalLight >= 200,
      text: 'Ces particules ne sont pas de la poussière. Ce sont des souvenirs de lumière, éparpillés.' },
    { id: 'foyer', when: (s) => s.villages.length > 0,
      text: 'Le cœur d’un village se souvient d’un temps où le vide était plein.' },
    { id: 'lueur', when: (s) => Vide.Villages.count(s, 'lueur') > 0,
      text: 'Ce que tu éveilles n’est pas toi. Mais cela vient de toi.' },
    { id: 'danse', when: (s) => Vide.Colony.population(s) >= 8,
      text: 'Ils ne parlent pas. Ils dansent. C’est peut-être la même chose.' },
    { id: 'batir', when: builtAny,
      text: 'Bâtir dans le vide, c’est refuser qu’il reste vide.' },
    { id: 'ombre', when: (s) => s.stats.shadows >= 1,
      text: 'Les ombres ne haïssent pas la lumière. Elles ont froid.' },
    { id: 'echo', when: (s) => s.stats.shadows >= 10,
      text: 'Chaque ombre dissipée laisse un écho : ce qu’elle était, avant d’oublier.' },
    { id: 'brume', when: zone('brume'),
      text: 'Dans la brume, on n’avance pas. On écoute.' },
    { id: 'courants', when: zone('courants'),
      text: 'Les courants vont quelque part. Personne n’est jamais revenu dire où.' },
    { id: 'murmure', when: zone('murmure'),
      text: 'Le murmure prononce ton nom. Tu n’en avais pas, avant.' },
    { id: 'eclat', when: zone('eclat'),
      text: 'L’Éclat est ce qui reste d’une lumière immense, brisée il y a très longtemps.' },
    { id: 'gouffre', when: zone('gouffre'),
      text: 'Au fond du Gouffre, le vide se regarde lui-même.' },
    { id: 'battement', when: (s) => Boolean(s.colossi.veilleur),
      text: 'Ce battement était là avant toi. Il attendait.' },
    { id: 'veilleur', when: (s) => s.colossi.veilleur === 'tamed',
      text: 'Le Veilleur ne gardait pas les confins contre toi. Il les gardait pour toi.' },
    { id: 'fils', when: (s) => s.colossi.tisseuse === 'tamed',
      text: 'La Tisseuse ne tissait pas de pièges. Elle reliait ce qui était seul.' },
    { id: 'profondeurs', when: (s) => Boolean(s.colossi.leviathan),
      text: 'Quelque chose nage sous le vide. Le vide a donc un dessous.' },
    { id: 'leviathan', when: (s) => s.colossi.leviathan === 'tamed',
      text: 'Le Léviathan portait le vide sur son dos. Il te le confie, maintenant.' },
    { id: 'aube', when: (s) => s.colossi.oiseau === 'tamed',
      text: 'L’Oiseau d’aube ne fuyait pas le sol. Il cherchait d’où viendrait le premier matin.' },
    { id: 'cloche', when: (s) => s.colossi.meduse === 'tamed',
      text: 'Chaque pulsation de la Méduse répare un peu le vide. Elle le fait depuis toujours, seule.' },
    { id: 'eclats', when: (s) => s.colossi.nuee === 'tamed',
      text: 'La Nuée était une seule lumière, brisée. Elle se souvient d’avoir été entière.' },
    { id: 'reve', when: (s) => Boolean(s.colossi.dormeur),
      text: 'Quelque chose rêve le vide. Et si toi aussi, tu étais l’un de ses rêves ?' },
    { id: 'dormeur', when: (s) => s.colossi.dormeur === 'tamed',
      text: 'Le Dormeur s’éveille sans bouger. Il te laisse bâtir sur lui, comme on confie un monde.' },
    { id: 'recul', when: (s) => s.villages.some((v) => Vide.Territory.radius(v) >= 600),
      text: 'Le vide recule. Ou peut-être apprend-il à briller.' },
    { id: 'armee', when: (s) => Vide.Combat.armySize(s) >= 6,
      text: 'Tu n’as jamais voulu d’armée. Seulement que personne ne s’éteigne.' },
    { id: 'nid', when: (s) => s.nests.length > 0 || s.cleared.length > 0,
      text: 'Les ombres bâtissent aussi. Elles ont appris en te regardant.' },
    { id: 'clairiere', when: (s) => s.cleared.length > 0,
      text: 'Là où le nid s’est dissipé, le vide se souvient d’avoir été lumière.' },
    { id: 'renaissance', when: (s) => s.renaissances > 0,
      text: 'Se dissoudre n’est pas disparaître. C’est choisir ce que l’on emporte.' },
    { id: 'confins', when: (s) => s.zones.discovered.length >= Vide.ZONES.length,
      text: 'Le vide n’a pas de bord. Seulement des endroits où l’on n’est pas encore allé.' },
  ];

  function get(id) {
    return Vide.LORE.find((f) => f.id === id) || null;
  }

  // Révèle les fragments dont la condition est remplie. Renvoie les nouveaux identifiants.
  function check(state) {
    const found = [];
    for (const f of Vide.LORE) {
      if (state.lore.includes(f.id) || !f.when(state)) continue;
      state.lore.push(f.id);
      found.push(f.id);
    }
    return found;
  }

  Vide.Lore = { get, check };
})(globalThis.Vide);

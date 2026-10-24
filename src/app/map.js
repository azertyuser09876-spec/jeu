// Carte des régions explorées (touche M ou bouton) : zones visitées, territoire, bâtiments, ta lumière.
(function (Vide) {
  'use strict';
  const { Zones, Territory } = Vide;
  const $ = (id) => document.getElementById(id);

  function create(game) {
    const map = {
      game,
      open: false,
      root: $('map'),
      canvas: $('map-canvas'),
      legend: $('map-legend'),
      button: $('map-btn'),
    };
    map.button.addEventListener('click', () => toggle(map));
    $('map-close').addEventListener('click', () => toggle(map, false));
    setupExpeditions(map);
    map.root.addEventListener('click', (e) => {
      if (e.target === map.root) toggle(map, false);
    });
    return map;
  }

  function toggle(map, open) {
    map.open = open === undefined ? !map.open : open;
    map.root.hidden = !map.open;
    if (!map.open) map.target = null;
    $('map-actions').hidden = !map.target;
    if (map.open) draw(map);
  }

  // --- Expéditions : toucher un point de la carte, puis choisir qui y envoyer ---

  function setupExpeditions(map) {
    const colons = $('exp-colons');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'colons :';
    colons.appendChild(label);
    map.colonButtons = Vide.VILLAGE_TYPES.map((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = t.name.toLowerCase();
      btn.addEventListener('click', () => launch(map, 'colons', t.id));
      colons.appendChild(btn);
      return btn;
    });
    // Sapeurs : un bouton par engin de siège.
    const sappers = $('exp-sappers');
    const sapLabel = document.createElement('span');
    sapLabel.className = 'label';
    sapLabel.textContent = 'sapeurs :';
    sappers.appendChild(sapLabel);
    map.engineButtons = Object.values(Vide.Engines.KINDS).map((k) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.engine = k.id;
      btn.addEventListener('click', () => launch(map, 'sappers', null, k.id));
      sappers.appendChild(btn);
      return btn;
    });
    $('exp-scouts').addEventListener('click', () => launch(map, 'scouts'));
    $('exp-scholars').addEventListener('click', () => launch(map, 'scholars'));
    $('exp-escort').addEventListener('change', () => refreshActions(map));
    $('exp-close').addEventListener('click', () => {
      map.target = null;
      $('map-actions').hidden = true;
      draw(map);
    });
    map.canvas.addEventListener('click', (e) => {
      if (!map.view || !map.game.state.villages.length) return;
      const rect = map.canvas.getBoundingClientRect();
      const { ox, oy, scale } = map.view;
      map.target = { x: (e.clientX - rect.left - ox) / scale, y: (e.clientY - rect.top - oy) / scale };
      // Toucher près d'un colosse aux sceaux voilés propose d'y envoyer des érudits.
      map.target.colossus = Vide.Expeditions.studyable(map.game.state, map.target.x, map.target.y, Math.max(1500, 24 / scale));
      $('map-actions').hidden = false;
      refreshActions(map);
      draw(map);
    });
  }

  function refreshActions(map) {
    if (!map.target) return;
    const { state } = map.game;
    const E = Vide.Expeditions;
    const { x, y } = map.target;
    const escort = $('exp-escort').checked;
    const from = Vide.Villages.nearest(state, x, y);
    $('exp-target').textContent = `vers ce point · ${Math.round(Math.hypot(from.x - x, from.y - y))} du village le plus proche`;
    const scoutWhy = E.blocked(state, 'scouts', x, y, escort);
    const scoutFrom = E.origin(state, 'scouts', x, y, escort);
    $('exp-scouts').textContent = `éclaireurs · ✦ ${Vide.util.formatNumber(E.cost(state, 'scouts', x, y, scoutFrom).light)}`;
    $('exp-scouts').disabled = Boolean(scoutWhy);
    const colonWhy = E.blocked(state, 'colons', x, y, escort);
    for (const btn of map.colonButtons) btn.disabled = Boolean(colonWhy);
    const colonCost = Vide.util.formatNumber(E.cost(state, 'colons', x, y).light);
    // Sapeurs : un engin bâti au point touché.
    let sapperWhy = null;
    for (const btn of map.engineButtons) {
      const kind = btn.dataset.engine;
      const why = E.blocked(state, 'sappers', x, y, escort, kind);
      if (!sapperWhy && why && why !== 'pas assez de lumière') sapperWhy = why;
      btn.textContent = `${Vide.Engines.def(kind).name.toLowerCase()} · ✦ ${Vide.util.formatNumber(E.cost(state, 'sappers', x, y, null, kind).light)}`;
      btn.disabled = Boolean(why);
    }
    // Érudits : vers l'abri d'où observer le colosse.
    const id = map.target.colossus;
    const scholars = $('exp-scholars');
    scholars.hidden = !id;
    let scholarWhy = null;
    if (id) {
      const spot = E.studySpot(state, id);
      const d = Vide.Colossus.def(id);
      scholarWhy = E.blocked(state, 'scholars', spot.x, spot.y, escort, id);
      const from = E.origin(state, 'scholars', spot.x, spot.y, escort);
      scholars.textContent = `érudits · ✦ ${Vide.util.formatNumber(E.cost(state, 'scholars', spot.x, spot.y, from).light)}`;
      scholars.disabled = Boolean(scholarWhy);
      $('exp-target').textContent = `${d.name} · sceaux dévoilés ${Vide.Colossus.revealed(state, id)}/${d.seals.length}`;
    }
    $('exp-status').textContent = [
      id && scholarWhy ? `érudits : ${scholarWhy}` : '',
      scoutWhy ? `éclaireurs : ${scoutWhy}` : '',
      sapperWhy ? `sapeurs : ${sapperWhy}` : '',
      colonWhy ? `colons : ${colonWhy}` : `colons : ✦ ${colonCost}, trois lueurs du village`,
    ].filter(Boolean).join(' · ');
  }

  function launch(map, kind, type, engine) {
    let { x, y } = map.target;
    const colossus = kind === 'scholars' ? map.target.colossus : null;
    if (colossus) ({ x, y } = Vide.Expeditions.studySpot(map.game.state, colossus));
    const exp = Vide.Expeditions.launch(map.game.state, kind, x, y, { type, colossus, engine, escort: $('exp-escort').checked });
    if (!exp) return refreshActions(map);
    Vide.Sim.emit(map.game, 'expedition', { kind, type, colossus, engine });
    map.target = null;
    $('map-actions').hidden = true;
    draw(map);
  }

  function rgba(tint, a) {
    return `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${a})`;
  }

  // Peinture des régions : une image basse résolution (un échantillon tous les SAMPLE pixels), couleur de
  // la zone en chaque point, floutée puis agrandie en douceur : frontières fondues, inexploré dans le noir.
  const SAMPLE = 4;

  function blur(buf, gw, gh, passes) {
    const tmp = new Float32Array(buf.length);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          for (let c = 0; c < 4; c++) {
            let sum = 0, n = 0;
            for (let k = -2; k <= 2; k++) {
              const xx = x + k;
              if (xx < 0 || xx >= gw) continue;
              sum += buf[(y * gw + xx) * 4 + c];
              n++;
            }
            tmp[(y * gw + x) * 4 + c] = sum / n;
          }
        }
      }
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          for (let c = 0; c < 4; c++) {
            let sum = 0, n = 0;
            for (let k = -2; k <= 2; k++) {
              const yy = y + k;
              if (yy < 0 || yy >= gh) continue;
              sum += tmp[(yy * gw + x) * 4 + c];
              n++;
            }
            buf[(y * gw + x) * 4 + c] = sum / n;
          }
        }
      }
    }
  }

  function paintRegions(ctx, w, h, X, Y, scale, ox, oy, state) {
    const gw = Math.ceil(w / SAMPLE), gh = Math.ceil(h / SAMPLE);
    const buf = new Float32Array(gw * gh * 4);
    const visited = new Set(state.zones.visited);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const wx = (gx * SAMPLE + SAMPLE / 2 - ox) / scale;
        const wy = (gy * SAMPLE + SAMPLE / 2 - oy) / scale;
        const region = Zones.at(state.seed, wx, wy);
        if (!visited.has(region.key)) continue;
        // Le cœur d'une région est un peu plus lumineux que ses bords.
        const glow = 0.7 + 0.3 * Math.min(1, region.edge / 700);
        const i = (gy * gw + gx) * 4;
        buf[i] = region.zone.tint[0] * glow;
        buf[i + 1] = region.zone.tint[1] * glow;
        buf[i + 2] = region.zone.tint[2] * glow;
        buf[i + 3] = 1;
      }
    }
    // Un fondu léger entre régions, jamais plus large que ~120 unités du monde : dézoomée, la carte garde des
    // frontières nettes (sinon un village proche d'une frontière semblerait changer de région).
    const reach = (2 * SAMPLE) / scale; // unités du monde couvertes par une passe de flou
    blur(buf, gw, gh, Math.max(0, Math.min(2, Math.floor(120 / reach))));
    const off = document.createElement('canvas');
    off.width = gw;
    off.height = gh;
    const octx = off.getContext('2d');
    const img = octx.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) {
      const a = buf[i * 4 + 3];
      // Couleurs moyennées avec le noir de l'inexploré : on les ramène à leur teinte, l'alpha porte le fondu.
      img.data[i * 4] = a > 0 ? buf[i * 4] / a : 0;
      img.data[i * 4 + 1] = a > 0 ? buf[i * 4 + 1] / a : 0;
      img.data[i * 4 + 2] = a > 0 ? buf[i * 4 + 2] / a : 0;
      img.data[i * 4 + 3] = Math.round(a * 150);
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, w, h);
  }

  function draw(map) {
    const { state } = map.game;
    const seed = state.seed;
    const canvas = map.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.min(window.innerWidth - 40, 760);
    const h = Math.min(window.innerHeight - 190, 560);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#030304';
    ctx.fillRect(0, 0, w, h);

    const cells = state.zones.visited.map((key) => {
      const [i, j] = key.split(',').map(Number);
      return { ...Zones.center(i, j, seed), zone: Zones.get(Zones.typeOf(i, j, seed)) };
    });

    // Cadrage : toutes les régions visitées, l'origine, la lumière, et les repaires des colosses entendus (on doit
    // pouvoir y envoyer des érudits).
    const pad = Zones.CELL * 0.7;
    let minX = Math.min(0, state.player.x) - pad, maxX = Math.max(0, state.player.x) + pad;
    let minY = Math.min(0, state.player.y) - pad, maxY = Math.max(0, state.player.y) + pad;
    const points = cells.slice();
    for (const d of Vide.COLOSSI) {
      const st = Vide.Colossus.status(state, d.id);
      if (st === 'heard' || st === 'found') points.push(Vide.Colossus.lair(state, d));
    }
    for (const c of points) {
      minX = Math.min(minX, c.x - pad); maxX = Math.max(maxX, c.x + pad);
      minY = Math.min(minY, c.y - pad); maxY = Math.max(maxY, c.y + pad);
    }
    const scale = Math.min(w / (maxX - minX), h / (maxY - minY));
    const ox = w / 2 - ((minX + maxX) / 2) * scale;
    const oy = h / 2 - ((minY + maxY) / 2) * scale;
    const X = (x) => ox + x * scale;
    const Y = (y) => oy + y * scale;
    map.view = { ox, oy, scale };

    paintRegions(ctx, w, h, X, Y, scale, ox, oy, state);

    // Villages (territoire teinté par leur type, bâtiments, cœur), puis l'origine.
    for (const v of state.villages) {
      const tint = Vide.Villages.type(v.type).tint;
      ctx.fillStyle = rgba(tint, 0.16);
      ctx.strokeStyle = rgba(tint, 0.5);
      // La forme réelle du territoire (contour de ses cellules) ; un simple point s'il est minuscule à l'échelle.
      ctx.beginPath();
      if (Territory.radius(v) * scale < 3) {
        ctx.arc(X(v.x), Y(v.y), 3, 0, Math.PI * 2);
      } else {
        for (const loop of Territory.outline(v)) {
          ctx.moveTo(X(loop[0][0]), Y(loop[0][1]));
          for (const [x, y] of loop) ctx.lineTo(X(x), Y(y));
          ctx.closePath();
        }
      }
      ctx.fill('evenodd');
      ctx.stroke();
      // Le blanc, nuance après nuance (elles s'empilent jusqu'au blanc pur).
      Territory.NUANCES.forEach((wv, n) => {
        if (n === 0) return;
        ctx.fillStyle = `rgba(240, 245, 255, ${n === 4 ? 0.4 : 0.1})`;
        ctx.beginPath();
        for (const loop of Territory.outline(v, wv)) {
          ctx.moveTo(X(loop[0][0]), Y(loop[0][1]));
          for (const [x, y] of loop) ctx.lineTo(X(x), Y(y));
          ctx.closePath();
        }
        ctx.fill('evenodd');
      });
      // Ses enceintes (des cercles nets ; une brèche en violet), si l'échelle le permet.
      if (Territory.radius(v) * scale > 12) {
        for (const w of v.walls) {
          ctx.strokeStyle = Vide.Walls.isDone(w) ? (w.broken.length ? 'rgba(190, 160, 255, 0.8)' : 'rgba(240, 245, 255, 0.75)') : 'rgba(240, 245, 255, 0.3)';
          ctx.lineWidth = Vide.Walls.isDone(w) ? 1.5 : 1;
          ctx.beginPath();
          ctx.arc(X(v.x), Y(v.y), Vide.Walls.radius(w) * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
      ctx.fillStyle = 'rgba(255, 220, 170, 0.8)';
      for (const b of v.buildings) ctx.fillRect(X(b.x) - 1, Y(b.y) - 1, 2, 2);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(X(v.x), Y(v.y), 2.5, 0, Math.PI * 2);
      ctx.fill();
      for (const d of v.districts || []) {
        ctx.beginPath();
        ctx.arc(X(d.x), Y(d.y), 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(X(0), Y(0), 3, 0, Math.PI * 2);
    ctx.stroke();

    // Routes : pleines une fois achevées, en pointillés tant qu'elles sont en chantier.
    for (const road of state.roads) {
      const [a, b] = Vide.Roads.ends(state, road);
      if (!a || !b) continue;
      ctx.strokeStyle = 'rgba(255, 236, 205, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash(Vide.Roads.isDone(state, road) ? [] : [3, 4]);
      ctx.beginPath();
      const path = Vide.Roads.route(state, a, b);
      ctx.moveTo(X(path[0].x), Y(path[0].y));
      for (const p of path) ctx.lineTo(X(p.x), Y(p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Les troncs communs, plus larges.
    ctx.strokeStyle = 'rgba(255, 236, 205, 0.4)';
    for (const trunk of Vide.Roads.trunks(state)) {
      const n = trunk.roads.filter((road) => Vide.Roads.isDone(state, road)).length;
      if (n < 2) continue;
      ctx.lineWidth = 1 + n;
      ctx.beginPath();
      ctx.moveTo(X(trunk.points[0].x), Y(trunk.points[0].y));
      ctx.lineTo(X(trunk.points[1].x), Y(trunk.points[1].y));
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // Expéditions en route : leur position, et un trait vers leur but (ou leur village, au retour).
    for (const e of state.expeditions) {
      const g = Vide.Expeditions.goal(state, e);
      ctx.strokeStyle = 'rgba(255, 245, 225, 0.4)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(X(e.x), Y(e.y));
      ctx.lineTo(X(g.x), Y(g.y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = e.kind === 'colons' ? rgba(Vide.Villages.type(e.type).tint, 0.95)
        : { scholars: '#aac8ff', sappers: '#ffd6a0' }[e.kind] || '#fff';
      ctx.beginPath();
      ctx.arc(X(e.x), Y(e.y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nids d'ombre : un disque sombre cerné de violet.
    for (const nest of state.nests) {
      ctx.fillStyle = 'rgba(8, 2, 18, 0.9)';
      ctx.strokeStyle = 'rgba(160, 110, 240, 0.8)';
      ctx.beginPath();
      ctx.arc(X(nest.x), Y(nest.y), Math.max(3, Vide.Nests.radius(nest) * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Le point choisi pour une expédition.
    if (map.target) {
      const tx = X(map.target.x), ty = Y(map.target.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(tx - 6, ty); ctx.lineTo(tx + 6, ty);
      ctx.moveTo(tx, ty - 6); ctx.lineTo(tx, ty + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, Vide.CONFIG.expeditions.reveal * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
    }

    // Repères supplémentaires (colosses…), fournis par d'autres modules.
    for (const mark of Vide.MapMarks || []) mark(ctx, X, Y, state);

    // Ta lumière.
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(X(state.player.x), Y(state.player.y), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Légende : les zones découvertes.
    map.legend.textContent = '';
    for (const id of state.zones.discovered) {
      const z = Zones.get(id);
      const item = document.createElement('span');
      const dot = document.createElement('i');
      dot.style.background = rgba(z.tint, 0.9);
      item.appendChild(dot);
      item.appendChild(document.createTextNode(z.name));
      item.title = z.desc;
      map.legend.appendChild(item);
    }
  }

  function update(map) {
    const visible = map.game.state.zones.visited.length > 1 || map.game.state.villages.length > 0;
    if (map.button.classList.contains('hidden') === visible) map.button.classList.toggle('hidden', !visible);
  }

  Vide.Map = { create, toggle, draw, update };
})(globalThis.Vide);

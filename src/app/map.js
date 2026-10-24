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
    map.root.addEventListener('click', (e) => {
      if (e.target === map.root) toggle(map, false);
    });
    return map;
  }

  function toggle(map, open) {
    map.open = open === undefined ? !map.open : open;
    map.root.hidden = !map.open;
    if (map.open) draw(map);
  }

  function rgba(tint, a) {
    return `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${a})`;
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

    // Cadrage : toutes les régions visitées, le foyer et la lumière.
    const pad = Zones.CELL * 0.7;
    let minX = Math.min(0, state.player.x) - pad, maxX = Math.max(0, state.player.x) + pad;
    let minY = Math.min(0, state.player.y) - pad, maxY = Math.max(0, state.player.y) + pad;
    for (const c of cells) {
      minX = Math.min(minX, c.x - pad); maxX = Math.max(maxX, c.x + pad);
      minY = Math.min(minY, c.y - pad); maxY = Math.max(maxY, c.y + pad);
    }
    const scale = Math.min(w / (maxX - minX), h / (maxY - minY));
    const ox = w / 2 - ((minX + maxX) / 2) * scale;
    const oy = h / 2 - ((minY + maxY) / 2) * scale;
    const X = (x) => ox + x * scale;
    const Y = (y) => oy + y * scale;

    // Régions : des taches de la couleur de leur zone.
    const r = Zones.CELL * 0.62 * scale;
    for (const c of cells) {
      const grad = ctx.createRadialGradient(X(c.x), Y(c.y), 0, X(c.x), Y(c.y), r);
      grad.addColorStop(0, rgba(c.zone.tint, 0.28));
      grad.addColorStop(1, rgba(c.zone.tint, 0.04));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(X(c.x), Y(c.y), r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (r > 45) {
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const c of cells) {
        ctx.fillStyle = rgba(c.zone.tint, 0.7);
        ctx.fillText(c.zone.name.toLowerCase(), X(c.x), Y(c.y));
      }
    }

    // Territoire, bâtiments, foyer.
    if (state.territory.lit) {
      ctx.fillStyle = 'rgba(160, 200, 255, 0.18)';
      ctx.strokeStyle = 'rgba(210, 230, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(X(0), Y(0), Math.max(2, Territory.radius(state) * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 220, 170, 0.8)';
    for (const b of state.buildings) ctx.fillRect(X(b.x) - 1, Y(b.y) - 1, 2, 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(X(0), Y(0), 3, 0, Math.PI * 2);
    ctx.fill();

    // Repères supplémentaires (colosses…), fournis par d'autres modules.
    for (const mark of Vide.Map.marks) mark(ctx, X, Y, state);

    // Ta lumière.
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(X(state.player.x), Y(state.player.y), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('toi', X(state.player.x) + 8, Y(state.player.y) + 4);

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
    const visible = map.game.state.zones.visited.length > 1;
    if (map.button.classList.contains('hidden') === visible) map.button.classList.toggle('hidden', !visible);
  }

  Vide.Map = { create, toggle, draw, update, marks: [] };
})(globalThis.Vide);

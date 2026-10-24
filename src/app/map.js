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
    blur(buf, gw, gh, 2);
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

    // Cadrage : toutes les régions visitées, l'origine, les villages et la lumière.
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
      // Le blanc du cœur.
      ctx.fillStyle = 'rgba(240, 245, 255, 0.35)';
      ctx.beginPath();
      for (const loop of Territory.outline(v, 60)) {
        ctx.moveTo(X(loop[0][0]), Y(loop[0][1]));
        for (const [x, y] of loop) ctx.lineTo(X(x), Y(y));
        ctx.closePath();
      }
      ctx.fill('evenodd');
      ctx.fillStyle = 'rgba(255, 220, 170, 0.8)';
      for (const b of v.buildings) ctx.fillRect(X(b.x) - 1, Y(b.y) - 1, 2, 2);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(X(v.x), Y(v.y), 2.5, 0, Math.PI * 2);
      ctx.fill();
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
      ctx.moveTo(X(a.x), Y(a.y));
      ctx.lineTo(X(b.x), Y(b.y));
      ctx.stroke();
      ctx.setLineDash([]);
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
    const visible = map.game.state.zones.visited.length > 1;
    if (map.button.classList.contains('hidden') === visible) map.button.classList.toggle('hidden', !visible);
  }

  Vide.Map = { create, toggle, draw, update };
})(globalThis.Vide);

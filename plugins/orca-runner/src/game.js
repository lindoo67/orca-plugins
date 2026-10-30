/* Orca Run — original canvas game. Copyright (c) 2026 Orca contributors. MIT. */
(function () {
  'use strict';
  const WIDTH = 720;
  const HEIGHT = 280;
  const GROUND = 210;
  const HORIZON = 146;
  const SURFACE = GROUND - 7;
  const PLAYER_X = 82;
  const DIVE_DEPTH = 48;
  const ICE_DEPTH = 15;
  const GRAVITY = 1450;
  const JUMP_VELOCITY = 505;
  // One full day → dusk → aurora night → dawn loop, measured in world distance (1200 points).
  const CYCLE = 12000;
  const TILE = 960;
  // Physics keeps the 720×280 world; every frame is painted on a grid of 3-unit art pixels and
  // the browser scales that grid up with nearest-neighbour sampling.
  const PIXEL = 3;
  const ROWS = Math.ceil(HEIGHT / PIXEL);
  const HORIZON_ROW = Math.round(HORIZON / PIXEL);
  const SURFACE_ROW = Math.round(SURFACE / PIXEL);
  const GROUND_ROW = GROUND / PIXEL;
  const TILE_COLUMNS = TILE / PIXEL;
  // 4×4 ordered dither: gradients step through a few flat bands instead of blending smoothly.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(value => (value + 0.5) / 16);
  function threshold(x, y) {
    return BAYER[(y & 3) * 4 + (x & 3)];
  }
  // Picks a band for a fractional level: flat colour, dithered only near each seam.
  function band(level, x, y) {
    const base = Math.floor(level);
    const seam = Math.min(1, Math.max(0, (level - base - 0.5) * 3 + 0.5));
    return base + (seam > threshold(x, y) ? 1 : 0);
  }

  function hex(value) {
    const number = parseInt(value.slice(1), 16);
    return [number >> 16, (number >> 8) & 255, number & 255];
  }
  function palette(colors) {
    const parsed = {};
    for (const key of Object.keys(colors)) parsed[key] = typeof colors[key] === 'string' ? hex(colors[key]) : colors[key];
    return parsed;
  }
  const DAY = palette({ skyTop:'#5aaee6', skyLow:'#d4edfa', sun:'#fff7dc', haze:'#b2d3e8', ridge:'#86b4d4', snow:'#f6fbff', sea:'#3f93cc', deep:'#0c3566', crest:'#8cc6ec', foam:'#f4fbff', ice:'#f8fdff', iceShade:'#9acbea', iceDeep:'#4f92c4', cloud:'#ffffff', rim:'#9cc4e0', night:0, sunY:58 });
  const DUSK = palette({ skyTop:'#3b4c8c', skyLow:'#ffb48c', sun:'#ffc887', haze:'#c79bb5', ridge:'#8b76a2', snow:'#ffe3d3', sea:'#7273ac', deep:'#1b2252', crest:'#c9a5c6', foam:'#fff0e6', ice:'#fff4ec', iceShade:'#c6a8cc', iceDeep:'#7c6ca6', cloud:'#ffcbb6', rim:'#ffb78e', night:0.2, sunY:132 });
  const NIGHT = palette({ skyTop:'#06122a', skyLow:'#1a3d66', sun:'#ffd9a8', haze:'#2a4c74', ridge:'#1e3b5f', snow:'#a3bfda', sea:'#1c4570', deep:'#030b1d', crest:'#3d71a0', foam:'#c0d9ee', ice:'#dbecfa', iceShade:'#7ea7cd', iceDeep:'#3f6b98', cloud:'#2a496d', rim:'#8fb8de', night:1, sunY:190 });
  const DAWN = palette({ skyTop:'#6c93cc', skyLow:'#ffd4ba', sun:'#ffe7c4', haze:'#c6b6d0', ridge:'#979ec6', snow:'#fff1ea', sea:'#7aa0d0', deep:'#1a3868', crest:'#b8c9e8', foam:'#fff7f2', ice:'#fffaf7', iceShade:'#b5c1e2', iceDeep:'#7189c0', cloud:'#ffe1d3', rim:'#ffcfb6', night:0.15, sunY:118 });
  const SKY = [[0, DAY], [0.38, DAY], [0.5, DUSK], [0.6, NIGHT], [0.86, NIGHT], [0.95, DAWN], [1, DAY]];
  const WHITE = [255, 255, 255];

  // Scenery is generated once from fixed seeds, so every run sails past the same coastline.
  function seeded(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function ridge(seed, low, high) {
    const random = seeded(seed);
    const points = [{ x: 0, y: HORIZON - 9, peak: false }];
    let x = 0;
    while (x < TILE - 130) {
      x += 34 + random() * 46;
      points.push({ x, y: HORIZON - low - random() * (high - low), peak: true });
      x += 30 + random() * 50;
      points.push({ x, y: HORIZON - 5 - random() * 12, peak: false });
    }
    points.push({ x: TILE, y: HORIZON - 9, peak: false });
    return points;
  }
  // Each art-pixel column of a ridge tile stores its top row, whether it is the leeward face
  // and how far a ragged snow cap reaches down from tall peaks.
  function heightmap(points, seed) {
    const jitter = seeded(seed);
    const columns = [];
    let segment = 0;
    for (let column = 0; column < TILE_COLUMNS; column++) {
      const x = column * PIXEL + PIXEL / 2;
      while (segment < points.length - 2 && x > points[segment + 1].x) segment++;
      const a = points[segment];
      const b = points[segment + 1];
      const peak = a.peak ? a : b;
      const tall = (HORIZON - peak.y) / PIXEL;
      columns.push({
        top: Math.round((a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)) / PIXEL),
        shade: a.peak,
        snow: tall >= 8 ? Math.round(peak.y / PIXEL + tall * 0.3) + Math.floor(jitter() * 2) : -1
      });
    }
    return columns;
  }
  const FAR_RIDGE = heightmap(ridge(3, 30, 74), 5);
  const NEAR_RIDGE = heightmap(ridge(21, 14, 38), 8);
  const CLOUDS = (function () {
    const random = seeded(7);
    return Array.from({ length: 6 }, (_, index) => ({ x: index * 190 + random() * 90, y: 24 + random() * 58, size: 0.6 + random() * 0.7 }));
  })();
  const STARS = (function () {
    const random = seeded(11);
    return Array.from({ length: 54 }, () => ({ x: random() * WIDTH, y: 6 + random() * (HORIZON - 46), phase: random() * 6.3, size: random() < 0.18 ? 1.8 : 1 }));
  })();

  // ---- Sprites ------------------------------------------------------------------------------
  // One character per art pixel; '.' is transparent. Letters map to colours at draw time so
  // the rim light, ice and clouds follow the sky.
  function sprite(rows) {
    return { width: rows[0].length, height: rows.length, rows };
  }
  // Facing right. Column 10 is the orca's world x and row 22 its waterline.
  const ORCA_FIN = [
    '..................r.................',
    '.................bgr................',
    '.................bbgr...............',
    '.................bbbgr..............',
    '.................bbbbgr.............',
    '.................bbbbgr.............',
    '.................bbbbbgr............',
    '.................bbbbbbggrr.........',
    '...............rrbbbbbbbbgggrr......'
  ];
  const ORCA_FOLDED = [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '..............rrrr..................',
    '.............rbbbbbbbbbbggr.........',
    '...............bbbbbbbbbbgggrr......'
  ];
  const ORCA_BODY = [
    '.............rrssssbbbbbbbggggrr....',
    '............rsbbbbbbbbbbbwwwbbbbr...',
    '............rbbbbbbbbbbwwwwwbbEEbr..',
    '.rr........rbbbbbbbbbbbwwwbbbbEebr..',
    '..rb......rbbbbbbbbbbbbbbbbbbbbbbbb.',
    '..bbr...rrbbbbbbbbbbbbbbbbbbbbbbbbb.',
    '...bbrrrbbbbwbbbbbbbbbbbbbbbbbbbww..',
    '...bbbbbbbbbbwwwbbbbbbbbbbbbbbbwww..',
    '..bbbb..bbbbbbwwwwwbbkbbbbbbwwwww...',
    '..bb........bbbbwwwwkkbbwwwwwww.....',
    '.bb............kklllkklllllllk......',
    '.................kkkkkkkkkkk........',
    '....................kk..............',
    '.....................k..............'
  ];
  const ORCA = sprite(ORCA_FIN.concat(ORCA_BODY));
  const ORCA_DIVE = sprite(ORCA_FOLDED.concat(ORCA_BODY));
  const ORCA_X_EYES = sprite(['w.w', '.w.', 'w.w']);
  const SPOUT = sprite(['f...f', '.fff.', '..f..', '..f..']);
  // Facing left; three wing poses.
  const GULL_FRAMES = [
    sprite(['..........kk.', '.........lk..', '........ll...', '.......ll....', '..ww..ll.....', '.wewwwlwwwt..', 'oowwwwwwwwtt.', '...gwwwwwg...', '.............']),
    sprite(['.............', '.............', '.............', '.............', '..ww..lllllkk', '.wewwwwwwwt..', 'oowwwwwwwwtt.', '...gwwwwwg...', '.............']),
    sprite(['.............', '.............', '.............', '.............', '..ww.........', '.wewwwwwwwt..', 'oowwwwllwwtt.', '...gwwwllg...', '.......lk....'])
  ];
  // Three iceberg silhouettes share one hitbox; only the facets differ.
  const ICEBERGS = [
    sprite(['....o.......', '...oHo......', '...oHSo.....', '..oHWSo.o...', '..oHWDSoSo..', '.oHWWDSSSo..', '.oWWWDSSSSo.', '.oWWWDDSSSo.', 'oWWWWWDSSSSo', 'oWWWWWDSSSSo', 'oWWWWWDDSSSo', 'oWWWWWWDSSSo', 'oWWWWWWDSSSo']),
    sprite(['......o.....', '.....oHo....', '..o..oHSo...', '.oHo.oHSSo..', '.oHWooWSSo..', 'oHWWSWWSSSo.', 'oWWWDWWSSSo.', 'oWWWDWWDSSSo', 'oWWDDWWDSSSo', 'oWWWDWWWDSSo', 'oWWWWWWWDSSo', 'oWWWWWWWDSSo', 'oWWWWWWWDSSo']),
    sprite(['............', '...ooooo....', '..oHHHWSoo..', '.oHWWWWSSSo.', '.oHWWWDSSSo.', 'oHWWWWDSSSo.', 'oWWWWWDSSSSo', 'oWWWWWDDSSSo', 'oWWWWWWDSSSo', 'oWWWWWWDSSSo', 'oWWWWWWDSSSo', 'oWWWWWWWDSSo', 'oWWWWWWWDSSo'])
  ];
  const CLOUD_BIG = sprite(['.......cccc.......', '...ccc.cccccc.....', '..cccccccccccccc..', '.cccccccccccccccc.', 'cccccccccccccccccc', '.ssssssssssssssss.']);
  const CLOUD_SMALL = sprite(['....ccc....', '..ccccccc..', '.ccccccccc.', 'ccccccccccc', '.sssssssss.']);
  const IMPACT = sprite(['....w....', '.w..w..w.', '..w.w.w..', '...wyw...', 'wwwyyywww', '...wyw...', '..w.w.w..', '.w..w..w.', '....w....']);
  // The score and messages are painted in the scene with a tiny 5-pixel-tall font.
  const FONT = {
    '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '..#', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'], ' ': ['..', '..', '..', '..', '..'], '!': ['#', '#', '#', '.', '#'], '↓': ['..#..', '..#..', '#.#.#', '.###.', '..#..'],
    A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
    D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], G: ['.##.', '#...', '#.##', '#..#', '.##.'],
    H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'], M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.##.', '#..#', '#..#', '#..#', '.##.'], P: ['##.', '#.#', '##.', '#..', '#..'],
    R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#']
  };
  const RESTART = ['...####.#.', '.##....##.', '.#....###.', '#.........', '#.........', '#........#', '.#......#.', '.##....##.', '...####...'];
  const GULL_COLORS = { w: WHITE, l: hex('#d3e0ea'), g: hex('#a9bccd'), k: hex('#253545'), o: hex('#f39a4c'), e: hex('#1a2735'), t: hex('#e3ebf2') };

  window.createOrcaRunner = function ({ canvas, onStateChange = function () {}, onScore = function () {} }) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Orca Run needs a 2D canvas.');
    const sparkle = seeded(99);
    let state = 'ready';
    let frame = null;
    let lastTime = null;
    let distance = 0;
    let clock = 0;
    let score = 0;
    let best = 0;
    let height = 0;
    let velocity = 0;
    let ducking = false;
    let dive = 0;
    let obstacles = [];
    let particles = [];
    let spawned = 0;
    let untilSpawn = 1.8;
    let untilWake = 0;
    let impact = null;
    let bestBefore = 0;
    let flashUntil = 0;
    let destroyed = false;
    let viewportWidth = WIDTH;
    let columns = WIDTH / PIXEL;
    let image = null;
    let pixels = null;
    // Marks sprite pixels so the front water only tints what sits below the surface.
    let covered = null;
    let phaseStart = 0;

    function setState(next) {
      if (state === next) return;
      state = next;
      onStateChange(state);
    }
    function cancelFrame() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      lastTime = null;
    }
    function scheduleFrame() {
      if (!destroyed && state === 'running' && frame === null) frame = window.requestAnimationFrame(tick);
    }
    function speed() {
      return Math.min(430, 255 + distance * 0.009);
    }
    function playerY() {
      return GROUND - height + dive * DIVE_DEPTH;
    }

    // ---- Colour -----------------------------------------------------------------------------
    function mix(a, b, amount) {
      return a + (b - a) * amount;
    }
    function mixColor(a, b, amount) {
      return [mix(a[0], b[0], amount), mix(a[1], b[1], amount), mix(a[2], b[2], amount)];
    }
    function pack(color) {
      return (255 << 24 | Math.round(color[2]) << 16 | Math.round(color[1]) << 8 | Math.round(color[0])) >>> 0;
    }
    function unpack(value) {
      return [value & 255, (value >> 8) & 255, (value >> 16) & 255];
    }
    function bands(stops, count) {
      const result = [];
      for (let index = 0; index < count; index++) {
        const position = index / (count - 1) * (stops.length - 1);
        const from = Math.min(stops.length - 2, Math.floor(position));
        result.push(pack(mixColor(stops[from], stops[from + 1], position - from)));
      }
      return result;
    }
    function skyAt(time) {
      let index = 0;
      while (index < SKY.length - 2 && time > SKY[index + 1][0]) index++;
      const [from, a] = SKY[index];
      const [to, b] = SKY[index + 1];
      const linear = to === from ? 0 : Math.min(1, Math.max(0, (time - from) / (to - from)));
      const amount = linear * linear * (3 - 2 * linear);
      const result = {};
      for (const key of Object.keys(a)) {
        result[key] = Array.isArray(a[key]) ? a[key].map((value, channel) => mix(value, b[key][channel], amount)) : mix(a[key], b[key], amount);
      }
      return result;
    }

    // ---- Pixel primitives -------------------------------------------------------------------
    function inside(x, y) {
      return x >= 0 && x < columns && y >= 0 && y < ROWS;
    }
    function plot(x, y, value) {
      if (inside(x, y)) pixels[y * columns + x] = value;
    }
    function blend(x, y, color, amount) {
      if (!inside(x, y) || amount <= 0) return;
      const index = y * columns + x;
      pixels[index] = pack(mixColor(unpack(pixels[index]), color, Math.min(1, amount)));
    }
    function span(left, y, count, color, amount) {
      for (let x = left; x < left + count; x++) blend(x, y, color, amount);
    }
    function wrap(value, size) {
      return ((value % size) + size) % size;
    }
    function toColumn(x) {
      return Math.round(x / PIXEL);
    }
    // Draws a sprite with an optional per-column vertical offset (used to tilt the orca).
    function blit(art, left, top, colors, offset) {
      for (let row = 0; row < art.height; row++) {
        const line = art.rows[row];
        for (let column = 0; column < art.width; column++) {
          const color = colors[line[column]];
          if (!color) continue;
          const x = left + column;
          const y = top + row + (offset ? offset(column) : 0);
          if (!inside(x, y)) continue;
          pixels[y * columns + x] = color;
          covered[y * columns + x] = 1;
        }
      }
    }
    function packed(colors) {
      const result = {};
      for (const key of Object.keys(colors)) result[key] = pack(colors[key]);
      return result;
    }
    function disc(centerX, centerY, radius, paint) {
      const reach = Math.ceil(radius);
      for (let y = centerY - reach; y <= centerY + reach; y++) {
        for (let x = centerX - reach; x <= centerX + reach; x++) {
          const d = Math.hypot(x - centerX, y - centerY);
          if (d <= radius) paint(x, y, d);
        }
      }
    }

    // ---- Sky --------------------------------------------------------------------------------
    function drawSky(sky) {
      const tones = bands([sky.skyTop, sky.skyLow], 6);
      for (let y = 0; y < HORIZON_ROW; y++) {
        const level = y / (HORIZON_ROW - 1) * (tones.length - 1);
        for (let x = 0; x < columns; x++) pixels[y * columns + x] = tones[Math.min(tones.length - 1, band(level, x, y))];
      }
      if (sky.night > 0.25) {
        const starlight = (sky.night - 0.25) / 0.75;
        for (const star of STARS) {
          const x = toColumn(star.x);
          const y = toColumn(star.y);
          if (x >= columns) continue;
          const twinkle = starlight * (0.45 + 0.4 * Math.sin(clock * 2.4 + star.phase));
          if (twinkle < 0.2) continue;
          blend(x, y, WHITE, twinkle + 0.15);
          // Bright stars flare into a little cross at the top of their twinkle.
          if (star.size > 1 && twinkle > 0.62) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blend(x + dx, y + dy, WHITE, twinkle * 0.45);
        }
        drawAurora(starlight);
        drawMoon(starlight);
      }
      drawSun(sky);
    }
    function drawAurora(strength) {
      // Curtains: dithered vertical rays under a drifting crest, brighter in slow-moving patches.
      const ribbons = [[44, [110, 255, 190], 0], [70, [150, 140, 255], 2.2]];
      for (const [base, color, phase] of ribbons) {
        for (let x = 0; x < columns; x++) {
          const world = x * PIXEL;
          const top = base - 22 + Math.sin(world * 0.012 + clock * 0.45 + phase) * 13 + Math.sin(world * 0.033 + phase) * 4;
          const patch = Math.max(0, Math.sin(world * 0.011 - clock * 0.3 + phase * 1.7));
          const rays = 0.65 + 0.35 * Math.sin(world * 0.37 + phase + clock * 0.8);
          const glow = strength * patch * patch * rays;
          if (glow < 0.05) continue;
          const first = toColumn(top);
          const length = Math.round(64 * (0.8 + 0.4 * Math.sin(world * 0.05 + phase)) / PIXEL);
          for (let step = 0; step < length; step++) {
            const along = step / length;
            const profile = along < 0.2 ? along / 0.2 : (1 - along) / 0.8;
            const y = first + step;
            if (y < HORIZON_ROW && glow * profile * 1.25 > threshold(x, y)) blend(x, y, color, 0.55);
          }
        }
      }
    }
    function drawMoon(strength) {
      const centerX = toColumn(viewportWidth - 160);
      const centerY = toColumn(40);
      disc(centerX, centerY, 9, (x, y, d) => {
        if (d <= 4.4) blend(x, y, [238, 244, 255], strength);
        else if (threshold(x, y) < 0.45 * (1 - (d - 4.4) / 4.6) * strength) blend(x, y, [220, 235, 255], 0.3);
      });
      for (const [dx, dy] of [[-1, -1], [1, 1], [2, -1], [-2, 1]]) blend(centerX + dx, centerY + dy, [160, 184, 214], 0.5 * strength);
    }
    function drawSun(sky) {
      if (sky.sunY > HORIZON + 24) return;
      const centerX = toColumn(viewportWidth - 92);
      const centerY = toColumn(sky.sunY);
      // Two dithered halos ring a flat pixel disc.
      disc(centerX, centerY, 18, (x, y, d) => {
        if (y >= HORIZON_ROW) return;
        if (d <= 6.6) plot(x, y, pack(sky.sun));
        else if (d <= 8.6) blend(x, y, sky.sun, 0.5);
        else if (d <= 18 && threshold(x, y) < 0.5 * (1 - (d - 8.6) / 9.4)) blend(x, y, sky.sun, 0.3);
      });
    }
    function drawClouds(sky) {
      for (const cloud of CLOUDS) {
        const art = cloud.size > 0.95 ? CLOUD_BIG : CLOUD_SMALL;
        const left = toColumn(wrap(cloud.x - distance * 0.025 * cloud.size - clock * 3, 1140) - 120);
        const top = toColumn(cloud.y) - art.height + 2;
        const behind = mixColor(sky.skyTop, sky.skyLow, Math.max(0, top) / HORIZON_ROW);
        const alpha = (0.55 + 0.35 * cloud.size) * (1 - sky.night * 0.75);
        blit(art, left, top, packed({ c: mixColor(behind, sky.cloud, alpha), s: mixColor(behind, mixColor(sky.cloud, sky.rim, 0.5), alpha) }));
      }
    }
    function drawRidge(map, parallax, fill, shade, snow) {
      const colors = [pack(fill), pack(mixColor(fill, shade, 0.5)), pack(snow), pack(mixColor(snow, shade, 0.25))];
      const offset = toColumn(wrap(distance * parallax, TILE));
      for (let x = 0; x < columns; x++) {
        const column = map[(x + offset) % TILE_COLUMNS];
        for (let y = Math.max(0, column.top); y <= HORIZON_ROW; y++) {
          pixels[y * columns + x] = colors[(y <= column.snow ? 2 : 0) + (column.shade ? 1 : 0)];
        }
      }
    }

    // ---- Sea --------------------------------------------------------------------------------
    function drawSea(sky) {
      const tones = bands([sky.sea, mixColor(sky.sea, sky.deep, 0.55), sky.deep], 8);
      const rows = ROWS - 1 - HORIZON_ROW;
      for (let y = HORIZON_ROW; y < ROWS; y++) {
        const level = (y - HORIZON_ROW) / rows * (tones.length - 1);
        for (let x = 0; x < columns; x++) pixels[y * columns + x] = tones[Math.min(tones.length - 1, band(level, x, y))];
      }
      span(0, HORIZON_ROW, columns, sky.foam, 0.45);
      // Glitter path under the sun or moon.
      const shine = sky.sunY < HORIZON ? sky.sun : sky.night > 0.5 ? [238, 244, 255] : null;
      if (shine) {
        const center = sky.sunY < HORIZON ? viewportWidth - 92 : viewportWidth - 160;
        const strength = sky.sunY < HORIZON ? 0.6 * (1 - sky.night * 0.6) : 0.4 * sky.night;
        for (let y = HORIZON + 4; y < GROUND - 12; y += 5) {
          const reach = 8 + (y - HORIZON) * 0.55;
          const wobble = Math.sin(clock * 3 + y * 0.7) * reach * 0.35;
          const width = reach * (0.4 + 0.3 * Math.sin(y + clock * 5));
          span(toColumn(center - reach / 2 + wobble), toColumn(y), Math.max(1, toColumn(width)), shine, strength);
        }
      }
      drawWaves(sky, 9, HORIZON + 5, GROUND - 10, 0.08, 0.7);
    }
    function drawWaves(sky, rows, top, bottom, slowest, fastest) {
      for (let row = 0; row < rows; row++) {
        const depth = row / (rows - 1);
        const y = toColumn(top + depth * depth * (bottom - top));
        const parallax = mix(slowest, fastest, depth);
        const length = Math.max(2, toColumn(5 + depth * 18));
        const spacing = 46 + depth * 54 + (row % 3) * 9;
        for (let x = wrap(row * 53 - distance * parallax, spacing) - 40; x < viewportWidth + 40; x += spacing) {
          const left = toColumn(x + wrap(x * 7.3 + row * 31, 23) - 11);
          // Near crests get a raised middle so they read as little pixel wavelets.
          span(left, y, length, sky.crest, 0.5);
          if (depth > 0.5 && length > 3) span(left + Math.floor(length / 4), y - 1, Math.ceil(length / 2), sky.crest, 0.35);
        }
      }
    }
    function drawFrontWater(sky) {
      const scroll = toColumn(distance);
      for (let x = 0; x < columns; x++) {
        const lifted = Math.sin((x * PIXEL + distance) * 0.045) > 0.55;
        const surface = SURFACE_ROW - (lifted ? 1 : 0);
        for (let y = surface + 1; y < ROWS; y++) {
          // Anything under the surface takes on the water's colour.
          if (covered[y * columns + x]) blend(x, y, mixColor(sky.sea, sky.deep, (y - surface) / (ROWS - surface)), 0.5);
        }
        if (!covered[surface * columns + x]) blend(x, surface, sky.foam, lifted || wrap(x + scroll, 9) < 2 ? 0.6 : 0.28);
      }
      drawWaves(sky, 5, GROUND + 9, HEIGHT - 8, 1.05, 1.5);
    }

    // ---- Hazards ----------------------------------------------------------------------------
    function drawIce(obstacle, sky) {
      const art = ICEBERGS[obstacle.variant % ICEBERGS.length];
      const left = toColumn(obstacle.x - 3);
      // The submerged base shows through the water as a dithered shelf.
      for (let row = 0; row < ICE_DEPTH / PIXEL; row++) {
        for (let x = left - 1 + (row >> 1); x <= left + art.width - (row >> 1); x++) {
          if (threshold(x, GROUND_ROW + row) < 0.55 - row * 0.09) blend(x, GROUND_ROW + row, sky.iceDeep, 0.6);
        }
      }
      blit(art, left, GROUND_ROW - art.height, packed({ o: mixColor(sky.iceDeep, sky.deep, 0.35), W: sky.ice, S: sky.iceShade, D: sky.iceDeep, H: WHITE }));
    }
    function drawIceFoam(obstacle, sky) {
      const left = toColumn(obstacle.x - 3);
      const lap = Math.round(Math.sin(clock * 6 + obstacle.x * 0.05));
      span(left - 1 - lap, SURFACE_ROW, 2, sky.foam, 0.9);
      span(left + 11 + lap, SURFACE_ROW, 2, sky.foam, 0.9);
      span(left + 1 - lap, SURFACE_ROW + 1, 10 + lap * 2, sky.foam, 0.8);
    }
    function drawGull(obstacle, sky) {
      const flap = Math.sin(clock * 13 + obstacle.x * 0.02);
      const art = GULL_FRAMES[flap > 0.4 ? 0 : flap > -0.4 ? 1 : 2];
      const left = toColumn(obstacle.x - 4);
      span(left + 3, SURFACE_ROW - 1, 7, sky.deep, 0.3);
      blit(art, left, toColumn(obstacle.y - 9), packed(GULL_COLORS));
    }

    // ---- Orca -------------------------------------------------------------------------------
    function drawOrca(sky) {
      const swimming = state === 'running' && height === 0;
      const bob = swimming && dive < 0.5 ? Math.round(Math.sin(clock * 7) * 0.7) : 0;
      const tilt = height > 0 ? Math.max(-0.32, Math.min(0.38, -velocity / 1300)) : 0;
      // Tilting shears the sprite column by column in eighth-pixel steps, so it never smears.
      const shear = Math.round(Math.tan(tilt) * 8) / 8;
      const tail = swimming ? Math.round(Math.sin(clock * 9)) : height > 0 ? Math.round(Math.sin(clock * 16) * 0.8) : 0;
      const offset = column => Math.round((column - 21) * shear) + (column < 7 ? tail : 0);
      const left = toColumn(PLAYER_X) - 10;
      // The folded fin and whole body sink below the surface, along with the hitbox.
      const top = toColumn(playerY()) + bob - 22;
      if (height > 0) {
        const fade = Math.max(0, 1 - height / 180);
        const reach = Math.round(10 * (0.5 + fade / 2));
        span(toColumn(PLAYER_X + 34) - reach, SURFACE_ROW, reach * 2, sky.deep, 0.5 * fade);
      }
      const over = state === 'gameover';
      const body = hex('#0d1926');
      blit(dive > 0.5 ? ORCA_DIVE : ORCA, left, top, packed({
        r: mixColor(hex('#2a3f55'), sky.rim, 0.6), g: hex('#22374c'), b: body, k: hex('#060c14'), s: hex('#3a4d61'),
        w: WHITE, l: hex('#c6d8e6'), E: over ? body : WHITE, e: over ? body : hex('#0a1622')
      }), offset);
      if (over) blit(ORCA_X_EYES, left + 30, top + 11, packed({ w: WHITE }), column => offset(column + 30));
      // A little spout says hello before the first run.
      if (state === 'ready') blit(SPOUT, left + 24, top + 1, packed({ f: sky.foam }));
    }

    // ---- Particles --------------------------------------------------------------------------
    function splash(count, x, y, reach) {
      const drift = -speed() * 0.45;
      for (let index = 0; index < count; index++) {
        particles.push({ kind: 'drop', x: x + sparkle() * reach, y, vx: drift + (sparkle() - 0.5) * 140, vy: -(110 + sparkle() * 170), life: 0.7, age: 0, size: 1.2 + sparkle() * 1.8 });
      }
      for (let index = 0; index < count / 3; index++) {
        particles.push({ kind: 'foam', x: x + sparkle() * reach, y: SURFACE + sparkle() * 2, vx: -speed(), vy: 0, life: 0.6, age: 0, size: 3 + sparkle() * 4 });
      }
      if (particles.length > 160) particles = particles.slice(-160);
    }
    function updateParticles(dt, worldSpeed) {
      untilWake -= dt;
      if (state === 'running' && height === 0 && untilWake <= 0) {
        untilWake = 0.045;
        if (dive > 0.5) particles.push({ kind: 'bubble', x: PLAYER_X + 10 + sparkle() * 50, y: playerY() - 20 + sparkle() * 10, vx: -worldSpeed * 0.8, vy: -45, life: 0.8, age: 0, size: 1 + sparkle() * 1.6 });
        else particles.push({ kind: 'foam', x: PLAYER_X - 10 + sparkle() * 14, y: SURFACE + sparkle() * 2.5, vx: -worldSpeed, vy: 0, life: 0.55, age: 0, size: 2 + sparkle() * 3 });
      }
      for (const particle of particles) {
        particle.age += dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.kind === 'drop') particle.vy += 900 * dt;
      }
      particles = particles.filter(particle => particle.age < particle.life && particle.x > -20 && (particle.kind !== 'drop' || particle.y < SURFACE + 4) && (particle.kind !== 'bubble' || particle.y > SURFACE));
    }
    function drawParticles(sky) {
      for (const particle of particles) {
        const fade = 1 - particle.age / particle.life;
        const x = toColumn(particle.x);
        const y = toColumn(particle.y);
        if (particle.kind === 'foam') {
          const reach = Math.max(1, Math.round(particle.size * (1 + particle.age * 2) / PIXEL));
          span(x - reach, y, reach * 2, sky.foam, 0.7 * fade);
        } else if (particle.kind === 'bubble') {
          if (particle.size > 1.6) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blend(x + dx, y + dy, sky.foam, 0.6 * fade);
          else blend(x, y, sky.foam, 0.6 * fade);
        } else {
          blend(x, y, sky.foam, 0.95 * fade);
          if (particle.size > 2.2) blend(x + 1, y, sky.foam, 0.7 * fade);
        }
      }
    }
    function drawImpact(sky) {
      if (impact) blit(IMPACT, toColumn(impact.x) - 4, toColumn(impact.y) - 4, packed({ w: sky.foam, y: hex('#ffd36b') }));
    }

    // ---- Score and messages -----------------------------------------------------------------
    function measure(value, gap) {
      let width = -gap;
      for (const character of value) width += FONT[character][0].length + gap;
      return width;
    }
    function stamp(rows, left, top, color) {
      rows.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) if (line[x] === '#') plot(left + x, top + y, color);
      });
    }
    function write(value, left, top, color, gap) {
      for (const character of value) {
        stamp(FONT[character], left, top, color);
        left += FONT[character][0].length + gap;
      }
    }
    function centered(value, top, color, gap) {
      write(value, Math.round((columns - measure(value, gap)) / 2), top, color, gap);
    }
    function drawHud(sky) {
      // Plain ink like the dino page: dark on a bright sky, light once dusk sets in.
      const behind = mixColor(sky.skyTop, sky.skyLow, 0.3);
      const bright = behind[0] * 0.3 + behind[1] * 0.59 + behind[2] * 0.11 > 140;
      const ink = bright ? hex('#10273b') : hex('#f4fbff');
      const color = pack(ink);
      const pad = value => String(value).padStart(5, '0');
      if (state !== 'ready' || best > 0) {
        const current = pad(score);
        const right = columns - 5 - measure(current, 1);
        const blinking = clock < flashUntil && Math.floor((flashUntil - clock) / 0.2) % 2 === 1;
        if (!blinking) write(current, right, 4, color, 1);
        if (best > 0) {
          const record = 'HI ' + pad(best);
          write(record, right - 6 - measure(record, 1), 4, pack(mixColor(ink, behind, 0.4)), 1);
        }
      }
      if (state === 'ready') {
        centered('PRESS SPACE TO SWIM', 16, color, 1);
        centered('HOLD ↓ TO DIVE', 24, color, 1);
      }
      else if (state === 'paused') {
        centered('PAUSED', 14, color, 2);
        centered('PRESS SPACE', 23, color, 1);
      } else if (state === 'gameover') {
        // Sits below the score row so narrow panels never crowd the two together.
        if (score > bestBefore) centered('NEW BEST!', 12, pack(hex(bright ? '#b5650d' : '#ffd36b')), 1);
        centered('GAME OVER', 20, color, 2);
        stamp(RESTART, Math.round(columns / 2) - 5, 29, color);
      }
    }

    // ---- Frame ------------------------------------------------------------------------------
    function draw() {
      if (destroyed) return;
      const sky = skyAt(wrap(phaseStart + distance / CYCLE, 1));
      drawSky(sky);
      drawClouds(sky);
      drawRidge(FAR_RIDGE, 0.03, sky.haze, mixColor(sky.haze, sky.deep, 0.25), mixColor(sky.haze, sky.snow, 0.85));
      drawRidge(NEAR_RIDGE, 0.07, sky.ridge, mixColor(sky.ridge, sky.deep, 0.35), sky.snow);
      // Clouds are sprites too, but only hazards and the orca take the underwater tint.
      covered.fill(0);
      drawSea(sky);
      for (const obstacle of obstacles) {
        if (obstacle.kind === 'bird') drawGull(obstacle, sky);
        else drawIce(obstacle, sky);
      }
      drawOrca(sky);
      drawFrontWater(sky);
      for (const obstacle of obstacles) if (obstacle.kind === 'ice') drawIceFoam(obstacle, sky);
      drawParticles(sky);
      if (state === 'gameover') drawImpact(sky);
      drawHud(sky);
      context.putImageData(image, 0, 0);
    }
    function intersects(a, b) {
      return a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
    }
    function update(dt) {
      const worldSpeed = speed();
      distance += worldSpeed*dt;
      clock += dt;
      const nextScore = Math.floor(distance/10);
      // Blink the score at every hundred, like a little arcade fanfare.
      if (Math.floor(nextScore / 100) > Math.floor(score / 100)) flashUntil = clock + 1.2;
      if (nextScore !== score) {
        score = nextScore;
        best = Math.max(best, score);
        onScore(score,best);
      }
      if (height > 0 || velocity > 0) {
        velocity -= GRAVITY*dt;
        height = Math.max(0,height+velocity*dt);
        if (height === 0 && velocity < 0) {
          velocity = 0;
          splash(12, PLAYER_X + 8, SURFACE, 50);
        }
      }
      const diveTarget = ducking && height === 0 ? 1 : 0;
      const previousDive = dive;
      dive += (diveTarget - dive) * Math.min(1, dt * 22);
      if (Math.abs(diveTarget - dive) < 0.005) dive = diveTarget;
      if ((previousDive < 0.5 && dive >= 0.5) || (previousDive >= 0.5 && dive < 0.5)) splash(6, PLAYER_X + 10, SURFACE, 46);
      untilSpawn -= dt;
      if (untilSpawn <= 0) {
        const bird = score > 180 && Math.random() < 0.3;
        obstacles.push(bird
          ? {kind:'bird',x:WIDTH+35,y:170,width:30,height:17}
          : {kind:'ice',x:WIDTH+35,y:GROUND-34,width:27,height:34,variant:spawned});
        spawned++;
        // Space hazards by time, so acceleration cannot create impossible clusters.
        untilSpawn = 1.35+Math.random()*0.75;
      }
      updateParticles(dt, worldSpeed);
      const player = {x:PLAYER_X+8,y:playerY()-37,width:51,height:31};
      for (const obstacle of obstacles) {
        obstacle.x -= worldSpeed*dt;
        const hazard = obstacle.kind === 'bird'
          ? {x:obstacle.x+3,y:obstacle.y+4,width:25,height:11}
          // Ice extends into the visible submerged shelf: diving still requires avoiding it.
          : {x:obstacle.x+5,y:GROUND-26,width:17,height:26+ICE_DEPTH};
        if (intersects(player,hazard)) {
          const left = Math.max(player.x, hazard.x);
          const top = Math.max(player.y, hazard.y);
          impact = {x:(left+Math.min(player.x+player.width,hazard.x+hazard.width))/2, y:(top+Math.min(player.y+player.height,hazard.y+hazard.height))/2};
          ducking = false;
          setState('gameover');
          return;
        }
      }
      obstacles = obstacles.filter(obstacle => obstacle.x+obstacle.width > -25);
    }
    function tick(time) {
      frame = null;
      if (destroyed || state !== 'running') return;
      const dt = lastTime === null ? 0 : Math.max(0,Math.min((time-lastTime)/1000,0.032));
      lastTime = time;
      update(dt);
      draw();
      if (state === 'running') scheduleFrame();
      else lastTime = null;
    }
    function start() {
      if (destroyed || state === 'running') return;
      if (state !== 'paused') {
        bestBefore = best;
        flashUntil = 0;
        distance = 0;
        score = 0;
        height = 0;
        velocity = 0;
        dive = 0;
        obstacles = [];
        particles = [];
        impact = null;
        untilSpawn = 1.8;
        onScore(0,best);
      }
      ducking = false;
      lastTime = null;
      setState('running');
      draw();
      scheduleFrame();
    }
    function jump() {
      if (destroyed) return;
      if (state === 'paused') { start(); return; }
      if (state === 'ready' || state === 'gameover') start();
      if (state === 'running' && height === 0 && velocity === 0) {
        ducking = false;
        velocity = JUMP_VELOCITY;
        splash(10, PLAYER_X + 14, SURFACE, 44);
      }
    }
    function pause() {
      if (destroyed || state !== 'running') return;
      ducking = false;
      cancelFrame();
      setState('paused');
      draw();
    }
    function resize() {
      if (destroyed) return;
      const width = Math.max(1,canvas.parentElement.getBoundingClientRect().width);
      // Dark themes open the run under the aurora; light themes start at midday.
      phaseStart = parseFloat(window.getComputedStyle(canvas).getPropertyValue('--game-phase')) || 0;
      // Crop distant scenery on narrow panels instead of shrinking the orca to a speck.
      // World coordinates, obstacle timing and collision geometry stay the same.
      viewportWidth = Math.min(WIDTH, Math.max(480, width));
      columns = Math.ceil(viewportWidth / PIXEL);
      // The canvas holds one device pixel per art pixel; CSS scales it up without smoothing.
      canvas.width = columns;
      canvas.height = ROWS;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      image = context.createImageData(columns, ROWS);
      pixels = new Uint32Array(image.data.buffer);
      covered = new Uint8Array(columns * ROWS);
      draw();
    }
    resize();
    onStateChange(state);
    onScore(score,best);
    return Object.freeze({
      start, jump, pause, resize,
      releaseJump: function () { if (velocity > 190) velocity = 190; },
      setDucking: function (value) {
        if (destroyed) return;
        if (value && state !== 'running') start();
        ducking = state === 'running' && Boolean(value);
        if (ducking && height > 0) velocity = Math.min(velocity, -330);
        draw();
      },
      togglePause: function () { if (state === 'paused') start(); else pause(); },
      getState: function () { return state; },
      // Read-only physics snapshot for tests; the artwork can change without touching them.
      inspect: function () {
        return {y: playerY(), crouched: ducking && height === 0, hazards: obstacles.map(obstacle => ({kind: obstacle.kind, x: obstacle.x}))};
      },
      destroy: function () { destroyed = true; cancelFrame(); obstacles = []; particles = []; }
    });
  };
})();

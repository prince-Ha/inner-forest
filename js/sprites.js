// 픽셀아트: 문자열 → 캔버스. 외부 이미지 없이 전부 코드로 그린다 (오리지널 그래픽)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  // rows: 같은 길이의 문자열 배열, palette: 문자 → 색. '.'은 투명
  SF.pixelCanvas = function (rows, palette) {
    const w = rows[0].length, h = rows.length;
    const cnv = document.createElement('canvas');
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext('2d');
    rows.forEach((row, y) => {
      if (row.length !== w) throw new Error('pixel row ' + y + ' has length ' + row.length + ', expected ' + w);
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const col = palette[ch];
        if (!col) throw new Error('no color for "' + ch + '"');
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    });
    return cnv;
  };

  function mirror(src) {
    const cnv = document.createElement('canvas');
    cnv.width = src.width;
    cnv.height = src.height;
    const ctx = cnv.getContext('2d');
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return cnv;
  }

  // ---------------------------------------------------------------- 캐릭터 '새싹이' (16×24, 오른쪽을 봄)
  const CHAR_PAL = {
    k: '#24160d', s: '#f7d2aa', c: '#f39a86', h: '#6e4020', H: '#9a5d2e',
    g: '#86d957', G: '#3f8f2c', b: '#3f8fe6', B: '#2a64ad', p: '#4d3526', P: '#35231a', o: '#2b1a10',
  };
  const SPROUT_A = [
    '..........gg....',
    '......gg.gGg....',
    '.....gGGgG......',
    '........G.......',
  ];
  const SPROUT_B = [
    '.........gg.....',
    '.....gg.gGg.....',
    '......gGgG......',
    '........G.......',
  ];
  const HEAD = [
    '....kkkkkkkk....',
    '...khhhhhhHHk...',
    '..khhhhhhhhHHk..',
    '..khhhhhhhhhhk..',
    '..khhhhhhssssk..',
    '..khhhhssssssk..',
    '..khhhsskssksk..',
    '..khhhsskssksk..',
    '..khhssssssssk..',
    '..khsssscsssck..',
    '...kssssssssk...',
    '....kkkkkkkk....',
  ];
  const BODY = [
    '....kbbbbbbk....',
    '...kbbbbbbbbk...',
    '...ksbbbbbbsk...',
    '....kBBBBBBk....',
  ];
  const BODY_UP = [
    '..skbbbbbbbbks..',
    '..kbbbbbbbbbbk..',
    '...kbbbbbbbbk...',
    '....kBBBBBBk....',
  ];
  const BASE_LEGS = {
    stand: ['....kppppppk....', '....kpk..kpk....', '....kpk..kpk....', '....kok..kok....'],
    strideA: ['....kppppppk....', '...kPk....kpk...', '..kPk......kpk..', '..kok......kok..'],
    strideB: ['....kppppppk....', '...kpk....kPk...', '..kpk......kPk..', '..kok......kok..'],
    pass: ['....kppppppk....', '.....kpkkpk.....', '.....kpkkpk.....', '.....kokkok.....'],
    step: ['....kppppppk....', '....kpk.kpppk...', '....kpk..kkk....', '....kok.........'],
    fall: ['....kppppppk....', '...kpk....kpk...', '...kok....kok...', '................'],
  };
  const BASE_CROUCH = ['...kppppppppk...', '...kpk....kpk...', '...kok....kok...'];
  const BLANK = '................';

  // 캐릭터 정의 { pal, ears:[A, B], head, body, bodyUp, legs?, crouch? } → 동작별 프레임 (다리를 안 주면 기본 다리)
  function charFrames(def) {
    if (def.sheet) return sheetFrames(def); // 그림 파일(GIF 시트) 캐릭터
    const f = (...parts) => SF.pixelCanvas([].concat(...parts), def.pal);
    const [A, B] = def.ears;
    const LEGS = def.legs || BASE_LEGS;
    const CROUCH = def.crouch || BASE_CROUCH;
    const right = {
      idle: [f(A, def.head, def.body, LEGS.stand), f(B, def.head, def.body, LEGS.stand)],
      walk: [
        f(A, def.head, def.body, LEGS.strideA), f(B, def.head, def.body, LEGS.pass),
        f(A, def.head, def.body, LEGS.strideB), f(B, def.head, def.body, LEGS.pass),
      ],
      step: [f(B, def.head, def.body, LEGS.step)],
      fall: [f(B, def.head, def.bodyUp, LEGS.fall), f(A, def.head, def.bodyUp, LEGS.fall)],
      land: [f([BLANK], A, def.head, def.body, CROUCH)],
    };
    const left = {};
    for (const k in right) left[k] = right[k].map(mirror);
    return { right, left };
  }
  // ---- 그림 파일 캐릭터 (GIF를 펼친 스프라이트 시트 PNG, dev/gif2sheet.ps1): 한 줄에 같은 크기 칸(cell)으로 그림이 n장
  // 서 있을 때는 GIF처럼 전부 차례로 돌고, 뛸 때는 뛰는 진행도에 맞춰 넘어가고, 떨어질 때는 기울이고, 착지하면 눌린다
  // 그림 파일은 나중에 읽히므로 칸은 먼저 만들고 다 읽히면 채운다 (그동안은 투명)
  const SPAD = 0.12; // 기울여도 안 잘리게 둘레 여백 (칸 크기의 비율)
  const loads = [];
  SF.whenSpritesLoaded = (fn) => { Promise.all(loads).then(fn, fn); };
  function sheetFrames(def) {
    const sh = def.sheet;
    const n = sh.frames, cell = sh.cell;
    const pad = Math.round(cell * SPAD);
    const W = cell + pad * 2, H = cell + pad * 2;
    const dur = (sh.delay || 100) / 1000;
    // [칸 번호, 가로 배율, 세로 배율, 기울기(도), 위로 뜨는 픽셀]
    const all = Array.from({ length: n }, (_, i) => [i, 1, 1, 0, 0]);
    const moves = Object.assign({
      idle: all,
      walk: all,
      step: all.map(([i]) => [i, 0.97, 1.05, 3, cell * 0.04]),
      fall: [[0, 1, 1.03, -8, 0], [0, 1, 1.03, 8, 0]],
      land: [[0, 1.1, 0.86, 0, 0]],
    }, sh.moves || {});
    const img = new Image();
    const jobs = [];
    const make = ([i, sx, sy, deg, lift], flip) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.sc = def.scale;
      c.pb = pad + (def.sink || 0);
      c.smooth = true;
      c.dur = dur;
      c.bw = cell * def.scale; c.bh = cell * def.scale; // 몸 크기 (게임 칸 단위, 테스트용)
      jobs.push(() => {
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.translate(W / 2, H - pad - lift);
        g.rotate((deg * Math.PI) / 180);
        g.scale((flip ? -1 : 1) * sx, sy);
        g.drawImage(img, i * cell, 0, cell, cell, -cell / 2, -cell, cell, cell);
      });
      return c;
    };
    const right = {}, left = {};
    for (const k in moves) { right[k] = moves[k].map((m) => make(m, false)); left[k] = moves[k].map((m) => make(m, true)); }
    loads.push(new Promise((resolve) => {
      img.onload = () => { for (const j of jobs) j(); resolve(); };
      img.onerror = () => { console.warn('캐릭터 그림을 읽지 못했어요: ' + sh.src); resolve(); };
      img.src = sh.src;
    }));
    return { right, left };
  }

  // 화면 픽셀 좌표 (left, top)에 스프라이트를 k배로 그린다. (left, top)은 "16×24 상자"의 왼쪽 위.
  // 옛 16×24 그림은 상자 그대로, 원본 그림(sc가 있는 것)은 자기 크기대로 상자 밑 가운데에 발이 오게 맞춘다
  SF.drawSprite = function (ctx, im, left, top, k) {
    if (!im.sc) { ctx.drawImage(im, left, top, im.width * k, im.height * k); return; }
    const w = im.width * im.sc, h = im.height * im.sc;
    const was = ctx.imageSmoothingEnabled;
    if (im.smooth) ctx.imageSmoothingEnabled = true; // 매끈한 그림은 부드럽게 줄인다 (도트는 그대로)
    ctx.drawImage(im, left + ((16 - w) / 2) * k, top + (24 - h + im.pb * im.sc) * k, w * k, h * k);
    ctx.imageSmoothingEnabled = was;
  };

  const SPROUT = { pal: CHAR_PAL, ears: [SPROUT_A, SPROUT_B], head: HEAD, body: BODY, bodyUp: BODY_UP };

  // ---------------------------------------------------------------- 발판 (16×8: 위 2줄 풀·장식, 아래 6줄이 밟히는 판)
  const SLAB_ART = {
    plank: {
      pal: { g: '#86c94f', G: '#4f8f2e', L: '#eab06a', W: '#c47d3e', d: '#93592a', M: '#9c5e2c', k: '#3b2312' },
      rows: [
        '..g.....g....g..',
        '.gGg...gGg..gGg.',
        'LLLLLLLLLLLLLLLL',
        'WWWWWWWdWWWWWWWW',
        'WWWdWWWWWWWWWdWW',
        'WWWWWWWWWWdWWWWW',
        'MMMMMMMMMMMMMMMM',
        'kkkkkkkkkkkkkkkk',
      ],
    },
    brick: {
      pal: { m: '#7fc24f', M: '#4d8a2e', L: '#e6dfcf', S: '#c6bca8', j: '#8e8474', k: '#4a4238' },
      rows: [
        '....m.......m...',
        '..mMMm.....mMm..',
        'LLLLLLLLLLLLLLLL',
        'SSSSSSSjSSSSSSSj',
        'SSSSSSSjSSSSSSSj',
        'jjjjjjjjjjjjjjjj',
        'SSSjSSSSSSSjSSSS',
        'kkkkkkkkkkkkkkkk',
      ],
    },
    branch: {
      pal: { L: '#bd8a50', B: '#94602f', b: '#6b3e1b', D: '#5c3417', k: '#2c170a' },
      rows: [
        '................',
        '................',
        'LLLLLLLLLLLLLLLL',
        'BBBBBBBBBBBBBBBB',
        'BBBbBBBBBBbBBBBB',
        'BBBBBBBbBBBBBBBB',
        'DDDDDDDDDDDDDDDD',
        'kkkkkkkkkkkkkkkk',
      ],
    },
    goal: {
      pal: { y: '#fffbe0', Y: '#fff2a8', O: '#ffd36b', o: '#e6a93a', A: '#c4892a', k: '#5c3c12' },
      rows: [
        '.y......y.....y.',
        '................',
        'YYYYYYYYYYYYYYYY',
        'OOOOOOOOOOOOOOOO',
        'OOOoOOOOOOOoOOOO',
        'OOOOOOOOOOOOOOOO',
        'AAAAAAAAAAAAAAAA',
        'kkkkkkkkkkkkkkkk',
      ],
    },
  };

  // 끝부분: 모서리를 깎고 옆면 테두리
  function capRows(rows, side) {
    const x = side === 'left' ? 0 : rows[0].length - 1;
    const set = (r, ch) => { const a = rows[r].split(''); a[x] = ch; rows[r] = a.join(''); };
    set(0, '.'); set(1, '.'); set(2, '.'); set(7, '.');
    for (let r = 3; r <= 6; r++) set(r, 'k');
    return rows;
  }

  function slabTiles(art) {
    const pal = art.pal;
    const mid = art.rows.slice();
    return {
      mid: SF.pixelCanvas(mid, pal),
      left: SF.pixelCanvas(capRows(mid.slice(), 'left'), pal),
      right: SF.pixelCanvas(capRows(mid.slice(), 'right'), pal),
      single: SF.pixelCanvas(capRows(capRows(mid.slice(), 'left'), 'right'), pal),
    };
  }

  // ---------------------------------------------------------------- 픽셀 단위로 그리는 큰 그림 (바위·바닥·나무껍질)
  function canvasWith(w, h, paint) {
    const cnv = document.createElement('canvas');
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext('2d');
    const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    paint(ctx, px);
    return cnv;
  }

  function rockSprite() {
    const rng = SF.makeRng(77);
    return canvasWith(16, 32, (ctx, px) => {
      for (let y = 0; y < 32; y++) {
        for (let x = 1; x < 15; x++) {
          const corner = (y < 2 || y > 29) && (x < 3 || x > 12);
          if (corner) continue;
          let col = '#858290';
          if (x < 4) col = '#a9a5b3';
          else if (x > 11) col = '#64616d';
          if (y > 27) col = '#5a5762';
          px(x, y, col);
        }
      }
      for (let i = 0; i < 9; i++) px(3 + rng.int(0, 9), 6 + rng.int(0, 20), '#6f6c78');
      for (let y = 10; y < 16; y++) px(9 + (y % 2), y, '#5a5762');
      // 테두리
      ctx.fillStyle = '#2f2d35';
      ctx.fillRect(0, 2, 1, 28); ctx.fillRect(15, 2, 1, 28);
      ctx.fillRect(2, 31, 12, 1);
      ctx.fillRect(1, 1, 1, 1); ctx.fillRect(14, 1, 1, 1); ctx.fillRect(1, 30, 1, 1); ctx.fillRect(14, 30, 1, 1);
      // 이끼 모자
      for (let x = 1; x < 15; x++) {
        const depth = 2 + rng.int(0, 2) + (x % 5 === 2 ? 2 : 0);
        for (let y = 0; y < depth; y++) px(x, y, y === 0 ? '#9ad65e' : (y < depth - 1 ? '#6fae3a' : '#4d8a2a'));
      }
    });
  }

  function groundTile() {
    const rng = SF.makeRng(31);
    return canvasWith(16, 16, (ctx, px) => {
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 14; i++) px(rng.int(0, 15), rng.int(4, 15), '#4a2e1a');
      for (let i = 0; i < 4; i++) px(rng.int(0, 15), rng.int(5, 15), '#7a5a3a');
      for (let x = 0; x < 16; x++) {
        px(x, 0, '#9ad65e');
        px(x, 1, '#6fae3a');
        px(x, 2, x % 3 === 0 ? '#4d8a2a' : '#6fae3a');
        if (x % 4 === 1) px(x, 3, '#4d8a2a');
      }
    });
  }

  function barkTile() {
    const rng = SF.makeRng(5);
    return canvasWith(16, 64, (ctx, px) => {
      for (let x = 0; x < 16; x++) {
        const shade = rng.int(0, 2);
        const base = ['#3a2a1c', '#413022', '#35261a'][shade];
        ctx.fillStyle = base;
        ctx.fillRect(x, 0, 1, 64);
      }
      for (let k = 0; k < 5; k++) {
        let x = rng.int(1, 14);
        for (let y = 0; y < 64; y++) {
          px(x, y, '#271b11');
          if (rng.chance(0.12)) x = SF.clamp(x + (rng.chance(0.5) ? 1 : -1), 0, 15);
        }
      }
      for (let i = 0; i < 18; i++) px(rng.int(0, 15), rng.int(0, 63), '#57402c');
    });
  }

  function flagFrames() {
    const pal = { w: '#efe6cc', W: '#b3aa92', y: '#ffd36b', g: '#4fbf5a', G: '#2f8f3e', s: '#ffffff' };
    const pole = (rows) => rows.concat(Array(20).fill('.wW.............'));
    // 초록 깃발에 흰 잎사귀 무늬
    const a = pole([
      '.yy.............',
      '.yy.............',
      '.wWggggggggg....',
      '.wWgggggggsgG...',
      '.wWggggggssgGg..',
      '.wWgggggssggG...',
      '.wWggggsgggg....',
      '.wW.............',
    ]);
    const b = pole([
      '.yy.............',
      '.yy.............',
      '.wWgggggggg.....',
      '.wWggggggsggG...',
      '.wWgggggssgGGg..',
      '.wWggggssggGgg..',
      '.wWgggsgggg.....',
      '.wW.............',
    ]);
    return [SF.pixelCanvas(a, pal), SF.pixelCanvas(b, pal)];
  }

  const DECO = {
    tuft: { pal: { g: '#86c94f', G: '#4f8f2e' }, rows: ['g..g.', '.gGg.', 'gGgGg'] },
    flowerPink: { pal: { p: '#ff8fb3', y: '#ffe066', G: '#4f8f2e' }, rows: ['.p.', 'pyp', '.p.', '.G.'] },
    flowerWhite: { pal: { p: '#fff4e0', y: '#ffb84d', G: '#4f8f2e' }, rows: ['.p.', 'pyp', '.p.', '.G.'] },
    flowerYellow: { pal: { p: '#ffd84d', y: '#c2671f', G: '#4f8f2e' }, rows: ['.p.', 'pyp', '.p.', '.G.'] },
    mushroom: { pal: { r: '#e0503a', w: '#fff3e0', s: '#f2e2c4', k: '#5a2a1a' }, rows: ['.rrrr.', 'rrwrrr', 'rwrrwr', 'kkkkkk', '..ss..', '..ss..'] },
    leaves: { pal: { l: '#7cc24a', e: '#467f28' }, rows: ['.ll..', 'lell.', '.lell', '..l..'] },
  };

  // ---------------------------------------------------------------- 장애물 (오리지널 그림)
  // 가시공: 둥근 몸 + 가시 8개. 프레임마다 가시를 22.5도씩 돌려 굴러가는 느낌
  function spikeBallFrames() {
    const frames = [];
    for (let f = 0; f < 2; f++) {
      frames.push(canvasWith(14, 14, (ctx, px) => {
        const cx = 6.5, cy = 6.5;
        for (let y = 0; y < 14; y++) {
          for (let x = 0; x < 14; x++) {
            const dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy);
            if (r <= 3.6) px(x, y, dx + dy < -2 ? '#c9c4d4' : dx + dy > 2.5 ? '#55515f' : '#8a8696');
            else if (r <= 4.5) px(x, y, '#2a2730');
          }
        }
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + f * Math.PI / 8;
          for (const rr of [5, 6]) px(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), rr === 6 ? '#f2eef8' : '#b8b4c2');
        }
      }));
    }
    return frames;
  }

  const MONKEY_PAL = { k: '#2b1a10', f: '#8a5a32', F: '#5e3a1e', c: '#f1c9a0', y: '#ffd84d', Y: '#c99a1a' };
  const MONKEY = [
    '................',
    '....kkkkkk......',
    '...kffffffk.....',
    '.kkfccccccfkk...',
    '.kfkcckckcfkf...',
    '..kkccccccckk...',
    '...kcckkkcck....',
    '....kccccck.....',
    '...kffffffffk...',
    '..kfffccccfffk..',
    '..kffccccccffk..',
    '..kffccccccffk.k',
    '...kffffffffk.kf',
    '...kfk....kfk.kf',
    '...kkk....kkkkf.',
    '................',
  ];
  function withPixels(rows, edits) {
    const out = rows.map((r) => r.split(''));
    for (const [x, y, ch] of edits) out[y][x] = ch;
    return out.map((r) => r.join(''));
  }
  function monkeyFrames() {
    const ready = withPixels(MONKEY, [
      [12, 7, 'k'], [13, 6, 'f'], [13, 5, 'f'], [14, 4, 'f'], [12, 6, 'k'], [14, 5, 'k'], [15, 4, 'k'],
      [13, 2, 'y'], [14, 2, 'y'], [15, 3, 'y'], [14, 1, 'Y'], [13, 3, 'k'], [12, 2, 'k'],
    ]);
    const thrown = withPixels(MONKEY, [[13, 8, 'f'], [14, 8, 'f'], [15, 8, 'c'], [13, 9, 'k'], [14, 9, 'k'], [15, 9, 'k'], [13, 7, 'k'], [14, 7, 'k']]);
    const right = { idle: SF.pixelCanvas(MONKEY, MONKEY_PAL), ready: SF.pixelCanvas(ready, MONKEY_PAL), throw: SF.pixelCanvas(thrown, MONKEY_PAL) };
    const left = {};
    for (const k in right) left[k] = mirror(right[k]);
    return { right, left };
  }

  function flipV(src) {
    const cnv = document.createElement('canvas');
    cnv.width = src.width;
    cnv.height = src.height;
    const ctx = cnv.getContext('2d');
    ctx.translate(0, src.height);
    ctx.scale(1, -1);
    ctx.drawImage(src, 0, 0);
    return cnv;
  }

  function bananaFrames() {
    const a = SF.pixelCanvas([
      '......kk',
      '.....kyk',
      'kk..kyyk',
      'kykkyyk.',
      '.kyyyk..',
      '..kkk...',
    ], { k: '#5a3a10', y: '#ffd84d' });
    return [a, mirror(a), flipV(mirror(a)), flipV(a)];
  }

  const ACORN = ['..kk..', '.kCCk.', 'kCcCCk', 'kkkkkk', 'knhnnk', 'knnnNk', '.kNNk.', '..kk..'];
  const ACORN_PAL = { k: '#3a2210', C: '#7a4a22', c: '#9a6232', n: '#c9873a', N: '#a5682a', h: '#f0c27a' };
  const CRACK = [
    '................',
    '................',
    '....k.....k.....',
    '...k.k...k......',
    '..k...k.k...k...',
    '.......k...k.k..',
    '......k.....k...',
    '................',
  ];

  // 퀴즈 표지판 (12×14): 나무 판에 "?" (아직) / "✓" (푼 퀴즈)
  const SIGN_PAL = { k: '#3a2210', w: '#c9873a', W: '#e8b066', p: '#6b4423', y: '#ffe08a', g: '#9be37f' };
  const SIGN_Q = [
    '.kkkkkkkkkk.',
    'kWWWWWWWWWWk',
    'kWwwwyyywwwk',
    'kWwwyywyywwk',
    'kWwwwwwyywwk',
    'kWwwwwyywwwk',
    'kWwwwwyywwwk',
    'kWwwwwwwwwwk',
    'kWwwwwyywwwk',
    '.kkkkkkkkkk.',
    '.....kp.....',
    '.....kp.....',
    '.....kp.....',
    '....kkpk....',
  ];
  const SIGN_OK = [
    '.kkkkkkkkkk.',
    'kWWWWWWWWWWk',
    'kWwwwwwwwggk',
    'kWwwwwwwgggk',
    'kWwgwwwgggwk',
    'kWwggwgggwwk',
    'kWwwgggggwwk',
    'kWwwwgggwwwk',
    'kWwwwwgwwwwk',
    '.kkkkkkkkkk.',
    '.....kp.....',
    '.....kp.....',
    '.....kp.....',
    '....kkpk....',
  ];

  SF.buildSprites = function () {
    const slab = {};
    for (const k in SLAB_ART) slab[k] = slabTiles(SLAB_ART[k]);
    const deco = {};
    for (const k in DECO) deco[k] = SF.pixelCanvas(DECO[k].rows, DECO[k].pal);
    const characters = {};
    for (const c of SF.CHARACTERS || []) characters[c.id] = charFrames(c);
    return {
      player: charFrames(SPROUT), // 캐릭터를 못 찾을 때 쓰는 기본 '새싹이'
      characters,
      slab,
      rock: rockSprite(),
      ground: groundTile(),
      bark: barkTile(),
      flag: flagFrames(),
      deco,
      spikeBall: spikeBallFrames(),
      monkey: monkeyFrames(),
      banana: bananaFrames(),
      acorn: SF.pixelCanvas(ACORN, ACORN_PAL),
      crack: SF.pixelCanvas(CRACK, { k: '#2a170a' }),
      sign: { ask: SF.pixelCanvas(SIGN_Q, SIGN_PAL), done: SF.pixelCanvas(SIGN_OK, SIGN_PAL) },
    };
  };

  // ---------------------------------------------------------------- 높이별 배경 색 (0 아래 → 1 꼭대기)
  const KEYS = [
    { base: [43, 27, 16], grain: [58, 37, 22], dark: [26, 16, 9], light: [82, 53, 30], accent: [196, 148, 82] },
    { base: [31, 38, 20], grain: [43, 53, 27], dark: [18, 24, 11], light: [70, 90, 40], accent: [150, 210, 90] },
    { base: [66, 49, 24], grain: [88, 66, 31], dark: [38, 28, 13], light: [150, 116, 52], accent: [255, 220, 120] },
  ];
  SF.bgPaletteRGB = function (frac) {
    const f = SF.clamp(frac, 0, 1) * (KEYS.length - 1);
    const i = Math.min(KEYS.length - 2, Math.floor(f));
    const t = f - i;
    const out = {};
    for (const k in KEYS[0]) out[k] = KEYS[i][k].map((v, j) => Math.round(SF.lerp(v, KEYS[i + 1][k][j], t)));
    return out;
  };
  SF.bgPalette = function (frac) {
    const p = SF.bgPaletteRGB(frac);
    const out = {};
    for (const k in p) out[k] = 'rgb(' + p[k].join(',') + ')';
    return out;
  };
})(window.SF);

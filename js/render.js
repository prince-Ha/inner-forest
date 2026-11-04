// 그리기. 월드 좌표(y 위쪽 +) → 화면 픽셀: sx = (x + offX) * zoom, sy = (cameraTop - y) * zoom
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const CELL = SF.CELL;
  const STYLE = SF.STYLE;
  const SLAB_NAME = {
    [STYLE.PLANK]: 'plank', [STYLE.BRICK]: 'brick', [STYLE.BRANCH]: 'branch', [STYLE.GOAL]: 'goal',
  };
  const PARALLAX = 0.5;   // 배경은 카메라의 절반 속도로 움직인다
  const BG_H = 256;       // 배경 조각 높이

  // 결 무늬용 값 노이즈
  function hash1(n) {
    let h = Math.imul(n | 0, 374761393);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise1(x) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash1(i) * (1 - u) + hash1(i + 1) * u;
  }
  const rgb = (c, a) => (a === undefined ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + a + ')');

  SF.createRenderer = function (canvas, cfg) {
    const ctx = canvas.getContext('2d');
    const cs = cfg.world.cell;
    const innerW = (cfg.world.cols - 2) * cs;
    const S = SF.buildSprites();
    let level = null;
    let vp = null;
    let decor = [];
    let worldTop = 1;
    let gustBands = []; // 돌풍 구간의 높이 범위 [y0, y1]
    let quizFloors = [];
    let quizTreads = new Map(); // 퀴즈 층 → 그 층 디딤판
    const heightFrac = (y) => y / worldTop; // 0 바닥 → 1 꼭대기 (배경색·햇살)
    const bgCache = new Map();

    // ------------------------------------------------------------ 배경 조각 (안쪽 폭 × 256, 높이에 따라 색이 바뀜)
    function makeBgChunk(k) {
      const W = innerW, H = BG_H;
      const cnv = document.createElement('canvas');
      cnv.width = W;
      cnv.height = H;
      const c = cnv.getContext('2d');
      const img = c.createImageData(W, H);
      const d = img.data;
      const pals = [];
      for (let y = 0; y < H; y++) {
        const b = (k + 1) * H - y;
        const P = SF.bgPaletteRGB(heightFrac(b / PARALLAX));
        pals.push(P);
        for (let x = 0; x < W; x++) {
          const wob = 2.5 * Math.sin(b / 29 + x / 53) + 1.2 * Math.sin(b / 11 + x / 9);
          const v = 0.6 * noise1((x + wob) / 3 + 17) + 0.4 * noise1((x + wob) / 13 + 101);
          const col = v > 0.66 ? P.grain : v < 0.24 ? P.dark : P.base;
          const i = (y * W + x) * 4;
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      const rng = SF.makeRng(1000 + k * 7919);
      const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };

      // 옹이
      const knots = rng.int(1, 2);
      for (let n = 0; n < knots; n++) {
        const cx = rng.int(14, W - 14), cy = rng.int(16, H - 16), rx = rng.int(4, 7), ry = rng.int(7, 12);
        const P = pals[cy];
        for (let y = -ry; y <= ry; y++) {
          for (let x = -rx; x <= rx; x++) {
            const dist = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2);
            if (dist > 1) continue;
            const ring = Math.floor(dist * 4);
            px(cx + x, cy + y, rgb(dist < 0.25 ? P.dark : ring % 2 ? P.grain : P.light));
          }
        }
      }
      // 구멍 속 빛나는 버섯
      if (rng.chance(0.55)) {
        const cx = rng.int(18, W - 18), cy = rng.int(24, H - 24), rx = rng.int(7, 10), ry = rng.int(10, 14);
        const P = pals[cy];
        for (let y = -ry; y <= ry; y++) {
          for (let x = -rx; x <= rx; x++) {
            const dist = (x / rx) ** 2 + (y / ry) ** 2;
            if (dist <= 1) px(cx + x, cy + y, rgb(dist > 0.8 ? P.grain : P.dark.map((v) => v >> 1)));
          }
        }
        // 구멍 바닥에 키가 다른 버섯 세 개 (갓 2줄 + 줄기) — 눈처럼 보이지 않게 아래쪽에 모은다
        const floorY = cy + Math.floor(ry * 0.75);
        [[-4, 4], [0, 6], [4, 3]].forEach(([dx, hgt]) => {
          const mx = cx + dx, capY = floorY - hgt;
          c.fillStyle = rgb(P.accent, 0.18);
          c.fillRect(mx - 3, capY - 2, 7, hgt + 3);
          for (let s = 1; s <= hgt; s++) px(mx, capY + s, rgb(P.light));
          px(mx - 1, capY, rgb(P.accent)); px(mx, capY, rgb(P.accent)); px(mx + 1, capY, rgb(P.accent));
          px(mx - 2, capY + 1, rgb(P.accent)); px(mx + 2, capY + 1, rgb(P.accent));
          px(mx - 1, capY + 1, rgb(P.accent)); px(mx + 1, capY + 1, rgb(P.accent));
        });
      }
      // 매달린 덩굴 (배경, 어둡게)
      const vines = rng.int(1, 3);
      for (let n = 0; n < vines; n++) {
        let x = rng.int(4, W - 4);
        const len = rng.int(30, 110);
        const y0 = rng.int(0, H - 20);
        const P = pals[y0];
        const stem = rgb([Math.round(P.dark[0] * 0.8), Math.round(P.light[1] * 0.75), Math.round(P.dark[2] * 0.8)]);
        const leaf = rgb([Math.round(P.grain[0] * 0.9), Math.round(P.accent[1] * 0.55), Math.round(P.grain[2] * 0.8)]);
        for (let y = 0; y < len && y0 + y < H; y++) {
          px(x, y0 + y, stem);
          if (y % 4 === 2) px(x + (y % 8 === 2 ? 1 : -1), y0 + y, leaf);
          if (rng.chance(0.06)) x += rng.chance(0.5) ? 1 : -1;
        }
      }
      return cnv;
    }

    function bgChunk(k) {
      let c = bgCache.get(k);
      if (!c) { c = makeBgChunk(k); bgCache.set(k, c); }
      return c;
    }

    // ------------------------------------------------------------ 장식 목록 (맵마다 한 번, 디딤판 번호로 시드)
    function buildDecor(l) {
      const out = [];
      const g = l.grid;
      const free = (c, r) => g.get(c, r + 1) === CELL.EMPTY;
      l.treads.forEach((t, i) => {
        const rng = SF.makeRng((l.seed * 31 + i * 977) >>> 0);
        const st = g.getStyle(t.c0, t.row);
        const top = t.row * cs;
        const cols = [];
        for (let c = t.c0; c <= t.c1; c++) if (free(c, t.row)) cols.push(c);
        if (!cols.length) return;
        const spot = (w) => rng.pick(cols) * cs + rng.int(0, cs - w);
        if (st === STYLE.PLANK || st === STYLE.BRICK) {
          const n = rng.int(0, 2);
          for (let k = 0; k < n; k++) out.push({ img: S.deco.tuft, x: spot(5), y: top, layer: 1 });
          if (rng.chance(st === STYLE.PLANK ? 0.45 : 0.2)) {
            out.push({ img: rng.pick([S.deco.flowerPink, S.deco.flowerWhite, S.deco.flowerYellow]), x: spot(3), y: top, layer: 1 });
          }
        }
        if (t.isLanding && st !== STYLE.GOAL && rng.chance(0.5)) {
          out.push({ img: S.deco.mushroom, x: spot(6), y: top, layer: 1 });
        }
        if (st === STYLE.BRANCH) {
          if (rng.chance(0.6)) out.push({ img: S.deco.leaves, x: t.c0 * cs - 2, y: top - 2, layer: 1 });
          if (rng.chance(0.6)) out.push({ img: S.deco.leaves, x: (t.c1 + 1) * cs - 3, y: top - 2, layer: 1 });
        }
        if ((st === STYLE.BRICK || st === STYLE.BRANCH) && rng.chance(0.35)) {
          out.push({ vine: true, x: rng.pick(cols) * cs + rng.int(2, 13), y: top - 6, len: rng.int(6, 16), layer: 0 });
        }
      });
      return out;
    }

    const r = {};
    r.sprites = S; // 처음 화면의 캐릭터 고르기·증명서 그림에도 쓴다
    r.setLevel = (l) => {
      level = l;
      decor = buildDecor(l);
      bgCache.clear();
      worldTop = (l.goalRow + 2) * cs;
      quizFloors = SF.quizFloors ? SF.quizFloors(cfg) : [];
      quizTreads = new Map(quizFloors.map((f) => [f, l.treads.find((t) => t.row === f - 1)]));
      gustBands = [];
      let from = 0;
      for (const z of cfg.zones) {
        if (z.hazards && z.hazards.gust) gustBands.push([from * cs - 8, z.untilFloor * cs + 24]);
        from = z.untilFloor;
      }
    };
    r.resize = (v) => {
      vp = v;
      canvas.width = v.canvasW;
      canvas.height = v.canvasH;
      ctx.imageSmoothingEnabled = false;
    };

    // 동작 고르기: 뛰는 중(오르기 = 다리 든 모습, 옆걸음 = 걷기) / 떨어지는 중 / 착지 / 서 있기
    function pickFrame(p, move, anim, time, charId) {
      const who = (charId && S.characters[charId]) || S.player;
      const set = p.facing < 0 ? who.left : who.right;
      if (move.mode === 'hop') return move.kind === 'climb' ? set.step[0] : set.walk[anim.steps % 4];
      if (!p.grounded && anim.airT > 0.06) return set.fall[Math.floor(time * 8) % 2];
      if (anim.landT < 0.1) return set.land[0];
      return set.idle[Math.floor(time * 2) % 2];
    }

    // 말풍선: 흰 둥근 상자 + 꼬리, 너무 길면 두 줄로
    function drawBubble(b, p, sx, sy, z, cs) {
      const alpha = Math.min(1, (b.life - b.age) / 0.25, b.age / 0.08);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = 'bold ' + Math.round(6.5 * z) + 'px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      const words = b.text.split(' ');
      const maxW = 110 * z;
      const lines = [''];
      for (const w of words) {
        const tryLine = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
        if (ctx.measureText(tryLine).width > maxW && lines[lines.length - 1]) lines.push(w);
        else lines[lines.length - 1] = tryLine;
      }
      const lineH = 8.5 * z, padX = 5 * z, padY = 3.5 * z;
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
      const h = lines.length * lineH + padY * 2;
      const headX = sx(p.x + p.w / 2), headY = sy(p.y + p.h + 6);
      const left = Math.min(Math.max(headX - w / 2, sx(cs) + 2 * z), sx((cfg.world.cols - 1) * cs) - w - 2 * z);
      const top = headY - h - 4 * z;
      ctx.fillStyle = '#fffaf0';
      ctx.strokeStyle = '#3a2210';
      ctx.lineWidth = Math.max(1, z * 0.75);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(left, top, w, h, 3 * z); else ctx.rect(left, top, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(headX - 3 * z, top + h - 0.5);
      ctx.lineTo(headX, top + h + 4 * z);
      ctx.lineTo(headX + 3 * z, top + h - 0.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3a2210';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, left + w / 2, top + padY + lineH * (i + 0.5)));
      ctx.restore();
    }

    r.draw = (frame) => {
      if (!vp || !level) return;
      const z = vp.zoom;
      const offX = vp.worldOffsetX + (frame.shake ? frame.shake.x : 0);
      const top = frame.cameraTop + (frame.shake ? frame.shake.y : 0);
      const bottom = top - vp.viewH;
      const sx = (x) => Math.round((x + offX) * z);
      const sy = (y) => Math.round((top - y) * z);
      const img = (im, x, yTop) => (im.sc ? SF.drawSprite(ctx, im, sx(x), sy(yTop), z) : ctx.drawImage(im, sx(x), sy(yTop), im.width * z, im.height * z));
      const g = level.grid;

      // 1) 배경 (패럴랙스)
      const bgTop = top * PARALLAX;
      const k0 = Math.floor((bgTop - vp.viewH) / BG_H), k1 = Math.floor(bgTop / BG_H);
      for (let k = k0; k <= k1; k++) {
        const c = bgChunk(k);
        // 위·아래 경계를 정수 픽셀로 맞추고 1픽셀 겹쳐 그린다 (확대 배율이 소수면 조각 사이에 줄이 생긴다)
        const y0 = Math.round((bgTop - (k + 1) * BG_H) * z), y1 = Math.round((bgTop - k * BG_H) * z);
        ctx.drawImage(c, sx(cs), y0, c.width * z, y1 - y0 + 1);
      }

      // 2) 꼭대기 근처 햇살
      const sun = SF.clamp((heightFrac(top) - 0.55) / 0.45, 0, 1);
      if (sun > 0) {
        ctx.fillStyle = 'rgba(255, 238, 170, ' + (0.11 * sun).toFixed(3) + ')';
        for (let i = 0; i < 3; i++) {
          const x0 = sx(cs + 20 + i * 52 + 8 * Math.sin(frame.time * 0.3 + i));
          ctx.beginPath();
          ctx.moveTo(x0, 0);
          ctx.lineTo(x0 + 22 * z, 0);
          ctx.lineTo(x0 - 30 * z, canvas.height);
          ctx.lineTo(x0 - 52 * z, canvas.height);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 3) 벽(나무껍질)과 화면 밖 여백
      const bark = S.bark;
      const t0 = Math.floor(bottom / bark.height) - 1, t1 = Math.floor(top / bark.height) + 1;
      const extra = Math.ceil(Math.max(0, vp.worldOffsetX) / cs) + 1;
      for (let c = -extra; c < cfg.world.cols + extra; c++) {
        if (c > 0 && c < cfg.world.cols - 1) continue;
        for (let t = t0; t <= t1; t++) img(bark, c * cs, (t + 1) * bark.height);
      }
      // 벽 안쪽 모서리: 밝은 테두리 + 그림자
      ctx.fillStyle = '#5c4430';
      ctx.fillRect(sx(cs) - z, 0, z, canvas.height);
      ctx.fillRect(sx((cfg.world.cols - 1) * cs), 0, z, canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(sx(cs), 0, 2 * z, canvas.height);
      ctx.fillRect(sx((cfg.world.cols - 1) * cs) - 2 * z, 0, 2 * z, canvas.height);

      // 4) 바닥
      if (bottom < 16) {
        for (let c = 1; c < cfg.world.cols - 1; c++) img(S.ground, c * cs, 0);
        ctx.fillStyle = '#3a2414';
        const yb = sy(-cs);
        if (yb < canvas.height) ctx.fillRect(sx(cs), yb, innerW * z, canvas.height - yb);
      }

      const visible = (y) => y > bottom - 40 && y < top + 40;

      // 5) 뒤쪽 장식: 발판 아래 덩굴
      for (const d of decor) {
        if (!d.vine || !visible(d.y)) continue;
        for (let i = 0; i < d.len; i++) {
          ctx.fillStyle = i % 3 === 1 ? '#7cc24a' : '#3f7a26';
          const X = d.x + (i % 3 === 1 ? (i % 6 === 1 ? 1 : -1) : 0);
          ctx.fillRect(sx(X), sy(d.y - i), z, z);
        }
      }

      // 6) 발판과 바위. 금 간 발판은 금이 보이고, 밟으면 흔들리고, 다시 생기기 직전엔 희미하게 보인다
      const clock = frame.clock || 0;
      const crumbles = frame.crumbles ? frame.crumbles.tiles : null;
      const C = cfg.obstacles.crumble;
      const rLo = Math.max(1, Math.floor(bottom / cs) - 1), rHi = Math.ceil(top / cs) + 1;
      for (let row = rLo; row <= rHi; row++) {
        for (let c = 1; c < cfg.world.cols - 1; c++) {
          const tile = crumbles && crumbles.get(c + ',' + row);
          const ghost = tile && tile.broken && tile.t > SF.crumbleDelay(tile, cfg) + C.respawn - 0.6;
          if (g.get(c, row) !== CELL.SLAB && !ghost) continue;
          const tiles = S.slab[SLAB_NAME[ghost ? tile.style : g.getStyle(c, row)] || 'plank'];
          const L = g.get(c - 1, row) === CELL.SLAB, R = g.get(c + 1, row) === CELL.SLAB;
          const shakeX = tile && !tile.broken && tile.t >= 0 ? Math.round(Math.sin(tile.t * 90)) : 0;
          if (ghost) ctx.globalAlpha = 0.35;
          img(L && R ? tiles.mid : L ? tiles.right : R ? tiles.left : tiles.single, c * cs + shakeX, row * cs + 2);
          ctx.globalAlpha = 1;
          if (tile && !tile.broken) img(S.crack, c * cs + shakeX, row * cs + 2);
        }
      }
      for (const rk of level.rocks) {
        const yTop = (rk.row + 1) * cs;
        if (visible(yTop)) img(S.rock, rk.col * cs, yTop);
      }

      // 7) 정상 깃발
      const goal = level.treads[level.treads.length - 1];
      if (visible(goal.row * cs)) {
        const flag = S.flag[Math.floor(frame.time * 3) % 2];
        const fx = goal.dirIn > 0 ? (goal.c1 + 1) * cs - 14 : goal.c0 * cs + 1;
        img(flag, fx, goal.row * cs + flag.height);
      }

      // 8) 앞쪽 장식
      for (const d of decor) {
        if (d.vine || !visible(d.y)) continue;
        img(d.img, d.x, d.y + d.img.height);
      }

      // 8-a) 퀴즈 표지판: 아직 안 푼 층은 "?", 푼 층은 "✓"
      for (const f of quizFloors) {
        const t = quizTreads.get(f);
        if (!t || !visible(t.row * cs)) continue;
        const done = frame.quiz && frame.quiz.done.has(f);
        img(done ? S.sign.done : S.sign.ask, t.c0 * cs + 2, t.row * cs + 14);
      }

      // 8-b) 장애물 받침: 가시공 줄, 벽 가지 위 원숭이, 도토리 열린 가지와 떨어질 자리 그림자
      const wallR = (cfg.world.cols - 1) * cs;
      for (const h of level.hazards || []) {
        const y0 = h.row * cs;
        if (h.kind === 'spikeBall') {
          if (!visible(y0)) continue;
          // 공이 오가는 덩굴 줄 (양 끝에 매듭)
          const y = y0 + 11, xa = h.c0 * cs + 3, xb = h.c1 * cs + 13;
          ctx.fillStyle = '#b08850';
          ctx.fillRect(sx(xa), sy(y + 1), (xb - xa) * z, z);
          ctx.fillStyle = '#4a3020';
          ctx.fillRect(sx(xa), sy(y), (xb - xa) * z, z);
          ctx.fillStyle = '#d9b27a';
          ctx.fillRect(sx(xa - 1), sy(y + 2), 3 * z, 4 * z);
          ctx.fillRect(sx(xb - 2), sy(y + 2), 3 * z, 4 * z);
        } else if (h.kind === 'monkey') {
          if (!visible(y0)) continue;
          const onRight = h.side > 0;
          const bx = onRight ? wallR - 12 : cs;
          ctx.fillStyle = '#5e3a1e';
          ctx.fillRect(sx(bx), sy(y0 + 5), 12 * z, 3 * z);
          ctx.fillStyle = '#8a5a32';
          ctx.fillRect(sx(bx), sy(y0 + 5), 12 * z, z);
          const set = onRight ? S.monkey.left : S.monkey.right;
          img(set[SF.monkeyPose(h, cfg, clock)], onRight ? wallR - 15 : cs - 1, y0 + 20);
        } else if (h.kind === 'acorn') {
          const ty = h.topRow * cs + 8, cx = h.col * cs + 8;
          if (visible(ty)) {
            ctx.fillStyle = '#2f5a1c';
            ctx.fillRect(sx(cx - 6), sy(ty + 7), 12 * z, 4 * z);
            ctx.fillStyle = '#4f8a2e';
            ctx.fillRect(sx(cx - 4), sy(ty + 8), 8 * z, 2 * z);
            ctx.fillStyle = '#5e3a1e';
            ctx.fillRect(sx(cx), sy(ty + 4), z, 3 * z);
          }
          const u = clock * (h.speed || 1); // 장애물 자기 시각 (빠른 구간은 빨리 감긴다)
          if (visible(y0) && u >= h.phase) {
            // 떨어지는 동안 발판 위 그림자가 점점 진해진다 (어디로 떨어질지 미리 보인다)
            const A = cfg.obstacles.acorn;
            const fallT = (ty - (y0 + 3)) / A.speed;
            const dt = ((u - h.phase) % A.period + A.period) % A.period;
            if (dt < fallT) {
              ctx.fillStyle = 'rgba(30, 15, 5, ' + (0.15 + 0.45 * dt / fallT).toFixed(3) + ')';
              ctx.fillRect(sx(cx - 3), sy(y0 + 1), 6 * z, z);
            }
          }
        }
      }

      // 9) 반딧불·나뭇잎 (분위기)
      for (let i = 0; i < 10; i++) {
        const fx = cs + innerW * ((i * 0.271 + 0.04 * Math.sin(frame.time * 0.5 + i * 2) + 1) % 1);
        const fy = top - vp.viewH * ((i * 0.137 + 0.03 * Math.sin(frame.time * 0.7 + i) + 1) % 1);
        const P = SF.bgPaletteRGB(heightFrac(fy));
        const glow = 0.35 + 0.35 * Math.sin(frame.time * 2.5 + i * 1.3);
        ctx.fillStyle = rgb(P.accent, (glow * 0.35).toFixed(3));
        ctx.fillRect(sx(fx - 1), sy(fy + 1), 3 * z, 3 * z);
        ctx.fillStyle = rgb(P.accent, (0.5 + glow).toFixed(3));
        ctx.fillRect(sx(fx), sy(fy), z, z);
      }

      // 9-b) 돌풍: 예고 때는 나뭇잎이 바람 쪽으로 날리기 시작하고, 바람이 불면 하얀 줄무늬가 빠르게 지나간다
      const gu = frame.gust && frame.gust.at;
      if (gu && gu.phase !== 'calm' && gustBands.length) {
        const blow = gu.phase === 'blow';
        const fade = blow ? Math.min(1, (1 - gu.s) / 0.2) : gu.s;
        const span = innerW + 40;
        for (let i = 0; i < 42; i++) {
          const y = bottom + vp.viewH * hash1(i * 7 + 1);
          if (!gustBands.some(([a, b]) => y >= a && y <= b)) continue;
          const speed = blow ? 300 + 160 * hash1(i * 3 + 2) : 50;
          const xx = ((hash1(i * 13 + 5) * span + gu.dir * speed * frame.time) % span + span) % span;
          const x = cs - 20 + xx;
          if (blow && i % 3) {
            ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * fade).toFixed(3) + ')';
            ctx.fillRect(sx(x), sy(y), Math.round((16 + 22 * hash1(i * 5 + 3)) * z), z);
          } else if (i % 3 === 0) {
            ctx.fillStyle = i % 2 ? 'rgba(124,194,74,' + fade.toFixed(3) + ')' : 'rgba(230,190,70,' + fade.toFixed(3) + ')';
            ctx.fillRect(sx(x), sy(y + 2 * Math.sin(frame.time * 9 + i)), 2 * z, 2 * z);
          }
        }
      }

      // 10) 먼지 입자
      for (const pa of frame.particles) {
        ctx.globalAlpha = Math.max(0, 1 - pa.age / pa.life);
        ctx.fillStyle = pa.color;
        ctx.fillRect(sx(pa.x), sy(pa.y), pa.size * z, pa.size * z);
      }
      ctx.globalAlpha = 1;

      // 10-1) 같은 방 친구들 (room.js, 반투명): 내 캐릭터보다 뒤에
      if (SF.drawGhosts) SF.drawGhosts(ctx, { sx, sy, z, top, bottom, time: frame.time, level, sprites: S });

      // 11) 캐릭터: 뛰는 중에는 포물선으로 살짝 떠오르고, 부딪히면 잠깐 흔들린다
      const p = frame.player;
      const a = frame.anim;
      const mv = frame.move;
      const arc = mv.mode === 'hop' ? Math.sin(Math.PI * mv.k) * (mv.kind === 'climb' ? 5 : 3) : 0;
      let wobble = a.bumpT < 0.12 ? Math.round(Math.sin(a.bumpT * 70)) * p.facing : 0;
      // 바람 속에 서 있으면 바람 쪽으로 기울고, 밀리기 직전엔 덜덜 떤다
      const gw = frame.gust;
      if (gw && gw.here && gw.at.phase === 'blow' && p.grounded && mv.mode === 'idle' && gw.hold > 0) {
        wobble += gw.at.dir * (gw.hold > 0.4 ? 1 : 0) + (gw.hold > 0.6 ? Math.round(Math.sin(frame.time * 60)) : 0);
      }
      // 맞은 뒤 무적 시간에는 깜빡인다
      if (!frame.blink || Math.floor(frame.time * 16) % 2) {
        img(pickFrame(p, mv, a, frame.time, frame.charId), p.x - (16 - p.w) / 2 + wobble, p.y + arc + 24);
      }

      // 움직이는 장애물: 가시공, 바나나, 도토리 (캐릭터 앞에 그린다)
      const shapes = SF.hazardShapes(level, cfg, clock, { r0: rLo - 1, r1: rHi + 1 });
      for (const s of shapes) {
        if (s.kind === 'spikeBall') img(S.spikeBall[Math.floor(s.spin) % 2], s.x - 7, s.y + 7);
        else if (s.kind === 'banana') img(S.banana[Math.floor(s.spin) % 4], s.x - 4, s.y + 3);
        else if (s.kind === 'acorn') img(S.acorn, s.x - 3, s.y + 4);
        else if (s.kind === 'acornSplat') {
          // 깨진 도토리 조각이 양옆으로 튄다
          const d = 2 + s.age * 30;
          ctx.fillStyle = '#7a4a22';
          ctx.fillRect(sx(s.x - d), sy(s.y + 2), 2 * z, 2 * z);
          ctx.fillRect(sx(s.x + d - 2), sy(s.y + 2), 2 * z, 2 * z);
          ctx.fillStyle = '#c9873a';
          ctx.fillRect(sx(s.x - d / 2), sy(s.y + 3 + s.age * 10), z, z);
          ctx.fillRect(sx(s.x + d / 2), sy(s.y + 3 + s.age * 10), z, z);
        }
      }

      // 콤보 축하: 캐릭터 둘레로 퍼지는 금빛 고리
      if (a.flashT < 0.45) {
        const t = a.flashT / 0.45;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = '#ffd36b';
        ctx.lineWidth = Math.max(1, z);
        ctx.beginPath();
        ctx.arc(sx(p.x + p.w / 2), sy(p.y + p.h / 2), (8 + t * 18) * z, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (frame.debug && frame.debug.hitbox) {
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = Math.max(1, z / 2);
        ctx.strokeRect(sx(p.x), sy(p.y + p.h), p.w * z, p.h * z);
        const hb = SF.playerHazardBox(p);
        ctx.strokeStyle = '#ffcc00';
        ctx.strokeRect(sx(hb.x0), sy(hb.y1), (hb.x1 - hb.x0) * z, (hb.y1 - hb.y0) * z);
        for (const s of shapes) {
          if (s.harmless) continue;
          const half = s.r || s.half;
          ctx.strokeRect(sx(s.x - half), sy(s.y + half), half * 2 * z, half * 2 * z);
        }
      }

      // 12) "-N층!" 글자
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(10 * z) + 'px system-ui, sans-serif';
      ctx.lineWidth = Math.max(2, z);
      ctx.lineJoin = 'round';
      for (const pop of frame.popups) {
        ctx.globalAlpha = Math.max(0, 1 - pop.age / pop.life);
        const X = sx(pop.x), Y = sy(pop.y + pop.age * 18);
        ctx.strokeStyle = '#2a1206';
        ctx.strokeText(pop.text, X, Y);
        ctx.fillStyle = '#ffdf6b';
        ctx.fillText(pop.text, X, Y);
      }
      ctx.globalAlpha = 1;

      // 13) 말풍선
      if (frame.bubble) drawBubble(frame.bubble, p, sx, sy, z, cs);

      // 14) 돌풍 알림: 캐릭터가 돌풍 구간에 있을 때 화면 위쪽에 방향 표시 (예고 땐 깜빡임)
      if (gw && gw.here && gu.phase !== 'calm' && (gu.phase === 'blow' || Math.floor(frame.time * 6) % 2)) {
        const text = gu.dir < 0 ? '◀ 돌풍 ◀' : '▶ 돌풍 ▶';
        ctx.font = 'bold ' + Math.round(9 * z) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, z);
        const X = sx(cs + innerW / 2), Y = sy(top - 60); // 위쪽 층수·콤보 글자 바로 아래
        ctx.strokeStyle = '#1d2a33';
        ctx.strokeText(text, X, Y);
        ctx.fillStyle = gu.phase === 'blow' ? '#ffffff' : '#cfe8ff';
        ctx.fillText(text, X, Y);
      }
    };

    return r;
  };
})(window.SF);

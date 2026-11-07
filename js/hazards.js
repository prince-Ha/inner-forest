// 장애물 (설계 문서 §13): 가시공·원숭이 바나나·도토리(시간에 따라 정해진 움직임) + 금 간 발판(밟으면 부서짐)
// 움직이는 장애물은 상태 없이 "시각 t → 위치" 함수로 계산한다 → 모든 학생이 같은 패턴, 테스트하기 쉬움
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const CELL = SF.CELL;
  const CS = 16;
  const POINT_KINDS = ['spikeBall', 'monkey', 'acorn'];
  SF.HAZARD_KINDS = POINT_KINDS.concat(['crumble', 'gust']);
  // 구간 hazards에 같이 적는 값: 겹칠 확률, 빠르기 배수, 금 간 발판이 부서지기까지(초, 적으면 빠르기와 상관없이 이 값)
  SF.HAZARD_OPTIONS = ['double', 'speed', 'crumbleDelay'];

  // 구간 빠르기(speed) s배 = 같은 움직임을 s배 빨리 감은 것. 각 장애물은 '자기 시각' u = t·s 로 계산한다
  const speedOf = (h) => h.speed || 1;
  // 실제 초 단위의 주기·속도 (화면·소리용)
  SF.hazardTiming = function (h, cfg) {
    const O = cfg.obstacles;
    const s = speedOf(h);
    if (h.kind === "spikeBall") return { period: (h.period || O.spikeBall.period) / s };
    if (h.kind === 'monkey') return { period: O.banana.period / s, speed: O.banana.speed * s };
    if (h.kind === 'acorn') return { period: O.acorn.period / s, speed: O.acorn.speed * s };
    return {};
  };

  // 공·바나나가 지나가는 높이: 그 층에 선 몸의 가운데. 아래층·위층에 선 몸과는 겹치지 않는다
  const bandY = (row) => row * CS + 11;
  const BALL_R = 5;
  const BANANA_HALF = 3;
  const ACORN_HALF = 3;

  // 장애물에 맞는 몸 상자 (실제보다 조금 작게 → 아슬아슬하게 스친 건 봐준다)
  SF.playerHazardBox = (p) => ({ x0: p.x + 1, y0: p.y + 2, x1: p.x + p.w - 1, y1: p.y + p.h - 4 });

  const mod = (a, n) => ((a % n) + n) % n;

  // 장애물이 영향을 주는 행 범위
  const rowsOf = (h) => (h.kind === 'acorn' ? [h.row, h.topRow] : [h.row, h.row]);

  // 시각 t에 떠 있는 장애물 모양들. harmless: 그림만 (도토리 깨진 자국)
  // near = { r0, r1 } 를 주면 그 행 범위에 걸치는 장애물만 계산한다 (빠르게)
  SF.hazardShapes = function (level, cfg, time, near) {
    const O = cfg.obstacles;
    const out = [];
    for (const h of level.hazards || []) {
      if (near) {
        const [a, b] = rowsOf(h);
        if (b < near.r0 || a > near.r1) continue;
      }
      const t = time * speedOf(h);
      if (h.kind === 'spikeBall') {
        const P = h.period || O.spikeBall.period; // 점프 숲은 장애물마다 느린 주기
        const u = mod(t + h.phase, P) / P;
        const tri = u < 0.5 ? u * 2 : 2 - u * 2;
        const xa = h.c0 * CS + 8, xb = h.c1 * CS + 8;
        out.push({ kind: 'spikeBall', x: xa + (xb - xa) * tri, y: bandY(h.row), r: BALL_R, vx: u < 0.5 ? 1 : -1, spin: t * 8, h });
      } else if (h.kind === 'monkey') {
        const B = O.banana;
        const startX = h.side > 0 ? (cfg.world.cols - 1) * CS - 6 : CS + 6;
        const endX = h.side > 0 ? CS - 6 : (cfg.world.cols - 1) * CS + 6;
        const flight = Math.abs(endX - startX) / B.speed;
        const kNow = Math.floor((t - h.phase) / B.period);
        for (let k = kNow; k >= 0 && h.phase + k * B.period > t - flight; k--) {
          const dt = t - (h.phase + k * B.period);
          const x = startX - h.side * B.speed * dt;
          out.push({ kind: 'banana', x, y: bandY(h.row), half: BANANA_HALF, vx: -h.side, spin: dt * 14, h });
        }
      } else if (h.kind === 'acorn') {
        const A = O.acorn;
        if (t < h.phase) continue;
        const dt = mod(t - h.phase, A.period);
        const topY = h.topRow * CS + 8;
        const stopY = h.row * CS + ACORN_HALF;
        const y = topY - A.speed * dt;
        if (y > stopY) out.push({ kind: 'acorn', x: h.col * CS + 8, y, half: ACORN_HALF, vx: 0, h });
        else if (dt - (topY - stopY) / A.speed < 0.2) out.push({ kind: 'acornSplat', x: h.col * CS + 8, y: stopY, harmless: true, age: dt - (topY - stopY) / A.speed, h });
      }
    }
    return out;
  };

  // 원숭이가 팔을 들고 있는가 (던지기 직전 예고, 또는 막 던진 직후). 예고 시간은 빨라져도 그대로(실제 초)
  SF.monkeyPose = function (h, cfg, time) {
    const B = cfg.obstacles.banana;
    const s = speedOf(h);
    const t = time * s;
    const warn = B.warn * s;
    if (t < h.phase - warn) return 'idle';
    const toNext = mod(h.phase - t, B.period);
    const since = mod(t - h.phase, B.period);
    if (toNext <= warn) return 'ready';
    if (since < 0.15 * s) return 'throw';
    return 'idle';
  };

  // 원숭이가 지금까지 몇 번째 바나나를 던졌나 (-1: 아직) — 던지는 소리용
  SF.throwCount = (h, cfg, time) => Math.floor((time * speedOf(h) - h.phase) / cfg.obstacles.banana.period);

  function overlaps(s, box) {
    const half = s.r || s.half;
    return s.x + half > box.x0 && s.x - half < box.x1 && s.y + half > box.y0 && s.y - half < box.y1;
  }

  // 맞으면 { kind, dir } (dir: 튕겨나갈 방향 -1/+1, 0이면 부른 쪽이 정함), 아니면 null
  SF.hazardHit = function (level, cfg, t, box) {
    const near = { r0: Math.floor(box.y0 / CS) - 1, r1: Math.ceil(box.y1 / CS) + 1 };
    for (const s of SF.hazardShapes(level, cfg, t, near)) {
      if (s.harmless || !overlaps(s, box)) continue;
      let dir = s.vx;
      if (!dir) dir = (box.x0 + box.x1) / 2 < s.x ? -1 : 1;
      return { kind: s.kind, dir };
    }
    return null;
  };

  // ---------------------------------------------------------------- 배치 (맵 생성 뒤, 시드로)
  function makeHazard(kind, t, level, cfg, rng) {
    const g = level.grid;
    const c = t.c0;
    const inMax = g.cols - 2;
    const solidIn = (c0, c1, r) => { for (let x = c0; x <= c1; x++) if (g.get(x, r) === CELL.SOLID) return true; return false; };
    if (kind === 'spikeBall') {
      // 계단을 레일의 한쪽 끝에 두고, 레일은 다음 계단과 반대쪽으로 뻗는다
      // → 공이 한 번 왕복할 때 한 번만 지나가고, 빠져나가는 쪽은 공이 없는 쪽
      const span = cfg.obstacles.spikeBall.span;
      const away = t.dirToNext > 0 ? -1 : 1;
      const c0 = away < 0 ? c - span + 1 : c;
      const c1 = c0 + span - 1;
      if (c0 < 1 || c1 > inMax) return null;
      if (solidIn(c0, c1, t.row + 1)) return null;
      return { kind, row: t.row, c0, c1, phase: rng.next() * cfg.obstacles.spikeBall.period };
    }
    if (kind === 'monkey') {
      if (solidIn(1, inMax, t.row + 1)) return null;
      const side = c <= (g.cols - 1) / 2 ? 1 : -1; // 먼 쪽 벽에서 던져 반응할 시간을 준다
      if (g.get(side > 0 ? inMax : 1, t.row + 1) !== CELL.EMPTY) return null; // 원숭이가 앉을 벽 옆 자리
      return { kind, row: t.row, side, phase: rng.next() * cfg.obstacles.banana.period };
    }
    if (kind === 'acorn') {
      const topRow = t.row + cfg.obstacles.acorn.height;
      if (topRow >= g.rows) return null;
      for (let r = t.row + 1; r <= topRow; r++) if (g.get(c, r) !== CELL.EMPTY) return null;
      return { kind, col: c, row: t.row, topRow, phase: rng.next() * cfg.obstacles.acorn.period };
    }
    return null;
  }

  // (x, y)에서 vx, vy로 떠서 실제 물리로 떨어지면 몇 층 떨어지나
  function dropFrom(world, cfg, x, y, vx, vy) {
    const q = SF.createPlayer(x, y);
    q.grounded = false; q.vx = vx; q.vy = vy; q.airStartY = y;
    for (let k = 0; k < 1200; k++) {
      const land = SF.stepPlayer(q, world, 0, cfg).find((e) => e.type === 'land');
      if (land) return land.dropFloors;
    }
    return 0;
  }
  const capOf = (cfg, floor) => SF.zoneForFloor(cfg, floor).zone.maxFallFloors;
  // 이 디딤판에서 장애물에 맞아 양쪽으로 튕겨도 구간 한도 안에 떨어지는가
  function knockSafe(world, cfg, t) {
    const O = cfg.obstacles;
    const x = t.c0 * CS + 4, y = t.row * CS;
    return [-1, 1].every((dir) => dropFrom(world, cfg, x, y, dir * O.knockSpeed, O.knockPopVy) <= capOf(cfg, t.row + 1));
  }
  // 이 칸이 부서져도 구간 한도 안에 떨어지는가
  function crumbleSafe(world, level, cfg, c, row) {
    const g = level.grid;
    const style = g.getStyle(c, row);
    g.set(c, row, CELL.EMPTY, 0);
    const drop = dropFrom(world, cfg, c * CS + 4, row * CS, 0, 0);
    g.set(c, row, CELL.SLAB, style);
    return drop <= capOf(cfg, row + 1);
  }

  SF.placeHazards = function (level, cfg, rng) {
    level.hazards = [];
    level.crumbles = [];
    level._crumbleSet = null; // 조심스러운 봇이 기억해 둔 금 간 발판 목록도 새로
    const world = new SF.World(level.grid, cfg);
    const nextAt = {};
    let lastRow = -10;
    // 퀴즈 층은 쉬는 자리: 그 층과 바로 위 층에는 장애물 없음, 그 층 발판은 금 간 발판이 아님
    const quizRows = new Set(SF.quizFloors ? SF.quizFloors(cfg).map((f) => f - 1) : []);
    for (const t of level.treads) {
      if (t.isGoal || quizRows.has(t.row) || quizRows.has(t.row - 1)) continue;
      const floor = t.row + 1;
      const { index: zi, zone } = SF.zoneForFloor(cfg, floor);
      const hz = zone.hazards;
      if (!hz) continue;
      const due = [];
      for (const kind of POINT_KINDS) {
        if (!hz[kind]) continue;
        const key = zi + ':' + kind;
        if (nextAt[key] === undefined) nextAt[key] = floor + 1 + rng.int(0, hz[kind][0]);
        if (floor >= nextAt[key]) due.push(kind);
      }
      if (!due.length || t.row - lastRow < 2) continue;
      const kind = rng.pick(due);
      const h = makeHazard(kind, t, level, cfg, rng);
      if (!h || !knockSafe(world, cfg, t)) continue;
      if (hz.speed) h.speed = hz.speed;
      level.hazards.push(h);
      lastRow = t.row;
      nextAt[zi + ':' + kind] = floor + rng.int(hz[kind][0], hz[kind][1]);
      // 겹치기: 같은 층에 다른 종류 하나 더 (예: 가시공이 오가는 층에 바나나도)
      if (hz.double && rng.chance(hz.double)) {
        const others = POINT_KINDS.filter((k) => k !== kind && hz[k]);
        while (others.length) {
          const k2 = others.splice(rng.int(0, others.length - 1), 1)[0];
          const h2 = makeHazard(k2, t, level, cfg, rng);
          if (!h2) continue;
          if (hz.speed) h2.speed = hz.speed;
          level.hazards.push(h2);
          break;
        }
      }
    }
    // 금 간 발판: 장애물 층 바로 아래(기다리는 자리)와 바위가 얹힌 칸은 빼고
    const hazardRows = new Set(level.hazards.map((h) => h.row));
    for (const t of level.treads) {
      if (t.isGoal) continue;
      const zone = SF.zoneForFloor(cfg, t.row + 1).zone;
      const p = zone.hazards && zone.hazards.crumble;
      if (!p || hazardRows.has(t.row + 1) || quizRows.has(t.row) || !rng.chance(p)) continue;
      for (let c = t.c0; c <= t.c1; c++) {
        if (level.grid.get(c, t.row + 1) === CELL.SOLID || !crumbleSafe(world, level, cfg, c, t.row)) continue;
        const tile = { col: c, row: t.row };
        if (zone.hazards.speed) tile.speed = zone.hazards.speed;
        if (zone.hazards.crumbleDelay) tile.delay = zone.hazards.crumbleDelay;
        level.crumbles.push(tile);
      }
    }
    return level;
  };

  // ---------------------------------------------------------------- 금 간 발판 (상태 있음: 밟은 시각, 부서짐)
  SF.createCrumbleState = (level) => ({
    tiles: new Map((level.crumbles || []).map((c) => [c.col + ',' + c.row,
      { col: c.col, row: c.row, t: -1, broken: false, speed: c.speed || 1, delay: c.delay, style: level.grid.getStyle(c.col, c.row) }])),
  });
  // 밟고 나서 부서지기까지(초): 구간이 정해 두었으면 그 값, 아니면 빠른 구간일수록 짧다
  SF.crumbleDelay = (tile, cfg) => tile.delay || cfg.obstacles.crumble.delay / (tile.speed || 1);

  const onTile = (p, tile) => Math.round(p.y / CS) === tile.row &&
    p.x + p.w > tile.col * CS && p.x < tile.col * CS + CS;

  // 이벤트: crumbleStart(흔들리기 시작), break(부서짐), respawn(다시 생김)
  SF.updateCrumbles = function (cs, level, p, cfg) {
    const dt = cfg.physics.fixedStep;
    const C = cfg.obstacles.crumble;
    const g = level.grid;
    const slabT = cfg.world.slabThickness;
    const events = [];
    if (p.grounded) {
      const { col, row } = SF.tileOf(p);
      const tile = cs.tiles.get(col + ',' + row);
      if (tile && !tile.broken && tile.t < 0) {
        tile.t = 0;
        events.push({ type: 'crumbleStart', col, row });
      }
    }
    for (const tile of cs.tiles.values()) {
      if (tile.t < 0) continue;
      tile.t += dt;
      const delay = SF.crumbleDelay(tile, cfg);
      if (!tile.broken && tile.t >= delay) {
        tile.broken = true;
        g.set(tile.col, tile.row, CELL.EMPTY, 0);
        events.push({ type: 'break', col: tile.col, row: tile.row });
        if (p.grounded && onTile(p, tile)) {
          p.grounded = false;
          p.vx = 0;
          p.vy = 0;
          p.airStartY = p.y;
        }
      } else if (tile.broken && tile.t >= delay + C.respawn) {
        // 발판 자리(위쪽 두께만큼)에 몸이 걸쳐 있으면 비킬 때까지 기다린다
        const top = tile.row * CS;
        const inside = p.x + p.w > tile.col * CS && p.x < tile.col * CS + CS && p.y < top && p.y + p.h > top - slabT;
        if (inside) continue;
        tile.broken = false;
        tile.t = -1;
        g.set(tile.col, tile.row, CELL.SLAB, tile.style);
        events.push({ type: 'respawn', col: tile.col, row: tile.row });
      }
    }
    return events;
  };

  // 검사가 끝나면 맵을 원래대로
  SF.restoreCrumbles = function (cs, level) {
    for (const tile of cs.tiles.values()) {
      if (tile.broken) level.grid.set(tile.col, tile.row, CELL.SLAB, tile.style);
      tile.broken = false;
      tile.t = -1;
    }
  };

  // ---------------------------------------------------------------- 돌풍: 멈춰 있으면 바람 쪽으로 한 칸 밀린다
  // 맵 전체가 같은 시계: period초마다 [예고 warn초 → 바람 blow초 → 잠잠]. 방향은 왼쪽부터 번갈아
  SF.gustAt = function (level, cfg, t) {
    const G = level.gust || cfg.obstacles.gust; // 점프 숲은 자기 간격 (jump.gustPeriod)
    const u = t - (level.gustPhase || 0);
    if (!G || u < 0) return { phase: 'calm', dir: 0, k: -1, s: 0 }; // 돌풍 설정이 없으면 늘 잠잠
    const k = Math.floor(u / G.period);
    const s = u - k * G.period;
    const dir = k % 2 === 0 ? -1 : 1;
    if (s < G.warn) return { phase: 'warn', dir, k, s: s / G.warn };
    if (s < G.warn + G.blow) return { phase: 'blow', dir, k, s: (s - G.warn) / G.blow };
    return { phase: 'calm', dir, k, s: 0 };
  };
  SF.inGustZone = function (cfg, floor) {
    const z = SF.zoneForFloor(cfg, floor).zone;
    return !!(z.hazards && z.hazards.gust);
  };
  SF.createGustState = () => ({ idle: 0 });

  // 바람이 부는 동안 hold초 넘게 가만히 서 있으면 바람 쪽으로 한 칸: 옆 발판이면 옆걸음, 허공이면 잘못 누른 것처럼 추락,
  // 벽·바위·위 계단으로 막혀 있으면 버틴다. 이벤트: gustPush { dir, fell }
  SF.updateGust = function (gs, level, cfg, t, p, st) {
    const events = [];
    const G = cfg.obstacles.gust;
    const g = SF.gustAt(level, cfg, t);
    const still = st.mode === 'idle' && st.queue.length === 0 && p.grounded;
    const floor = SF.floorAt(p.y);
    // 퀴즈 층은 쉬는 자리라 바람도 막아 준다 (퀴즈를 닫자마자 밀려 떨어지지 않게)
    const sheltered = SF.quizFloors && SF.quizFloors(cfg).includes(floor);
    if (g.phase !== 'blow' || !still || sheltered || !SF.inGustZone(cfg, floor)) { gs.idle = 0; return events; }
    gs.idle += cfg.physics.fixedStep;
    if (gs.idle < G.hold) return events;
    gs.idle = 0;
    const S = cfg.step;
    const { col, row } = SF.tileOf(p);
    const o = SF.stepOutcome(level.grid, col, row, g.dir);
    if (o.type === 'side') {
      st.mode = 'hop'; st.kind = 'side'; st.dir = g.dir; st.t = 0;
      st.fromX = p.x; st.fromY = p.y;
      st.toX = o.col * CS + (CS - p.w) / 2; st.toY = p.y;
      events.push({ type: 'gustPush', dir: g.dir, fell: false });
    } else if (o.type === 'miss') {
      st.mode = 'fall';
      p.grounded = false;
      p.vx = g.dir * S.missSpeed;
      p.vy = S.missPopVy;
      p.airStartY = p.y;
      events.push({ type: 'gustPush', dir: g.dir, fell: true });
    }
    return events;
  };

  // 튕겨 나갈 방향: 가시공은 가던 방향의 반대(뒤)로 (공은 대개 뒤에서 와서 앞으로 밀면 어색함, 사용자 요청),
  // 바나나·도토리는 날아온 방향 그대로. 추락 깊이는 배치할 때 양쪽 다 검사했으므로 어느 쪽이든 한도 안
  SF.knockDir = (hit, p) => (hit.kind === 'spikeBall' ? -(p.facing || 1) : hit.dir);

  // 맞았을 때: 줄 서 있던 입력을 버리고, 맞은 방향으로 튕겨 실제 물리로 떨어진다
  SF.stepperKnock = function (st, p, dir, cfg) {
    const O = cfg.obstacles;
    st.queue.length = 0;
    st.mode = 'fall';
    p.grounded = false;
    p.vx = dir * O.knockSpeed;
    p.vy = O.knockPopVy;
    p.airStartY = p.y;
  };

  // ---------------------------------------------------------------- 조심스러운 봇: 틈을 보고 들어간다
  // 경로 = [시작 시각 오프셋, 끝 시각 오프셋, 시작 위치, 끝 위치] 조각들. 그동안 한 번이라도 맞을 것 같으면 위험
  function pathSafe(level, cfg, t, p, segs) {
    const M = 2; // 예측은 2px 넉넉하게 (실제 도착이 한 스텝 늦을 수 있다)
    for (const [a, b, from, to] of segs) {
      for (let tau = a; tau <= b + 1e-9; tau += 0.01) {
        const k = b > a ? (tau - a) / (b - a) : 1;
        const box = SF.playerHazardBox({ x: SF.lerp(from.x, to.x, k), y: SF.lerp(from.y, to.y, k), w: p.w, h: p.h });
        if (SF.hazardHit(level, cfg, t + tau, { x0: box.x0 - M, y0: box.y0 - M, x1: box.x1 + M, y1: box.y1 + M })) return false;
      }
    }
    return true;
  }

  const WAIT = 2; // 이 시간 동안 안 맞으면 그 칸은 기다려도 되는 자리 (장애물 주기 최대 1.8초)
  const crumbleSet = (level) => level._crumbleSet || (level._crumbleSet = new Set((level.crumbles || []).map((c) => c.col + ',' + c.row)));

  SF.carefulBotDir = function (level, map, p, cfg, t) {
    if (!p.grounded) return 0;
    const d = SF.botDir(level, map, p);
    if (!d) return 0;
    const g = level.grid;
    const { col, row } = SF.tileOf(p);
    const o = SF.stepOutcome(g, col, row, d);
    // 길 위에 서 있는데 가야 할 칸이 허공이면 금 간 발판이 부서진 것 → 다시 생길 때까지 기다린다
    if (o.type === 'miss' && map[row * g.cols + col] >= 0) return 0;
    if (o.type !== 'climb' && o.type !== 'side') return d;
    const hop = cfg.step.hopTime;
    const tick = cfg.physics.fixedStep;
    const here = { x: p.x, y: p.y };
    const there = { x: o.col * CS + (CS - p.w) / 2, y: o.row * CS };
    // 지금 자리에 그대로 있으면 곧 맞는가 → 그렇다면 한 칸만 안전해도 바로 빠져나간다
    const stayHit = !pathSafe(level, cfg, t, p, [[0, 0.3, here, here]]);
    // 들어갈 칸이 기다려도 되는 자리면(금 간 발판이 아니고 한동안 안 맞음) 거기까지만 안전하면 된다
    if (!stayHit && !crumbleSet(level).has(o.col + ',' + o.row) &&
        pathSafe(level, cfg, t, p, [[0, hop, here, there], [hop, hop + WAIT, there, there]])) return d;
    const segs = [[0, hop, here, there], [hop, hop + 0.06, there, there]];
    if (!stayHit) {
      // 들어간 칸에서 바로 다음 칸으로 빠져나가는 것까지 안전해야 들어간다 (장애물 층에 갇히지 않게)
      const ti = map[o.row * g.cols + o.col];
      const d2 = ti >= 0 ? level.treads[ti].dirToNext : 0;
      const o2 = d2 ? SF.stepOutcome(g, o.col, o.row, d2) : null;
      if (o2 && (o2.type === 'climb' || o2.type === 'side')) {
        const next = { x: o2.col * CS + (CS - p.w) / 2, y: o2.row * CS };
        segs[1] = [hop, hop + tick * 2, there, there];
        segs.push([hop + tick * 2, 2 * hop + tick * 2, there, next], [2 * hop + tick * 2, 2 * hop + 0.08, next, next]);
      }
    }
    return pathSafe(level, cfg, t, p, segs) ? d : 0;
  };

  // 공정성 검사: 61층 근처(첫 장애물 구간 바로 아래)부터 조심스러운 봇이 장애물을 켠 채로 정상까지.
  // 맞은 횟수와 함께, 맞았을 때·발판이 부서졌을 때의 추락이 구간 한도 안인지도 잰다
  SF.checkHazardFairness = function (level, cfg, opts) {
    const o = opts || {};
    const firstZone = cfg.zones.findIndex((z) => !!z.hazards);
    if (firstZone < 0) return { reached: true, hits: 0, pushes: 0, maxFloor: cfg.totalFloors, seconds: 0, overCap: [] };
    const startFloor = firstZone === 0 ? 1 : cfg.zones[firstZone - 1].untilFloor;
    const start = level.treads.find((tr) => tr.row + 1 === startFloor) || level.treads[0];
    const world = new SF.World(level.grid, cfg);
    const map = SF.treadIndexMap(level);
    const entry = start.dirIn > 0 ? start.c0 : start.c1;
    const p = SF.createPlayer(entry * CS + (CS - cfg.player.width) / 2, start.row * CS);
    const st = SF.createStepper();
    const cs = SF.createCrumbleState(level);
    const gs = SF.createGustState();
    const dt = cfg.physics.fixedStep;
    const maxSteps = Math.ceil((o.maxSeconds || 120) / dt);
    let hits = 0;
    let pushes = 0;
    let maxFloor = SF.floorAt(p.y);
    let lastProgress = 0;
    let reached = false;
    let i = 0;
    for (; i < maxSteps; i++) {
      const t = i * dt;
      if (t - lastProgress > 15) break; // 15초 동안 한 층도 못 오르면 틈이 없는 배치 → 포기
      SF.updateCrumbles(cs, level, p, cfg);
      if (st.mode === 'idle' && st.queue.length === 0 && p.grounded) {
        const d = SF.carefulBotDir(level, map, p, cfg, t);
        if (d) SF.stepperPress(st, d, cfg);
      }
      SF.updateStepper(st, p, world, cfg);
      if (st.mode !== 'fall') {
        const hit = SF.hazardHit(level, cfg, t, SF.playerHazardBox(p));
        if (hit) { hits++; SF.stepperKnock(st, p, SF.knockDir(hit, p), cfg); }
      }
      pushes += SF.updateGust(gs, level, cfg, t, p, st).length;
      const f = SF.floorAt(p.y);
      if (f > maxFloor) { maxFloor = f; lastProgress = t; }
      if (p.grounded && st.mode === 'idle' && f >= cfg.totalFloors) { reached = true; break; }
    }
    SF.restoreCrumbles(cs, level);

    // 맞았을 때(양쪽으로)와 금 간 발판이 부서졌을 때의 추락이 구간 한도 안인지 (배치할 때 이미 걸렀지만 다시 확인)
    const overCap = [];
    for (const h of level.hazards) {
      const tr = level.treads.find((x) => x.row === h.row);
      if (tr && !knockSafe(world, cfg, tr)) overCap.push((h.row + 1) + '층 장애물에 맞으면 한도보다 깊이 떨어져요');
    }
    for (const c of level.crumbles) {
      if (!crumbleSafe(world, level, cfg, c.col, c.row)) overCap.push((c.row + 1) + '층 금 간 발판이 부서지면 한도보다 깊이 떨어져요');
    }
    return { reached, hits, pushes, maxFloor, seconds: i * dt, overCap };
  };
})(window.SF);

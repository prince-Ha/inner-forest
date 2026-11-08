// 1000층 도전 (601층~): 메이플스토리 점프 퀘스트처럼 떠 있는 발판·밧줄을 뛰어 오른다 (설계 문서 2026-11-06)
//  - 조작: ◀▶를 누르고 있으면 걷기, 화면 아무 데나 누르면 점프. 밧줄에 닿으면 잡고, 잡은 채 ▶(▲)로 오르고 ◀(▼)로 내려간다
//  - 맵: cfg.jump.seed로 만든다. 2~3칸 발판이 지그재그로 올라가고, 20층마다 폭 전체 쉼터, 가끔 밧줄
//  - 물리는 physics.js의 SF.stepPlayer(걷기·중력·자동 계단)를 그대로 쓰고 점프·밧줄만 여기서 더한다
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const C = SF.CELL;
  const ST = SF.STYLE;

  // 점프로 닿을 수 있는 범위 (맵 생성과 검사가 같은 규칙을 쓴다): 2줄 위는 사이 1칸까지, 1줄 위는 사이 2칸까지
  SF.jumpReach = { 2: 1, 1: 2, 0: 3 };

  // 601층부터 topFloor층까지의 맵. 행 r의 발판 윗면 높이 = r*cell, 층수 = r+1
  SF.buildJumpLevel = function (cfg, seedOverride) {
    const J = cfg.jump;
    const cols = cfg.world.cols, cs = cfg.world.cell;
    const base = cfg.totalFloors;          // 600: 이 줄이 점프 숲의 바닥
    const top = J.topFloor;                // 지금 만들어진 마지막 층
    const rng = SF.makeRng(seedOverride == null ? J.seed : seedOverride);
    const grid = SF.createGrid(cols, top);
    const platforms = [], ropes = [];
    const put = (c0, c1, row, style) => { for (let c = c0; c <= c1; c++) grid.set(c, row, C.SLAB, style); platforms.push({ c0, c1, row }); };
    // 시작 발판: 행 600(윗면 = 601층)에 폭 전체 발판 (보이게 발판으로). 행 r 발판에 서면 발 높이 = r*cell, 층수 = r+1
    for (let c = 1; c < cols - 1; c++) grid.set(c, base, C.SLAB, ST.BRICK);
    // 양쪽 벽: 맨 바깥 두 열은 처음부터 꼭대기까지 고체 (튕기거나 바람에 밀려도 밖으로 못 나가게)
    for (let r = 0; r < top; r++) { grid.set(0, r, C.SOLID, ST.WALL); grid.set(cols - 1, r, C.SOLID, ST.WALL); }
    platforms.push({ c0: 1, c1: cols - 2, row: base, ground: true });
    let cur = platforms[0];
    let dir = rng.chance(0.5) ? 1 : -1;
    let sinceRope = 0;
    while (cur.row < top - 1) {
      const B = SF.jumpBand(cfg, cur.row + 1);
      const restRow = Math.floor(cur.row / 40) * 40 + 39; // 다음 쉼터 줄 (639, 679 → 640층, 680층 … 800층·1000층 포함)
      // 쉼터: 40층마다 폭 전체 (떨어져도 여기까지). 장애물·금 간 발판 없음
      if (cur.row < restRow && restRow - cur.row <= 2 && restRow < top - 1) {
        put(1, cols - 2, restRow, ST.BRICK);
        cur = platforms[platforms.length - 1];
        cur.rest = true;
        sinceRope++;
        continue;
      }
      // 밧줄: 가끔 5~7줄을 한 번에
      if (sinceRope >= 6 && rng.chance(B.ropeChance) && cur.row + 8 < Math.min(restRow, top - 1)) {
        const col = rng.int(Math.max(1, cur.c0), Math.min(cols - 2, cur.c1));
        const nrow = cur.row + rng.int(5, 7);
        const c0 = Math.max(1, Math.min(col - 1, cols - 4)), c1 = c0 + 2;
        put(c0, c1, nrow, ST.BRANCH);
        ropes.push({ col, bottom: cur.row, top: nrow }); // 발 높이(행 번호): 아래 발판 위 → 위 발판 위
        cur.ropeFoot = true;
        cur = platforms[platforms.length - 1];
        cur.ropeTop = true;
        sinceRope = 0;
        continue;
      }
      // 보통 발판: 1~2줄 위, 사이 간격은 닿는 범위 안에서 (위 구간일수록 넓게)
      const dy = rng.chance(B.twoRowChance) ? 2 : 1;
      const row = Math.min(cur.row + dy, top - 1);
      if (row === top - 1) { put(1, cols - 2, top - 1, ST.BRICK); platforms[platforms.length - 1].rest = true; break; } // 마지막 층은 폭 전체
      const w = rng.int(B.width[0], B.width[1]);
      const reach = SF.jumpReach[row - cur.row];
      const gap = rng.int(Math.min(B.minGap, reach), reach);
      let c0, c1, placed = false;
      for (let tries = 0; tries < 2 && !placed; tries++) {
        if (dir > 0) { c0 = cur.c1 + 1 + gap; c1 = c0 + w - 1; } else { c1 = cur.c0 - 1 - gap; c0 = c1 - w + 1; }
        if (c0 >= 1 && c1 <= cols - 2) placed = true; else dir = -dir;
      }
      if (!placed) { // 양쪽 다 막힘(폭 전체 발판 위): 아무 데나 위에
        c0 = rng.int(1, cols - 2 - (w - 1)); c1 = c0 + w - 1;
        dir = c0 + w / 2 < cols / 2 ? 1 : -1;
      }
      put(c0, c1, row, rng.chance(0.3) ? ST.BRANCH : ST.PLANK);
      cur = platforms[platforms.length - 1];
      sinceRope++;
      if (rng.chance(0.25)) dir = -dir;
    }
    const level = {
      jump: true, grid, platforms, ropes, treads: [], rocks: [], hazards: [], crumbles: [],
      seed: J.seed, hazardTry: 0, goalRow: top - 1, baseFloor: base, topFloor: top,
      spawn: { x: cs + 4, y: base * cs },
      gust: Object.assign({}, cfg.obstacles.gust, { period: J.gustPeriod || cfg.obstacles.gust.period }),
    };
    placeJumpHazards(level, cfg, rng);
    return level;
  };

  // 구간 설정 (config.jump.bands). 층수 floor가 속한 구간
  SF.jumpBand = function (cfg, floor) {
    const bands = cfg.jump.bands || [];
    for (const b of bands) if (floor <= b.untilFloor) return Object.assign({}, BAND_DEFAULT, b);
    return Object.assign({}, BAND_DEFAULT, bands[bands.length - 1] || {});
  };
  const BAND_DEFAULT = { width: [2, 3], minGap: 0, twoRowChance: 0.55, ropeChance: 0.35, hazards: {}, crumble: 0, gust: false, speed: 1, double: 0 };

  // 장애물: 쉼터·밧줄 양 끝 발판은 빼고, 발판마다 구간 확률로 하나 (겹치기면 둘). 바로 위·아래 발판에는 연달아 두지 않는다
  function placeJumpHazards(level, cfg, rng) {
    const g = level.grid, cs = cfg.world.cell, cols = g.cols;
    const O = cfg.obstacles;
    let lastRow = -10;
    const make = (kind, pf) => {
      if (kind === "spikeBall") {
        // 줄은 발판에서 한쪽 허공으로 3칸 더 뻗는다 → 공이 허공 쪽에 가 있는 동안 발판에 설 틈이 생긴다
        const ext = 3;
        const roomR = cols - 2 - pf.c1, roomL = pf.c0 - 1;
        let c0 = pf.c0, c1 = pf.c1;
        if (roomR >= ext || roomR >= roomL) c1 = Math.min(cols - 2, pf.c1 + ext); else c0 = Math.max(1, pf.c0 - ext);
        if (c1 - c0 + 1 - (pf.c1 - pf.c0 + 1) < 2) return null; // 비켜 설 틈이 없으면 가시공 대신 안 둠
        const period = cfg.jump.spikePeriod || O.spikeBall.period;
        return { kind, row: pf.row, c0, c1, period, phase: rng.next() * period };
      }
      if (kind === 'monkey') { // 먼 쪽 벽에서 던진다
        const side = (pf.c0 + pf.c1) / 2 <= (cols - 1) / 2 ? 1 : -1;
        return { kind, row: pf.row, side, phase: rng.next() * O.banana.period };
      }
      if (kind === 'acorn') { // 발판 한 칸 위로 떨어진다. 그 칸 위가 비어 있어야
        const col = rng.int(pf.c0, pf.c1);
        const topRow = pf.row + O.acorn.height;
        for (let r = pf.row + 1; r <= topRow; r++) if (g.get(col, r) !== C.EMPTY) return null;
        return { kind, col, row: pf.row, topRow, phase: rng.next() * O.acorn.period };
      }
      return null;
    };
    // 한 발판에 어려움은 하나만: 장애물이 있는 발판은 금 간 발판이 아니고, 좁은 발판(1칸)에는 원숭이·겹치기를 두지 않는다
    for (const pf of level.platforms) {
      if (pf.ground || pf.rest || pf.ropeFoot || pf.ropeTop) continue;
      const B = SF.jumpBand(cfg, pf.row + 1);
      const narrow = pf.c1 === pf.c0;
      let placed = false;
      if (pf.row - lastRow >= 2) {
        const kinds = Object.keys(B.hazards).filter((k) => !(narrow && k === 'monkey') && rng.chance(B.hazards[k]));
        const k1 = kinds.length ? rng.pick(kinds) : null;
        const h = k1 && make(k1, pf);
        if (h) {
          if (B.speed !== 1) h.speed = B.speed;
          level.hazards.push(h);
          lastRow = pf.row;
          placed = true;
          if (!narrow && B.double && rng.chance(B.double)) {
            const k2 = kinds.find((k) => k !== k1) || Object.keys(B.hazards).find((k) => k !== k1);
            const h2 = k2 && make(k2, pf);
            if (h2) { if (B.speed !== 1) h2.speed = B.speed; level.hazards.push(h2); }
          }
        }
      }
      // 금 간 발판: 장애물이 없는 발판만. 부서지기까지 jump.crumbleDelay초 (빠르기와 상관없이)
      if (!placed && B.crumble && rng.chance(B.crumble)) {
        for (let c = pf.c0; c <= pf.c1; c++) level.crumbles.push({ col: c, row: pf.row, delay: cfg.jump.crumbleDelay || 0.8 });
      }
    }
  }
  // 돌풍이 부는 구간인가 (점프 숲)
  SF.jumpGustHere = (cfg, floor) => !!cfg.jump && floor > cfg.totalFloors && SF.jumpBand(cfg, floor).gust;

  // 발판 하나에서 다음 발판으로 갈 수 있는가 (맵 검사용): 밧줄로 이어졌거나 점프 범위 안
  SF.jumpLinked = function (a, b, ropes) {
    if (ropes.some((r) => r.bottom === a.row && r.top === b.row && r.col >= b.c0 && r.col <= b.c1)) return true;
    const dy = b.row - a.row;
    if (dy < 0 || dy > 2) return false;
    const gap = b.c0 > a.c1 ? b.c0 - a.c1 - 1 : a.c0 > b.c1 ? a.c0 - b.c1 - 1 : 0;
    return gap <= SF.jumpReach[dy];
  };

  // 밧줄 잡기 조건: 몸 가운데가 밧줄 기둥 안, 발 높이가 밧줄 범위 안
  function ropeAt(level, p, cs) {
    const mid = p.x + p.w / 2;
    for (const r of level.ropes) {
      if (Math.abs(mid - (r.col * cs + cs / 2)) > 5) continue;
      if (p.y < r.bottom * cs - 2 || p.y > r.top * cs + 2) continue;
      return r;
    }
    return null;
  }

  // 한 스텝. dir: 누르고 있는 방향, jumpPressed: 이번 스텝에 점프를 눌렀는가. 이벤트 목록을 돌려준다
  SF.jumpStep = function (level, world, p, cfg, dir, jumpPressed) {
    const J = cfg.jump, cs = cfg.world.cell, dt = cfg.physics.fixedStep;
    const events = [];
    if (p.rope) {
      const r = p.rope;
      p.vx = 0; p.vy = 0; p.grounded = false;
      p.x = r.col * cs + cs / 2 - p.w / 2;
      if (jumpPressed) { // 놓고 보는 쪽으로 살짝 뛰어내리기
        p.rope = null; p.vy = J.speed * 0.6; p.vx = p.facing * J.walkSpeed * 0.8; p.airStartY = p.y;
        events.push({ type: 'jump', off: true });
        return events;
      }
      if (dir > 0) p.y += J.ropeSpeed * dt;      // ▶ = 올라가기
      else if (dir < 0) p.y -= J.ropeSpeed * dt; // ◀ = 내려가기
      if (p.y >= r.top * cs) { // 꼭대기: 위 발판에 올라선다
        p.y = r.top * cs; p.rope = null; p.grounded = true; p.airStartY = p.y;
        events.push({ type: 'land', dropFloors: 0, floor: SF.floorAt(p.y) });
      } else if (p.y <= r.bottom * cs) { // 바닥: 아래 발판에 선다
        p.y = r.bottom * cs; p.rope = null; p.grounded = true; p.airStartY = p.y;
      }
      return events;
    }
    if (jumpPressed && p.grounded) {
      p.grounded = false; p.vy = J.speed; p.airStartY = p.y;
      events.push({ type: 'jump' });
    }
    const P = cfg.physics;
    const saved = { walkSpeed: P.walkSpeed, airAccel: P.airAccel };
    P.walkSpeed = J.walkSpeed; P.airAccel = J.airAccel;
    for (const e of SF.stepPlayer(p, world, dir, cfg)) events.push(e);
    P.walkSpeed = saved.walkSpeed; P.airAccel = saved.airAccel;
    // 공중에서 밧줄을 지나면 잡는다 (떨어지는 중이거나 점프를 눌렀을 때)
    if (!p.grounded && (p.vy <= 0 || jumpPressed)) {
      const r = ropeAt(level, p, cs);
      if (r) { p.rope = r; p.vx = 0; p.vy = 0; events.push({ type: 'grab' }); }
    }
    return events;
  };
})(window.SF);

// ---------------------------------------------------------------- 정복 퀴즈 (800·1000층): config.jump.quizzes의 고정 문제, 시트와 따로
window.SF = window.SF || {};
(function (SF) {
  'use strict';
  // 이 층에 아직 안 푼 정복 퀴즈가 있으면 { q, no, total }
  SF.jumpQuizAt = function (jump, cfg, floor) {
    const list = (cfg.jump && cfg.jump.quizzes) || [];
    const i = list.findIndex((x) => x.floor === floor);
    if (i < 0 || !jump || (jump.quizDone && jump.quizDone.has(floor))) return null;
    return { q: list[i], no: i + 1, total: list.length };
  };
  // 답하기: 그 층은 다시 안 나온다. 결과는 SF.answerQuiz와 같은 모양
  SF.answerJumpQuiz = function (jump, q, floor, choice) {
    if (jump) { jump.quizDone = jump.quizDone || new Set(); jump.quizDone.add(floor); }
    return { correct: choice === q.answer, answer: q.answer, explain: q.explain };
  };
})(window.SF);

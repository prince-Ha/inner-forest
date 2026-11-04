// 맵 생성: 좌우로 꺾이며 올라가는 지그재그 계단 (설계 문서 §5)
//  - 디딤판(tread) = 한 행의 연속된 발판 [c0..c1]. 다음 디딤판은 진행 방향 바로 옆, 한 행 위.
//  - 비행(flight) = 같은 방향 디딤판 묶음. 마지막 디딤판이 착지판(꺾이는 곳).
//  - 머리 공간: 같은 열에서 바로 위 한 행에 발판을 두지 않는다.
//  - 생성 후 낭떠러지 추락 깊이를 실제 물리로 재고, 너무 깊으면 받침을 만든다. 봇으로 완주를 검증한다.
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const CELL = SF.CELL;
  const STYLE = SF.STYLE;
  const STYLE_BY_NAME = { plank: STYLE.PLANK, brick: STYLE.BRICK, branch: STYLE.BRANCH };

  SF.zoneForFloor = function (cfg, floor) {
    for (let i = 0; i < cfg.zones.length; i++) {
      if (floor <= cfg.zones[i].untilFloor) return { index: i, zone: cfg.zones[i] };
    }
    const last = cfg.zones.length - 1;
    return { index: last, zone: cfg.zones[last] };
  };

  // ---- 격자 편집 도구 (생성과 추락 조절이 함께 씀). 안쪽 열은 1..cols-2
  const empty = (g, c, r) => g.get(c, r) === CELL.EMPTY;

  // 발판 칸들을 놓을 수 있는가: 비어 있고, 같은 열 바로 아래·위 행이 비어 있음 (바닥 위 첫 행은 예외)
  function canPlace(g, r, c0, c1) {
    for (let c = c0; c <= c1; c++) {
      if (c < 1 || c > g.cols - 2 || !empty(g, c, r)) return false;
      if (r - 1 >= 1 && !empty(g, c, r - 1)) return false;
      if (!empty(g, c, r + 1)) return false;
    }
    return true;
  }

  function fill(g, r, c0, c1, style) {
    for (let c = c0; c <= c1; c++) g.set(c, r, CELL.SLAB, style);
  }

  // 착지판을 바깥쪽(들어온 방향) 벽까지 늘린다. 이미 벽에 닿아 있으면 그대로 성공
  function extendToWall(g, t, style) {
    const a = t.dirIn > 0 ? t.c1 + 1 : 1;
    const b = t.dirIn > 0 ? g.cols - 2 : t.c0 - 1;
    if (a > b) return true;
    if (!canPlace(g, t.row, a, b)) return false;
    fill(g, t.row, a, b, style);
    if (t.dirIn > 0) t.c1 = b; else t.c0 = a;
    t.extended = true;
    return true;
  }

  SF.generateLevel = function (cfg, seed) {
    const rng = SF.makeRng(seed);
    const cols = cfg.world.cols;
    const inMin = 1, inMax = cols - 2;
    const goalRow = cfg.totalFloors - 1;
    const rows = cfg.totalFloors + 6;
    const g = SF.createGrid(cols, rows);
    for (let c = 0; c < cols; c++) g.set(c, 0, CELL.SOLID, STYLE.GROUND);
    for (let r = 1; r < rows; r++) {
      g.set(0, r, CELL.SOLID, STYLE.WALL);
      g.set(cols - 1, r, CELL.SOLID, STYLE.WALL);
    }
    const treads = [];
    const rocks = [];

    // 착지판을 바깥쪽으로 1칸 늘리고 그 위에 2칸 바위를 얹는다
    function placeRock(t, style) {
      const ec = t.dirIn > 0 ? t.c1 + 1 : t.c0 - 1;
      const r = t.row;
      if (r + 3 >= goalRow) return false; // 정상 바로 아래에 바위를 두면 정상 발판을 벽까지 넓힐 수 없다
      if (!canPlace(g, r, ec, ec)) return false;
      if (!empty(g, ec, r + 2) || !empty(g, ec, r + 3)) return false;
      fill(g, r, ec, ec, style);
      g.set(ec, r + 1, CELL.SOLID, STYLE.ROCK);
      g.set(ec, r + 2, CELL.SOLID, STYLE.ROCK);
      if (t.dirIn > 0) t.c1 = ec; else t.c0 = ec;
      t.extended = true;
      rocks.push({ col: ec, row: r + 1 });
      return true;
    }

    function makeSafe(t, style) {
      t.turn = 'safe';
      // 바깥을 눌렀을 때 이미 벽·바위·발판에 막혀 허공이 아니면 그대로 안전하다
      const exitCol = t.dirIn > 0 ? t.c1 : t.c0;
      if (SF.stepOutcome(g, exitCol, t.row, t.dirIn).type !== 'miss') return true;
      if (rng.chance(cfg.rockBumperChance) && placeRock(t, style)) return true;
      return extendToWall(g, t, style) || placeRock(t, style);
    }

    let row = 1, dir = +1, cursor = 3, flight = 0;
    // 비행(한 방향 계단 묶음)이 막히면 맵 전체를 버리지 않고 그 비행을 다시 뽑는다 (600층에서는 작은 실패도 쌓인다).
    // 같은 비행을 12번 실패하면 한 비행 더 앞으로 되돌린다
    const snaps = [];
    const save = () => ({ type: g.type.slice(), style: g.style.slice(), nT: treads.length, nR: rocks.length, row, dir, cursor, flight, tries: 0 });
    const restore = (s) => {
      g.type.set(s.type); g.style.set(s.style);
      treads.length = s.nT; rocks.length = s.nR;
      row = s.row; dir = s.dir; cursor = s.cursor; flight = s.flight;
    };
    let budget = 2000;
    let retry = false;
    for (;;) {
      if (!retry) {
        snaps.push(save());
        if (snaps.length > 4) snaps.shift();
      }
      retry = false;
      const fz = SF.zoneForFloor(cfg, row + 1).zone;
      const len = rng.int(...fz.flightTreads);
      // 낭떠러지로 끝낼 비행은 바깥에 빈 열이 남도록 벽 한 칸 앞에서 멈춘다
      const wantOpen = rng.chance(fz.openTurnChance);
      const lo = wantOpen ? inMin + 1 : inMin;
      const hi = wantOpen ? inMax - 1 : inMax;
      const start = treads.length;
      let goal = null;
      while (treads.length - start < len && row <= goalRow) {
        const { index: zi, zone: z } = SF.zoneForFloor(cfg, row + 1);
        const avail = dir > 0 ? hi - cursor + 1 : cursor - lo + 1;
        if (avail < z.treadWidth[0]) break;
        let w = Math.min(rng.int(z.treadWidth[0], z.treadWidth[1]), avail);
        let c0 = dir > 0 ? cursor : cursor - w + 1;
        let c1 = dir > 0 ? cursor + w - 1 : cursor;
        if (!canPlace(g, row, c0, c1)) {
          w = z.treadWidth[0];
          c0 = dir > 0 ? cursor : cursor - w + 1;
          c1 = dir > 0 ? cursor + w - 1 : cursor;
          if (!canPlace(g, row, c0, c1)) break;
        }
        fill(g, row, c0, c1, STYLE_BY_NAME[z.style]);
        const t = { row, c0, c1, flight, dirIn: dir, dirToNext: dir, isLanding: false,
          turn: null, zone: zi, extended: false, isGoal: false };
        treads.push(t);
        if (row === goalRow) { goal = t; break; }
        row++;
        cursor = dir > 0 ? c1 + 1 : c0 - 1;
      }

      if (goal) {
        // 정상: 진행 방향 벽까지 넓히고 금빛으로
        goal.isGoal = true;
        goal.dirToNext = 0;
        extendToWall(g, goal, STYLE.GOAL);
        goal.extended = false;
        fill(g, goal.row, goal.c0, goal.c1, STYLE.GOAL);
        break;
      }
      const failFlight = () => {
        if (--budget < 0) return false;
        if (++snaps[snaps.length - 1].tries > 12 && snaps.length > 1) snaps.pop();
        restore(snaps[snaps.length - 1]);
        retry = true;
        return true;
      };
      // 탭 방식에서는 한 칸짜리 비행(지그재그)도 된다
      if (treads.length - start < 1) {
        if (failFlight()) continue;
        return null;
      }

      const landing = treads[treads.length - 1];
      landing.isLanding = true;
      const lstyle = STYLE_BY_NAME[SF.zoneForFloor(cfg, landing.row + 1).zone.style];
      const outer = dir > 0 ? inMax - landing.c1 : landing.c0 - inMin;
      const exitCol = dir > 0 ? landing.c1 : landing.c0;
      // 바깥이 정말 허공일 때만 낭떠러지 (아래층 꺾임의 바위가 옆에 있으면 막힌 것)
      if (wantOpen && outer >= 1 && SF.stepOutcome(g, exitCol, landing.row, dir).type === 'miss') {
        landing.turn = 'open';
      } else if (!makeSafe(landing, lstyle)) {
        if (failFlight()) continue;
        return null;
      }
      dir = -dir;
      cursor = dir > 0 ? landing.c1 + 1 : landing.c0 - 1;
      flight++;
    }

    for (let i = 0; i + 1 < treads.length; i++) {
      treads[i].dirToNext = treads[i + 1].c0 > treads[i].c1 ? +1 : -1;
    }

    return {
      grid: g,
      treads,
      rocks,
      spawn: { x: cfg.world.cell + 4, y: 0 },
      goalRow,
      seed,
    };
  };

  // 머리 공간 규칙 위반 목록 (비면 통과). 바위는 무엇 위에 얹혀도 되지만, 발판 바로 아래 칸은 비어야 한다
  SF.checkHeadroom = function (level) {
    const g = level.grid;
    const out = [];
    for (let r = 1; r < g.rows - 1; r++) {
      for (let c = 1; c <= g.cols - 2; c++) {
        if (g.get(c, r) !== CELL.EMPTY && g.get(c, r + 1) === CELL.SLAB) {
          out.push('slab at (' + c + ',' + (r + 1) + ') sits right above (' + c + ',' + r + ')');
        }
      }
    }
    return out;
  };

  SF.treadIndexMap = function (level) {
    const g = level.grid;
    const map = new Int32Array(g.cols * g.rows).fill(-1);
    level.treads.forEach((t, i) => {
      for (let c = t.c0; c <= t.c1; c++) map[t.row * g.cols + c] = i;
    });
    return map;
  };

  // 모든 디딤판 칸에서 '허공 쪽'을 잘못 눌렀을 때 실제 물리로 몇 층 떨어지나 (탭 방식, §12)
  // outward = 착지판에서 들어온 방향을 계속 누른 경우 (낭떠러지 꺾임을 지나친 것)
  // only(t, dir, i)를 주면 그 경우만 잰다 (빠르게)
  SF.measureMissFalls = function (level, cfg, only) {
    const world = new SF.World(level.grid, cfg);
    const g = level.grid;
    const cs = cfg.world.cell;
    const maxSteps = Math.ceil(10 / cfg.physics.fixedStep);
    const out = [];
    level.treads.forEach((t, i) => {
      if (t.isGoal) return;
      for (let c = t.c0; c <= t.c1; c++) {
        if (g.get(c, t.row + 1) === CELL.SOLID) continue; // 바위가 얹힌 칸에는 설 수 없다
        for (const dir of [-1, 1]) {
          if (only && !only(t, dir, i)) continue;
          if (SF.stepOutcome(g, c, t.row, dir).type !== 'miss') continue;
          const p = SF.createPlayer(c * cs + (cs - cfg.player.width) / 2, t.row * cs);
          const st = SF.createStepper();
          SF.stepperPress(st, dir, cfg);
          let land = null;
          for (let k = 0; k < maxSteps && !land; k++) land = SF.updateStepper(st, p, world, cfg).find((e) => e.type === 'land');
          const floor = t.row + 1;
          const landedFloor = land ? land.floor : floor;
          out.push({ treadIndex: i, col: c, side: dir, outward: t.isLanding && dir === t.dirIn,
            floor, landedFloor, fallFloors: floor - landedFloor });
        }
      }
    });
    return out;
  };

  const overCap = (cfg, f) => f.fallFloors > SF.zoneForFloor(cfg, f.floor).zone.maxFallFloors;

  // 구간 한도보다 깊은 낭떠러지 추락을 고친다: 같은 쪽 아래 착지판을 벽까지 늘려 받침으로, 없으면 그 꺾임을 안전하게.
  // (계단 중간에서 뒤로 잘못 누른 추락은 고칠 방법이 없으므로 검증에서 걸러 다른 시드로 다시 만든다)
  SF.fixFallDepths = function (level, cfg, rng) {
    const g = level.grid;
    let fixes = 0;
    // 고치는 대상은 열린 꺾임에서 바깥으로 잘못 누른 추락뿐이라 그것만 잰다.
    // 발판을 늘리면 추락은 짧아지기만 하므로, 앞서 괜찮았던 디딤판은 다시 잴 필요 없이 문제가 있던 곳부터 잰다
    let from = 0;
    const outwardOpen = (t, dir, i) => i >= from && t.isLanding && dir === t.dirIn && t.turn === 'open';
    for (let iter = 0; iter < 50; iter++) {
      const bad = SF.measureMissFalls(level, cfg, outwardOpen)
        .find((f) => f.outward && level.treads[f.treadIndex].turn === 'open' && overCap(cfg, f));
      if (!bad) return fixes;
      from = bad.treadIndex;
      const t = level.treads[bad.treadIndex];
      const maxFall = SF.zoneForFloor(cfg, bad.floor).zone.maxFallFloors;
      // 바위가 얹힌 착지판은 제외: 바위 너머를 늘리면 바위와 벽 사이에 갇힌다
      const hasRock = (L) => level.rocks.some((rk) => rk.row === L.row + 1 && rk.col >= L.c0 && rk.col <= L.c1);
      const candidates = level.treads.filter((L) => L.isLanding && L.dirIn === bad.side &&
        L.row < t.row && t.row - L.row <= maxFall && !hasRock(L) && canExtend(g, L));
      if (candidates.length) {
        const L = rng.pick(candidates);
        extendToWall(g, L, g.getStyle(L.c0, L.row));
        L.turn = 'safe';
      } else if (extendToWall(g, t, g.getStyle(t.c0, t.row))) {
        t.turn = 'safe';
      } else {
        return fixes;
      }
      fixes++;
    }
    return fixes;
  };

  // 바위가 없고, 벽까지 빈칸이 있으며 규칙을 지키며 늘릴 수 있는 착지판
  function canExtend(g, L) {
    const a = L.dirIn > 0 ? L.c1 + 1 : 1;
    const b = L.dirIn > 0 ? g.cols - 2 : L.c0 - 1;
    return a <= b && canPlace(g, L.row, a, b);
  }

  // 구간 i의 층 수
  function zoneSpan(cfg, i) {
    const from = i === 0 ? 1 : cfg.zones[i - 1].untilFloor + 1;
    return Math.min(cfg.zones[i].untilFloor, cfg.totalFloors) - from + 1;
  }
  SF.zoneSpan = zoneSpan;

  // 구간 i의 층 범위 (예: "21~40층")
  function zoneRange(cfg, i) {
    const from = i === 0 ? 1 : cfg.zones[i - 1].untilFloor + 1;
    return from + '~' + Math.min(cfg.zones[i].untilFloor, cfg.totalFloors) + '층';
  }

  // 맵 검증. 오류 목록(비면 통과)
  SF.validateLevel = function (level, cfg) {
    const errors = SF.checkHeadroom(level).map((h) => '머리 공간 규칙 위반: ' + h);
    const fromSpawn = SF.runBot(level, cfg);
    if (!fromSpawn.reached) {
      // 시작점에서도 못 오르면 나머지 검사도 모두 실패한다 → 오래 걸리지 않게 여기서 멈춘다
      errors.push('시작점에서 출발한 봇이 ' + fromSpawn.maxFloor + '층에서 막혔어요');
      return errors;
    }
    level.treads.forEach((t, i) => {
      const r = SF.runBot(level, cfg, { startTread: i });
      if (!r.reached) errors.push((t.row + 1) + '층 디딤판에서 출발한 봇이 ' + r.maxFloor + '층에서 막혔어요');
    });
    for (const f of SF.measureMissFalls(level, cfg)) {
      const max = SF.zoneForFloor(cfg, f.floor).zone.maxFallFloors;
      if (f.fallFloors > max) {
        errors.push(f.floor + '층에서 ' + (f.side > 0 ? '▶' : '◀') + '를 잘못 누르면 ' + f.fallFloors + '층 떨어져요 (한도 ' + max + '층)');
      }
    }
    // 낭떠러지를 두기로 한 구간(20층 이상)에는 추락 깊이 조절 뒤에도 낭떠러지가 하나는 남아 있어야 한다
    // (짧은 장애물 시험 구간은 장애물이 위험 요소라 빠질 수 있다)
    cfg.zones.forEach((z, i) => {
      if (!(z.openTurnChance > 0) || zoneSpan(cfg, i) < 20) return;
      const has = level.treads.some((t) => t.turn === 'open' && SF.zoneForFloor(cfg, t.row + 1).index === i);
      if (!has) errors.push(zoneRange(cfg, i) + ' 구간에 낭떠러지가 하나도 남지 않았어요');
    });
    // 바위 윗면에 떨어지면: 좌우 어느 쪽으로든 눌러서 경로(디딤판·바닥)로 돌아올 수 있어야 한다
    const world = new SF.World(level.grid, cfg);
    const map = SF.treadIndexMap(level);
    for (const rk of level.rocks) {
      const sides = rockSides(level, cfg, rk, world, map);
      if (sides.includes('stuck')) errors.push((rk.row + 2) + '층 높이 바위에서 내려오면 길이 아닌 곳에 떨어져요');
      if (!sides.includes('path')) errors.push((rk.row + 2) + '층 높이 바위에서 내려올 길이 없어요');
    }
    return errors;
  };

  // 바위 윗면에서 왼쪽·오른쪽을 각각 계속 눌렀을 때: 'path'(길에 닿음) / 'blocked'(막힘) / 'stuck'(길 아닌 곳에 멈춤)
  function rockSides(level, cfg, rk, world, map) {
    const cs = cfg.world.cell;
    return [-1, 1].map((d) => {
      // 같은 쪽을 계속 눌러서(다른 바위 위를 거쳐도 됨) 길에 닿으면 이 쪽은 통과
      const p = SF.createPlayer(rk.col * cs + (cs - cfg.player.width) / 2, (rk.row + 1) * cs);
      const st = SF.createStepper();
      let result = 'stuck';
      for (let tap = 0; tap < 8 && result === 'stuck'; tap++) {
        SF.stepperPress(st, d, cfg);
        let bumped = false;
        for (let k = 0; k < 600; k++) {
          if (SF.updateStepper(st, p, world, cfg).some((e) => e.type === 'bump')) { bumped = true; break; }
          if (st.mode === 'idle' && st.queue.length === 0) break;
        }
        if (bumped || st.mode !== 'idle') { result = 'blocked'; break; }
        if (SF.treadUnder(level, map, p) !== -1) result = 'path';
      }
      return result;
    });
  }
  // 바위 위에 떨어져도 내려올 수 있는가 (한쪽은 길로 이어지고, 길 아닌 곳에 멈추는 쪽이 없음)
  SF.rockEscapes = function (level, cfg, rk, world, map) {
    const sides = rockSides(level, cfg, rk, world, map);
    return sides.includes('path') && !sides.includes('stuck');
  };

  // 내려올 길이 없는 바위를 치우고, 그 꺾임은 벽까지 넓힌 발판으로 막는다(못 넓히면 열린 꺾임 — 추락 깊이는 검사가 본다).
  // 바위 하나를 치우면 다른 바위 사정이 바뀔 수 있어 몇 번 되풀이한다. 고친 바위 수를 돌려준다
  SF.repairRocks = function (level, cfg) {
    const g = level.grid;
    let fixed = 0;
    for (let pass = 0; pass < 3; pass++) {
      const world = new SF.World(g, cfg);
      const map = SF.treadIndexMap(level);
      const bad = level.rocks.filter((rk) => !SF.rockEscapes(level, cfg, rk, world, map));
      if (!bad.length) break;
      for (const rk of bad) {
        g.set(rk.col, rk.row, CELL.EMPTY, 0);
        g.set(rk.col, rk.row + 1, CELL.EMPTY, 0);
        level.rocks.splice(level.rocks.indexOf(rk), 1);
        const t = level.treads.find((x) => x.row === rk.row - 1 && x.c0 <= rk.col && rk.col <= x.c1);
        if (t) {
          const outward = SF.stepOutcome(g, t.dirIn > 0 ? t.c1 : t.c0, t.row, t.dirIn).type;
          t.turn = outward !== 'miss' || extendToWall(g, t, g.getStyle(t.c0, t.row)) ? 'safe' : 'open';
        }
        fixed++;
      }
    }
    return fixed;
  };

  // 시드로 지형 만들기 → 추락 깊이 조절 → 내려올 길 없는 바위 고치기 (검사 전 단계, 빠름). 실패하면 null
  function terrain(cfg, seed) {
    const level = SF.generateLevel(cfg, seed);
    if (!level) return null;
    SF.fixFallDepths(level, cfg, SF.makeRng(seed ^ 0x5bd1e995));
    SF.repairRocks(level, cfg);
    level.hazards = [];
    level.crumbles = [];
    level.hazardTry = -1;
    return level;
  }
  const hazardRng = (seed, h) => SF.makeRng(((seed ^ 0x2545f491) + h * 977) >>> 0);

  // 생성 → 추락 깊이 조절 → 검증. 실패하면 다른 시드로 최대 maxAttempts번
  SF.buildLevel = function (cfg, maxAttempts) {
    const tries = maxAttempts || 10;
    let last = null;
    for (let k = 0; k < tries; k++) {
      const seed = cfg.seed + k * 7919;
      const level = terrain(cfg, seed);
      if (!level) {
        last = { level: null, attempts: k + 1,
          report: { errors: ['시드 ' + seed + '로 맵을 만들지 못했어요'], botSeconds: 0, falls: [] } };
        continue;
      }
      const errors = SF.validateLevel(level, cfg);
      if (!errors.length && cfg.zones.some((z) => z.hazards)) {
        // 장애물: 조심스러운 봇이 안 맞고 통과하고, 맞거나 발판이 부서져도 추락이 한도 안일 때까지 배치만 다시
        let fair = null;
        for (let h = 0; h < 8; h++) {
          SF.placeHazards(level, cfg, hazardRng(seed, h));
          level.hazardTry = h;
          fair = SF.checkHazardFairness(level, cfg);
          if (fair.reached && fair.hits === 0 && fair.pushes === 0 && !fair.overCap.length) break;
        }
        if (!fair.reached || fair.hits || fair.pushes) {
          errors.push('장애물을 공정하게 놓지 못했어요 (조심스러운 봇이 ' + fair.hits + '번 맞고 바람에 ' + fair.pushes +
            '번 밀려 ' + fair.maxFloor + '층까지)');
        }
        for (const m of fair.overCap) errors.push(m);
      }
      const report = { errors, botSeconds: SF.runBot(level, cfg).seconds, falls: SF.measureMissFalls(level, cfg) };
      last = { level, attempts: k + 1, report };
      if (!errors.length) return last;
    }
    return last;
  };

  // config.js에서 맵을 망가뜨리는 값을 찾아 한국어로 알려준다 (비면 문제 없음)
  SF.checkConfig = function (cfg) {
    const out = [];
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    const pair = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger) && v[0] <= v[1];
    if (!num(cfg.seed)) out.push('seed는 따옴표 없이 숫자로 적어 주세요 (지금: ' + JSON.stringify(cfg.seed) + ')');
    if (!Number.isInteger(cfg.totalFloors) || cfg.totalFloors < 10) {
      out.push('totalFloors는 10 이상의 정수여야 해요 (지금: ' + JSON.stringify(cfg.totalFloors) + ')');
    }
    const P = cfg.physics || {};
    for (const k of ['gravity', 'maxFallSpeed']) {
      if (!num(P[k]) || P[k] <= 0) out.push('physics.' + k + '는 0보다 커야 해요 (지금: ' + P[k] + ')');
    }
    const S = cfg.step || {};
    if (!num(S.hopTime) || S.hopTime <= 0 || S.hopTime > 0.5) {
      out.push('step.hopTime은 0보다 크고 0.5 이하여야 해요 (지금: ' + S.hopTime + ')');
    }
    if (!Number.isInteger(S.queueMax) || S.queueMax < 1) {
      out.push('step.queueMax는 1 이상의 정수여야 해요 (지금: ' + S.queueMax + ')');
    }
    for (const k of ['missSpeed', 'missPopVy', 'snapTime']) {
      if (!num(S[k]) || S[k] < 0) out.push('step.' + k + '는 0 이상이어야 해요 (지금: ' + S[k] + ')');
    }
    const C = cfg.combo || {};
    if (!num(C.timeout) || C.timeout <= 0) out.push('combo.timeout은 0보다 커야 해요 (지금: ' + C.timeout + ')');
    const SC0 = cfg.school || {};
    if (!Number.isInteger(SC0.grade) || SC0.grade < 1) out.push('school.grade는 1 이상의 정수여야 해요 (지금: ' + JSON.stringify(SC0.grade) + ')');
    if (!Number.isInteger(SC0.classCount) || SC0.classCount < 1 || SC0.classCount > 30) {
      out.push('school.classCount는 1~30 사이 정수여야 해요 (지금: ' + JSON.stringify(SC0.classCount) + ')');
    }
    const T = cfg.teacher || {};
    if (typeof T.password !== 'string' || !T.password.trim()) {
      out.push("teacher.password는 '6666'처럼 따옴표 안에 적어 주세요 (지금: " + JSON.stringify(T.password) + ')');
    }
    if (!num(cfg.timeLimitSec) || cfg.timeLimitSec < 0) {
      out.push('timeLimitSec는 0(제한 없음) 이상의 초여야 해요 (지금: ' + JSON.stringify(cfg.timeLimitSec) + ')');
    }
    const QZ = cfg.quiz || {};
    for (const k of ['firstFloor', 'every', 'count']) {
      if (!Number.isInteger(QZ[k]) || QZ[k] < 1) out.push('quiz.' + k + '는 1 이상의 정수여야 해요 (지금: ' + JSON.stringify(QZ[k]) + ')');
    }
    const SC = cfg.score || {};
    for (const k of ['perFloor', 'finishBonus', 'perSecondLeft', 'perCorrect', 'perCombo']) {
      if (!num(SC[k]) || SC[k] < 0) out.push('score.' + k + '는 0 이상의 숫자여야 해요 (지금: ' + JSON.stringify(SC[k]) + ')');
    }
    if (!Array.isArray(C.milestones)) out.push('combo.milestones는 [10, 30, 50]처럼 숫자 목록이어야 해요');
    if (!Array.isArray(cfg.zones) || cfg.zones.length === 0) {
      out.push('zones에 구간이 하나 이상 있어야 해요');
      return out;
    }
    cfg.zones.forEach((z, i) => {
      const name = 'zones[' + i + ']';
      if (!pair(z.treadWidth) || z.treadWidth[0] < 1 || z.treadWidth[1] > 3 || z.treadWidth[0] > 2) {
        out.push(name + '.treadWidth는 1~3 사이 정수 [최소, 최대]로, 최소는 2 이하로 해 주세요 (지금: ' + JSON.stringify(z.treadWidth) + ')');
      }
      if (!pair(z.flightTreads) || z.flightTreads[0] < 1) {
        out.push(name + '.flightTreads는 [최소, 최대] 정수로, 최소는 1 이상이어야 해요 (지금: ' + JSON.stringify(z.flightTreads) + ')');
      }
      if (!num(z.openTurnChance) || z.openTurnChance < 0 || z.openTurnChance > 1) {
        out.push(name + '.openTurnChance는 0~1 사이여야 해요 (지금: ' + z.openTurnChance + ')');
      }
      if (!Number.isInteger(z.maxFallFloors) || z.maxFallFloors < 0) {
        out.push(name + '.maxFallFloors는 0 이상의 정수여야 해요 (지금: ' + z.maxFallFloors + ')');
      }
      if (!(z.style in STYLE_BY_NAME)) out.push(name + ".style은 'plank', 'brick', 'branch' 중 하나여야 해요");
      if (z.hazards !== undefined) {
        if (!z.hazards || typeof z.hazards !== 'object') {
          out.push(name + '.hazards는 { spikeBall: [2, 4] } 처럼 적어 주세요');
          return;
        }
        for (const k of Object.keys(z.hazards)) {
          const v = z.hazards[k];
          if (k === 'double') {
            if (!num(v) || v < 0 || v > 1) out.push(name + '.hazards.double은 0~1 사이여야 해요 (지금: ' + v + ')');
          } else if (k === 'speed') {
            if (!num(v) || v <= 0 || v > 3) out.push(name + '.hazards.speed는 0보다 크고 3 이하여야 해요 (지금: ' + v + ')');
          } else if (k === 'crumbleDelay') {
            if (!num(v) || v <= 0 || v > 3) out.push(name + '.hazards.crumbleDelay는 0보다 크고 3 이하(초)여야 해요 (지금: ' + v + ')');
          } else if (SF.HAZARD_KINDS.indexOf(k) < 0) {
            out.push(name + '.hazards의 ' + k + '는 없는 장애물이에요 (' + SF.HAZARD_KINDS.concat(SF.HAZARD_OPTIONS).join(', ') + ' 중에서)');
          } else if (k === 'gust') {
            if (typeof v !== 'boolean') out.push(name + '.hazards.gust는 true(바람 있음) 또는 false로 적어 주세요 (지금: ' + JSON.stringify(v) + ')');
          } else if (k === 'crumble') {
            if (!num(v) || v < 0 || v > 1) out.push(name + '.hazards.crumble은 0~1 사이여야 해요 (지금: ' + v + ')');
          } else if (!pair(v) || v[0] < 1) {
            out.push(name + '.hazards.' + k + '는 [최소, 최대] 층 간격으로, 최소 1 이상이어야 해요 (지금: ' + JSON.stringify(v) + ')');
          }
        }
      }
    });
    if (cfg.zones.some((z) => z.hazards)) {
      const O = cfg.obstacles || {};
      const pos = (path, v) => { if (!num(v) || v <= 0) out.push('obstacles.' + path + '는 0보다 커야 해요 (지금: ' + v + ')'); };
      pos('knockSpeed', O.knockSpeed);
      pos('spikeBall.period', O.spikeBall && O.spikeBall.period);
      pos('banana.period', O.banana && O.banana.period);
      pos('banana.speed', O.banana && O.banana.speed);
      pos('crumble.delay', O.crumble && O.crumble.delay);
      pos('acorn.period', O.acorn && O.acorn.period);
      pos('acorn.speed', O.acorn && O.acorn.speed);
      if (cfg.zones.some((z) => z.hazards && z.hazards.gust)) {
        const g = O.gust || {};
        for (const k of ['period', 'warn', 'blow', 'hold']) pos('gust.' + k, g[k]);
        if (num(g.period) && num(g.warn) && num(g.blow) && g.warn + g.blow >= g.period) {
          out.push('obstacles.gust의 warn + blow(' + (g.warn + g.blow) + '초)는 period(' + g.period + '초)보다 짧아야 해요 (바람이 멎는 틈이 있어야 해요)');
        }
      }
    }
    return out;
  };

  // 구간 연습 버튼: 장애물이 처음 나오는 구간마다 { 시작 층, 이름 }
  const PRACTICE_NAMES = { spikeBall: '가시공', monkey: '원숭이', crumble: '금 간 발판', acorn: '도토리', gust: '돌풍' };
  SF.practiceStarts = function (cfg) {
    const out = [];
    let from = 1;
    for (const z of cfg.zones) {
      const kinds = z.hazards ? Object.keys(z.hazards).filter((k) => PRACTICE_NAMES[k] && z.hazards[k]) : [];
      if (kinds.length) out.push({ floor: from, label: z.name || (kinds.length === 1 ? PRACTICE_NAMES[kinds[0]] : '섞어서') });
      from = z.untilFloor + 1;
    }
    for (const x of cfg.practiceExtra || []) {
      if (Number.isInteger(x.floor) && x.floor >= 1 && x.floor <= cfg.totalFloors) out.push({ floor: x.floor, label: String(x.label || '연습') });
    }
    return out;
  };

  // 게임이 쓰는 입구: 설정 검사 → 맵 만들기 → 화면에 보여줄 안내 목록.
  // fatal이면 맵을 만들 수 없는 것 (게임을 시작하지 않고 안내만 보여준다)
  // ---- 미리 검사한 맵: 검사는 PC(테스트·조정 패널)에서 한 번, 학생 기기는 그 결과(map)로 검사 없이 바로 만든다
  // 맵 모양과 검사 결과를 바꾸는 설정만 모아 만든 지문 (화면·소리 설정은 빼고)
  const MAP_KEYS = ['seed', 'totalFloors', 'world', 'player', 'step', 'physics', 'zones', 'obstacles', 'rockBumperChance', 'quiz', 'bot'];
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return String(JSON.stringify(v));
  }
  SF.mapFingerprint = function (cfg) {
    const s = stable(MAP_KEYS.map((k) => cfg[k]));
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  // config.js에 붙여 넣을 한 줄
  SF.mapLine = (level, cfg) => 'map: { seed: ' + level.seed + ', hazardTry: ' + level.hazardTry + ", check: '" + SF.mapFingerprint(cfg) + "' }";

  SF.prepareLevel = function (cfg) {
    const messages = SF.checkConfig(cfg);
    if (!messages.length && cfg.map && cfg.map.check === SF.mapFingerprint(cfg)) {
      try {
        const level = terrain(cfg, cfg.map.seed);
        if (level) {
          if (cfg.zones.some((z) => z.hazards)) {
            SF.placeHazards(level, cfg, hazardRng(cfg.map.seed, cfg.map.hazardTry));
            level.hazardTry = cfg.map.hazardTry;
          }
          return { level, report: { errors: [], botSeconds: null, falls: [], fast: true }, attempts: 0, messages, fatal: false };
        }
      } catch (_) { /* 아래 전체 검사로 */ }
    }
    const configOk = !messages.length;
    let build;
    try {
      // 설정 문제는 다른 시드로 다시 해도 안 고쳐지므로 한 번만 시도한다
      build = SF.buildLevel(cfg, messages.length ? 1 : 10);
    } catch (e) {
      messages.push('맵을 만드는 중 오류가 났어요: ' + e.message);
      return { level: null, report: null, attempts: 0, messages, fatal: true };
    }
    if (!build.level) {
      messages.push('이 설정으로는 맵을 만들 수 없어요. 위에 적힌 값을 고쳐 주세요.');
      return { level: null, report: build.report, attempts: build.attempts, messages, fatal: true };
    }
    for (const err of build.report.errors) messages.push('맵 검사: ' + err);
    if (configOk && !build.report.errors.length) {
      messages.push('맵을 처음부터 검사하느라 늦게 열렸어요. config.js의 map 줄을 이렇게 바꾸면 다음부터 빨리 열려요: ' + SF.mapLine(build.level, cfg));
    }
    return { level: build.level, report: build.report, attempts: build.attempts, messages, fatal: false };
  };
})(window.SF);

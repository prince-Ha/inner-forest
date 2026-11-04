// 브라우저에서 도는 아주 작은 테스트 도구 + 게임 로직 테스트.
// tests.html을 열면 자동으로 실행되고 결과를 window.TEST_RESULTS에 남긴다.
(function () {
  'use strict';

  const tests = [];
  function test(name, fn) { tests.push({ name, fn }); }

  function fmt(v) { return typeof v === 'string' ? JSON.stringify(v) : String(v); }
  function fail(msg) { throw new Error(msg); }
  function ok(cond, msg) { if (!cond) fail(msg || 'expected truthy'); }
  function eq(a, b, msg) {
    if (a !== b) fail((msg ? msg + ': ' : '') + 'expected ' + fmt(b) + ', got ' + fmt(a));
  }
  function near(a, b, tol, msg) {
    if (!(Math.abs(a - b) <= tol)) fail((msg ? msg + ': ' : '') + 'expected ' + b + ' ±' + tol + ', got ' + a);
  }

  // ---------------------------------------------------------------- Task 1
  test('floorAt', () => {
    eq(SF.floorAt(0), 1);
    eq(SF.floorAt(15.99), 1);
    eq(SF.floorAt(16), 2);
    eq(SF.floorAt(944), 60);
  });

  test('rng deterministic', () => {
    const a = SF.makeRng(42), b = SF.makeRng(42), c = SF.makeRng(43);
    const sa = [], sb = [], sc = [];
    for (let i = 0; i < 5; i++) { sa.push(a.next()); sb.push(b.next()); sc.push(c.next()); }
    eq(sa.join(), sb.join(), 'same seed');
    ok(sa.join() !== sc.join(), 'different seed should differ');
    ok(sa.every((v) => v >= 0 && v < 1), 'values in [0,1)');
  });

  test('rng.int inclusive', () => {
    const r = SF.makeRng(7);
    let saw2 = false, saw3 = false;
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 3);
      ok(v === 2 || v === 3, 'out of range: ' + v);
      if (v === 2) saw2 = true;
      if (v === 3) saw3 = true;
    }
    ok(saw2 && saw3, 'both ends should appear');
  });

  test('approach', () => {
    eq(SF.approach(10, 0, 3), 7);
    eq(SF.approach(1, 0, 3), 0);
    eq(SF.approach(-1, 0, 3), 0);
  });

  // ---------------------------------------------------------------- Task 2
  // ASCII 지도: 첫 줄이 가장 위 행, 마지막 줄이 행 0(바닥). '#' 벽·바닥, 'R' 바위, '=' 발판
  const W = (lines) => new SF.World(SF.gridFromAscii(lines), GAME_CONFIG);

  test('grid: out of range', () => {
    const g = SF.gridFromAscii(['#..........#', '############']);
    eq(g.get(-1, 5), SF.CELL.SOLID, 'left of world');
    eq(g.get(3, -1), SF.CELL.SOLID, 'below ground');
    eq(g.get(3, 999), SF.CELL.EMPTY, 'above top inside');
    eq(g.get(0, 999), SF.CELL.SOLID, 'above top wall');
    eq(g.get(3, 0), SF.CELL.SOLID, 'ground');
    eq(g.get(3, 1), SF.CELL.EMPTY, 'air');
  });

  test('world: support', () => {
    const w1 = W(['#..........#', '############']);
    ok(w1.hasSupport(20, 8, 0), 'on ground');
    ok(!w1.hasSupport(20, 8, 1), 'above ground');
    const w2 = W(['#..........#', '#..==......#', '############']);
    ok(w2.hasSupport(73, 8, 16), 'hanging 7px over the edge still stands');
    ok(!w2.hasSupport(80.5, 8, 16), 'past the edge');
  });

  test('world: landingTop highest', () => {
    const w = W(['#..........#', '#...===....#', '#..........#', '############']);
    eq(w.landingTop(70, 8, 40, 30), 32, 'slab crossed');
    eq(w.landingTop(20, 8, 40, -5), 0, 'ground crossed');
    eq(w.landingTop(20, 8, 40, 10), null, 'nothing crossed');
  });

  test('world: findStep direction', () => {
    const w = W(['#..........#', '#....=.....#', '############']);
    eq(w.findStep(73, 8, 0, 17, +1), 16, 'leading edge reaches slab');
    eq(w.findStep(97, 8, 0, 17, -1), 16, 'moving left onto slab');
    eq(w.findStep(97, 8, 0, 17, +1), null, 'slab behind is ignored');
    eq(w.findStep(73, 8, 0, 15, +1), null, 'too high for tolerance');
  });

  test('world: solidHit', () => {
    const w = W(['#..........#', '#.....R....#', '#.....R....#', '############']);
    eq(w.solidHit(90, 0, 8, 22, +1), 88, 'stop at rock face');
    eq(w.solidHit(110, 0, 8, 22, -1), 112, 'stop at rock back');
    eq(w.solidHit(60, 0, 8, 22, +1), null, 'free space');
    eq(w.solidHit(170, 0, 8, 22, +1), 168, 'right wall');
  });

  test('world: slabs not solid', () => {
    const w = W(['#..........#', '#....=.....#', '############']);
    ok(w.isFree(80, 0, 8, 22), 'one-way slab does not block');
    ok(!w.isFree(170, 0, 8, 22), 'wall blocks');
  });

  test('world: ceilingBottom', () => {
    const w = W(['#..........#', '#....R.....#', '#..........#', '#..........#', '############']);
    eq(w.ceilingBottom(80, 8, 22, 40), 32, 'rock bottom');
    const w2 = W(['#..........#', '#....=.....#', '#..........#', '#..........#', '############']);
    eq(w2.ceilingBottom(80, 8, 22, 50), null, 'slabs are not ceilings');
  });

  // ---------------------------------------------------------------- Task 3
  const CFG = GAME_CONFIG;
  function runSteps(p, world, dirFn, n) {
    const events = [];
    for (let i = 0; i < n; i++) {
      for (const e of SF.stepPlayer(p, world, dirFn(i, p), CFG)) events.push(e);
    }
    return events;
  }
  function runUntilLand(p, world, dir, maxSteps) {
    for (let i = 0; i < maxSteps; i++) {
      const land = SF.stepPlayer(p, world, dir, CFG).find((e) => e.type === 'land');
      if (land) return land;
    }
    return null;
  }
  const lastLand = (events) => events.filter((e) => e.type === 'land').pop();
  const FLAT = ['#..........#', '############'];
  const AIR = ['#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  const ZIGZAG = ['#..........#', '#..........#', '#....=.....#', '#.....=....#', '#....=.....#', '############'];

  test('physics: accel numbers', () => {
    const w = W(FLAT);
    const p = SF.createPlayer(20, 0);
    runSteps(p, w, () => +1, 1);
    near(p.vx, 7.5, 1e-9, 'one step of groundAccel');
    runSteps(p, w, () => +1, 59);
    eq(p.vx, 72, 'capped at walkSpeed');
  });

  test('physics: release decel', () => {
    const p = SF.createPlayer(60, 0);
    p.vx = 72;
    runSteps(p, W(FLAT), () => 0, 1);
    near(p.vx, 62, 1e-9);
  });

  test('physics: auto step up', () => {
    const w = W(['#..........#', '#...=======#', '############']);
    const p = SF.createPlayer(20, 0);
    const ev = runSteps(p, w, () => +1, 120);
    eq(p.y, 16, 'standing one floor up');
    ok(p.grounded, 'grounded');
    ok(ev.some((e) => e.type === 'stepUp' && e.dy === 16), 'stepUp event');
  });

  test('physics: idle never climbs', () => {
    const w = W(['#..........#', '#...=======#', '############']);
    const p = SF.createPlayer(50, 0);
    runSteps(p, w, () => 0, 120);
    eq(p.y, 0);
    eq(p.x, 50);
  });

  test('physics: 2-high rock blocks', () => {
    const w = W(['#..........#', '#.....R....#', '#.....R....#', '############']);
    const p = SF.createPlayer(20, 0);
    const ev = runSteps(p, w, () => +1, 240);
    eq(p.x, 88, 'pressed against the rock');
    eq(p.y, 0, 'did not climb');
    ok(ev.some((e) => e.type === 'bump'), 'bump event');
    ok(!ev.some((e) => e.type === 'stepUp'), 'no hop-jitter in front of the wall');
  });

  test('physics: 1-high solid is a step', () => {
    const w = W(['#..........#', '#..........#', '#.....R....#', '############']);
    const p = SF.createPlayer(20, 0);
    const ev = runSteps(p, w, () => +1, 200);
    ok(ev.some((e) => e.type === 'stepUp' && e.dy === 16), 'stepped onto the rock');
    ok(!ev.some((e) => e.type === 'bump'), 'never blocked');
  });

  test('physics: walk off and fall to ground', () => {
    const w = W(['#..........#', '#.====.....#', '#..........#', '#..........#', '############']);
    const p = SF.createPlayer(40, 48);
    const ev = runSteps(p, w, () => +1, 240);
    eq(p.y, 0, 'on the ground');
    eq(lastLand(ev).dropFloors, 3, 'fell three floors');
  });

  test('physics: land on lower slab', () => {
    const w = W(['#..........#', '#.====.....#', '#..........#', '#....=====.#', '############']);
    const p = SF.createPlayer(40, 48);
    const land = runUntilLand(p, w, +1, 400);
    ok(land, 'landed');
    eq(p.y, 16, 'caught by the lower slab');
    eq(land.dropFloors, 2);
  });

  test('physics: walk under high slab', () => {
    const w = W(['#..........#', '#...====...#', '#..........#', '############']);
    const p = SF.createPlayer(20, 0);
    runSteps(p, w, () => +1, 200);
    ok(p.x > 130, 'walked past, x=' + p.x);
    eq(p.y, 0);
  });

  test('physics: pass up through slab', () => {
    const w = W(['#..........#', '#..........#', '#..====....#', '#..........#', '############']);
    const p = SF.createPlayer(60, 0);
    p.grounded = false;
    p.vy = 350;
    runSteps(p, w, () => 0, 120);
    eq(p.y, 32, 'rose through, then landed on top');
    ok(p.grounded);
  });

  test('physics: air control limited', () => {
    const p = SF.createPlayer(80, 60);
    p.grounded = false;
    p.vx = 72;
    runSteps(p, W(AIR), () => -1, 1);
    near(p.vx, 69.75, 1e-9);
  });

  test('physics: air step tolerance', () => {
    const w = W(['#..........#', '#.....===..#', '#..........#', '#..........#', '############']);
    const p = SF.createPlayer(87.5, 46);
    p.grounded = false;
    p.vx = 72;
    p.vy = -50;
    const ev = runSteps(p, w, () => +1, 1);
    eq(p.y, 48, 'snapped onto the corner');
    ok(p.grounded);
    ok(ev.some((e) => e.type === 'land'), 'counts as landing');
  });

  test('physics: zigzag turn', () => {
    const w = W(ZIGZAG);
    const p = SF.createPlayer(40, 0);
    let reached = false;
    for (let i = 0; i < 400 && !reached; i++) {
      SF.stepPlayer(p, w, +1, CFG);
      reached = p.y === 32 && p.grounded;
    }
    ok(reached, 'reached the landing');
    // 다음 계단은 한 칸짜리라 계속 걸으면 끝에서 떨어진다 → 올라서는 순간까지만 본다
    let stepped = false;
    for (let i = 0; i < 60 && !stepped; i++) {
      stepped = SF.stepPlayer(p, w, -1, CFG).some((e) => e.type === 'stepUp');
    }
    ok(stepped, 'stepped up after reversing');
    eq(p.y, 48, 'turned and stepped onto the next flight');
    ok(p.grounded);
  });

  test('physics: overshoot open landing', () => {
    const w = W(ZIGZAG);
    const p = SF.createPlayer(40, 0);
    const ev = runSteps(p, w, () => +1, 300);
    eq(p.y, 0, 'fell to the ground');
    eq(lastLand(ev).dropFloors, 2);
  });

  // ---------------------------------------------------------------- Task 4
  let cachedLevel;
  const getL = () => cachedLevel || (cachedLevel = SF.generateLevel(CFG, CFG.seed));
  const zoneOf = (t) => SF.zoneForFloor(CFG, t.row + 1);

  test('level: generated', () => {
    ok(getL() !== null, 'default seed should generate');
  });

  test('level: treads continuous', () => {
    const t = getL().treads;
    for (let i = 0; i + 1 < t.length; i++) {
      const a = t[i], b = t[i + 1];
      eq(b.row, a.row + 1, 'row step at ' + i);
      ok(b.c0 === a.c1 + 1 || b.c1 === a.c0 - 1,
        'adjacent at ' + i + ': [' + a.c0 + ',' + a.c1 + '] -> [' + b.c0 + ',' + b.c1 + ']');
    }
  });

  test('level: start and goal', () => {
    const t = getL().treads;
    eq(t[0].row, 1, 'first tread');
    const g = t[t.length - 1];
    eq(g.row, CFG.totalFloors - 1, 'goal row');
    ok(g.isGoal, 'goal flag');
    ok(g.dirIn > 0 ? g.c1 === 10 : g.c0 === 1, 'goal reaches the wall');
  });

  test('level: headroom clean', () => {
    eq(SF.checkHeadroom(getL()).join('; '), '');
  });

  test('level: zone rules', () => {
    const L = getL();
    const lastFlight = L.treads[L.treads.length - 1].flight;
    const count = {};
    for (const t of L.treads) count[t.flight] = (count[t.flight] || 0) + 1;
    for (const f in count) {
      if (Number(f) !== lastFlight) ok(count[f] >= 1, 'flight ' + f + ' is empty');
    }
    for (const t of L.treads) {
      const z = zoneOf(t);
      if (t.turn === 'open') ok(z.index > 0, 'open turn in the first zone at row ' + t.row);
      if (t.isLanding || t.isGoal) continue;
      const w = t.c1 - t.c0 + 1;
      ok(w >= z.zone.treadWidth[0] && w <= z.zone.treadWidth[1], 'width ' + w + ' at row ' + t.row);
    }
  });

  test('level: open turn has a drop', () => {
    const L = getL();
    for (const t of L.treads) {
      if (t.turn !== 'open') continue;
      const outer = t.dirIn > 0 ? t.c1 + 1 : t.c0 - 1;
      eq(L.grid.get(outer, t.row), SF.CELL.EMPTY, 'outside of open landing at row ' + t.row);
    }
  });

  test('level: open turn ratio follows zones', () => {
    const stat = CFG.zones.map(() => ({ open: 0, all: 0 }));
    for (let s = 1; s <= 40; s++) {
      const L = SF.generateLevel(CFG, s);
      if (!L) continue;
      for (const t of L.treads) {
        if (!t.isLanding) continue;
        const z = stat[zoneOf(t).index];
        z.all++;
        if (t.turn === 'open') z.open++;
      }
    }
    CFG.zones.forEach((z, i) => {
      const ratio = stat[i].open / stat[i].all;
      // 바깥이 이미 아래층 바위 등에 막힌 꺾임은 낭떠러지가 될 수 없어서 줄어드는 쪽으로 0.2까지 허용
      ok(ratio >= z.openTurnChance - 0.2 && ratio <= z.openTurnChance + 0.15,
        'zone ' + i + ': open ratio ' + ratio.toFixed(2) + ' vs ' + z.openTurnChance);
    });
  });

  test('level: treadIndexMap', () => {
    const L = getL();
    const map = SF.treadIndexMap(L);
    L.treads.forEach((t, i) => {
      for (let c = t.c0; c <= t.c1; c++) eq(map[t.row * L.grid.cols + c], i, 'cell ' + c + ',' + t.row);
    });
    eq(map[0], -1, 'ground is not a tread');
  });

  test('level: deterministic', () => {
    const a = SF.generateLevel(CFG, 7), b = SF.generateLevel(CFG, 7), c = SF.generateLevel(CFG, 8);
    ok(a && b && c, 'generated');
    eq(a.grid.type.join(), b.grid.type.join(), 'same seed, same map');
    ok(a.grid.type.join() !== c.grid.type.join(), 'different seed, different map');
  });

  // ---------------------------------------------------------------- Task 5
  let cachedBuild, buildMs = 0;
  const getB = () => {
    if (!cachedBuild) {
      const t0 = performance.now();
      cachedBuild = SF.buildLevel(CFG);
      buildMs = performance.now() - t0;
    }
    return cachedBuild;
  };

  test('build: default seed valid', () => {
    const B = getB();
    eq(B.report.errors.join('; '), '', 'no validation errors');
    eq(B.attempts, 1, 'configured seed used as is');
  });

  // 시드를 여러 개 도는 무거운 검사는 아래 200층(장애물 앞 구간 포함)으로 — 600층 전체는 기본 맵 하나만 검사
  const SMALL = Object.assign({}, CFG, { totalFloors: 200, zones: CFG.zones.filter((z) => z.untilFloor <= 200) });

  test('build: seeds 1..10 valid', () => {
    for (let s = 1; s <= 10; s++) {
      const B = SF.buildLevel(Object.assign({}, SMALL, { seed: s }));
      eq(B.report.errors.join('; '), '', 'seed ' + s);
    }
  });

  test('bot: completes', () => {
    const r = SF.runBot(getB().level, CFG);
    ok(r.reached, 'reached the top, max floor ' + r.maxFloor);
    ok(r.seconds < CFG.totalFloors * 0.25, 'took ' + r.seconds.toFixed(1) + 's');
  });

  test('bot: from every tread', () => {
    const L = getB().level;
    L.treads.forEach((t, i) => {
      const r = SF.runBot(L, CFG, { startTread: i });
      ok(r.reached, 'from tread ' + i + ' (floor ' + (t.row + 1) + ') stuck at ' + r.maxFloor);
    });
  });

  test('falls: within zone max', () => {
    for (const f of getB().report.falls) {
      const max = SF.zoneForFloor(CFG, f.floor).zone.maxFallFloors;
      ok(f.fallFloors <= max, 'floor ' + f.floor + ' falls ' + f.fallFloors + ' > ' + max);
    }
  });

  test('falls: hard zone bites', () => {
    const big = getB().report.falls.filter((f) => f.floor > 40 && f.fallFloors >= 15);
    ok(big.length >= 1, 'no fall of 15+ floors in floors 41-60');
  });

  test('build: fast enough', () => {
    const t0 = performance.now();
    SF.buildLevel(SMALL);
    const ms = performance.now() - t0;
    ok(ms < 1500, 'buildLevel(200 floors) took ' + Math.round(ms) + 'ms');
  });

  // ---------------------------------------------------------------- 과학 퀴즈
  test('quiz: floors are 10..590', () => {
    const f = SF.quizFloors(CFG);
    eq(f.length, 30);
    eq(f[0], 10);
    eq(f[29], 590);
    for (let i = 1; i < f.length; i++) eq(f[i] - f[i - 1], 20, 'every 20 floors');
  });

  test('quiz: 30 different questions in a run', () => {
    const run = SF.createQuizRun(SF.QUESTIONS, CFG, SF.makeRng(5));
    const ids = SF.quizFloors(CFG).map((f) => { const q = SF.quizAt(run, CFG, f); SF.answerQuiz(run, f, 0); return q.id; });
    eq(new Set(ids).size, 30, 'distinct questions');
  });

  test('quiz: a floor is asked once and answers are counted', () => {
    const run = SF.createQuizRun(SF.QUESTIONS, CFG, SF.makeRng(6));
    eq(SF.quizAt(run, CFG, 11), null, 'not a quiz floor');
    const q = SF.quizAt(run, CFG, 10);
    ok(q && q.choices.length === 4, 'question at floor 10');
    eq(SF.quizAt(run, CFG, 10), q, 'same question until answered');
    const r1 = SF.answerQuiz(run, 10, q.answer);
    ok(r1.correct, 'right answer');
    eq(r1.answer, q.answer);
    eq(r1.explain, q.explain);
    eq(SF.quizAt(run, CFG, 10), null, 'asked once');
    const q2 = SF.quizAt(run, CFG, 30);
    ok(q2 && q2.id !== q.id, 'next floor, next question');
    const r2 = SF.answerQuiz(run, 30, (q2.answer + 1) % 4);
    ok(!r2.correct, 'wrong answer');
    eq(run.correct, 1);
    eq(run.wrong, 1);
  });

  test('quiz: small bank refills', () => {
    const bank = SF.QUESTIONS.slice(0, 5);
    const run = SF.createQuizRun(bank, CFG, SF.makeRng(7));
    for (const f of SF.quizFloors(CFG)) {
      const q = SF.quizAt(run, CFG, f);
      ok(q, 'a question at floor ' + f);
      SF.answerQuiz(run, f, 0);
    }
  });

  test('questions: well formed', () => {
    const Q = SF.QUESTIONS;
    ok(Q.length >= 40, 'count ' + Q.length);
    eq(new Set(Q.map((q) => q.id)).size, Q.length, 'unique ids');
    for (const q of Q) {
      ok(q.q && q.q.trim() && q.explain && q.explain.trim(), q.id + ' text');
      eq(q.choices.length, 4, q.id + ' choices');
      ok(q.choices.every((c) => c && c.trim()), q.id + ' empty choice');
      eq(new Set(q.choices).size, 4, q.id + ' duplicate choice');
      ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, q.id + ' answer');
    }
    const spread = [0, 1, 2, 3].map((a) => Q.filter((q) => q.answer === a).length);
    ok(spread.every((n) => n >= 6), 'answers spread over A-D: ' + spread.join(','));
  });

  test('game: quiz waits until standing on the quiz step', () => {
    const run = SF.createQuizRun(SF.QUESTIONS, CFG, SF.makeRng(8));
    const p = SF.createPlayer(4, 9 * 16); // 10층 높이에 서 있음
    const st = SF.createStepper();
    st.mode = 'hop';
    eq(SF.shouldAskQuiz(run, CFG, p, st), null, 'mid-hop');
    st.mode = 'idle';
    ok(SF.shouldAskQuiz(run, CFG, p, st), 'standing on floor 10');
    p.grounded = false;
    eq(SF.shouldAskQuiz(run, CFG, p, st), null, 'in the air');
    p.grounded = true;
    p.y = 10 * 16;
    eq(SF.shouldAskQuiz(run, CFG, p, st), null, 'floor 11 is not a quiz floor');
  });

  test('game: quiz clears queued taps', () => {
    const st = SF.createStepper();
    SF.stepperPress(st, 1, CFG);
    SF.stepperPress(st, -1, CFG);
    SF.openQuiz(st);
    eq(st.queue.length, 0);
  });

  // ---------------------------------------------------------------- 점수와 시간
  test('score: finished example', () => {
    const s = SF.computeScore({ bestFloor: 600, finished: true, climbTime: 600, correct: 24, maxCombo: 80 }, CFG);
    eq(s.floor, 6000); eq(s.finish, 3000); eq(s.speed, 1500); eq(s.quiz, 4800); eq(s.combo, 800);
    eq(s.total, 16100);
  });

  test('score: unfinished example', () => {
    const s = SF.computeScore({ bestFloor: 420, finished: false, climbTime: 900, correct: 18, maxCombo: 60 }, CFG);
    eq(s.finish, 0); eq(s.speed, 0);
    eq(s.total, 8400);
  });

  test('score: no time limit means no speed bonus', () => {
    const s = SF.computeScore({ bestFloor: 600, finished: true, climbTime: 300, correct: 0, maxCombo: 0 },
      Object.assign({}, CFG, { timeLimitSec: 0 }));
    eq(s.speed, 0);
    eq(s.total, 9000);
  });

  test('config: time, quiz and score values are checked', () => {
    const bad = Object.assign({}, CFG, { timeLimitSec: -1, quiz: { firstFloor: 10, every: 0, count: 30 },
      score: Object.assign({}, CFG.score, { perCorrect: 'x' }) });
    const msgs = SF.checkConfig(bad).join(' / ');
    ok(msgs.includes('timeLimitSec'), msgs);
    ok(msgs.includes('quiz.every'), msgs);
    ok(msgs.includes('score.perCorrect'), msgs);
  });

  // ---------------------------------------------------------------- 미리 검사한 맵 (학생 기기는 검사 없이 바로 만들기)
  const sameMap = (a, b) => {
    eq(JSON.stringify(a.treads), JSON.stringify(b.treads), 'treads');
    eq(JSON.stringify(a.rocks), JSON.stringify(b.rocks), 'rocks');
    eq(JSON.stringify(a.hazards), JSON.stringify(b.hazards), 'hazards');
    eq(JSON.stringify(a.crumbles), JSON.stringify(b.crumbles), 'crumbles');
    eq(a.grid.type.join(), b.grid.type.join(), 'grid');
  };

  test('map: default config has a current map entry', () => {
    ok(CFG.map, 'config.js has map');
    eq(CFG.map.check, SF.mapFingerprint(CFG), 'map.check is up to date (update it with the debug panel after editing zones)');
    eq(CFG.map.seed, getB().level.seed, 'map.seed');
    eq(CFG.map.hazardTry, getB().level.hazardTry, 'map.hazardTry');
  });

  test('map: fast build equals the full build', () => {
    const t0 = performance.now();
    const fast = SF.prepareLevel(CFG);
    const ms = performance.now() - t0;
    ok(fast.report.fast, 'took the fast path');
    eq(fast.messages.length, 0, fast.messages.join(' / '));
    sameMap(fast.level, getB().level);
    ok(ms < 500, 'fast build took ' + Math.round(ms) + 'ms');
  });

  test('map: fingerprint follows map settings, not screen settings', () => {
    const a = SF.mapFingerprint(CFG);
    eq(SF.mapFingerprint(Object.assign({}, CFG, { ui: { controlsRatio: 0.3, controlsMinPx: 80 } })), a, 'ui does not matter');
    ok(SF.mapFingerprint(Object.assign({}, CFG, { seed: CFG.seed + 1 })) !== a, 'seed matters');
    ok(SF.mapFingerprint(withZones((z) => { z[3].maxFallFloors = 11; })) !== a, 'zones matter');
  });

  test('map: stale check falls back to a full build', () => {
    const c = Object.assign({}, SMALL, { map: { seed: 1, hazardTry: 0, check: 'stale' } });
    const prep = SF.prepareLevel(c);
    ok(!prep.report.fast, 'full build');
    ok(!prep.fatal && prep.level, 'built');
    const hint = prep.messages.join(' / ');
    ok(hint.includes('map: { seed: ' + prep.level.seed + ', hazardTry: ' + prep.level.hazardTry + ", check: '" + SF.mapFingerprint(c) + "' }"), hint);
  });

  test('config600: zones match the plan', () => {
    eq(CFG.totalFloors, 600);
    eq(CFG.zones.map((z) => z.untilFloor).join(','), '20,40,60,100,150,200,280,360,440,500,600');
    const gusty = CFG.zones.map((z, i) => (z.hazards && z.hazards.gust ? i : -1)).filter((i) => i >= 0);
    eq(gusty.join(','), '9', 'gust only in 441-500');
  });

  test('hazards: quiz floors are rest stops', () => {
    const L = getB().level;
    const crumbly = new Set(L.crumbles.map((c) => c.col + ',' + c.row));
    const floors = SF.quizFloors(CFG);
    eq(floors.length, 30, 'quiz floors');
    for (const q of floors) {
      const row = q - 1;
      ok(!L.hazards.some((h) => h.row === row || h.row === row + 1), 'hazard at or above quiz floor ' + q);
      const t = L.treads.find((x) => x.row === row);
      for (let c = t.c0; c <= t.c1; c++) ok(!crumbly.has(c + ',' + row), 'crumbly step on quiz floor ' + q);
    }
  });

  test('hazards: 501-600 is the old hard test', () => {
    const B = getB();
    const top = B.level.hazards.filter((h) => h.row >= 500);
    ok(top.length > 0 && top.every((h) => h.speed === 1.5), 'speed 1.5 up top');
    const perRow = new Map();
    for (const h of top) perRow.set(h.row, (perRow.get(h.row) || 0) + 1);
    ok([...perRow.values()].some((n) => n >= 2), 'doubled hazards in 501-600');
    const topCrumbles = B.level.crumbles.filter((c) => c.row >= 500);
    ok(topCrumbles.length > 0 && topCrumbles.every((c) => c.delay === 0.47), 'crumble delay 0.47 up top');
    ok(B.report.falls.some((f) => f.floor > 500 && f.fallFloors >= 50), 'a deep fall up top');
  });

  // ---------------------------------------------------------------- Task 6
  // ---------------------------------------------------------------- 600층 맵 (장애물 없이 지형만)
  const Z6 = (u, fl, open, cap, style) => ({ untilFloor: u, treadWidth: [1, 1], flightTreads: fl, openTurnChance: open, maxFallFloors: cap, style });
  const CFG600 = Object.assign({}, CFG, { totalFloors: 600, zones: [
    Z6(20, [4, 6], 0, 2, 'plank'), Z6(40, [2, 4], 0.5, 8, 'brick'), Z6(60, [1, 3], 0.75, 30, 'branch'),
    Z6(100, [2, 4], 0.5, 10, 'brick'), Z6(150, [2, 4], 0.5, 15, 'branch'), Z6(200, [2, 4], 0.5, 15, 'plank'),
    Z6(280, [1, 3], 0.6, 20, 'branch'), Z6(360, [1, 3], 0.7, 30, 'brick'), Z6(440, [1, 3], 0.75, 40, 'branch'),
    Z6(500, [1, 2], 0.8, 50, 'brick'), Z6(600, [1, 2], 0.9, 100, 'branch'),
  ] });
  const SEEDS600 = Array.from({ length: 20 }, (_, i) => (i + 1) * 101 + 7);
  let cached600 = null;
  // 앞 10개 시드: 생성 → 추락 깊이 조절 → 바위 고치기 → 검사
  const get600 = () => cached600 || (cached600 = SEEDS600.slice(0, 10).map((s) => {
    const L = SF.generateLevel(CFG600, s);
    if (!L) return null;
    SF.fixFallDepths(L, CFG600, SF.makeRng(s ^ 0x5bd1e995));
    SF.repairRocks(L, CFG600);
    return { L, errors: SF.validateLevel(L, CFG600) };
  }));

  test('level600: most seeds generate', () => {
    const made = SEEDS600.filter((s) => SF.generateLevel(CFG600, s)).length;
    ok(made >= 19, 'generated ' + made + '/20');
  });

  test('level600: most seeds validate', () => {
    const built = get600().filter(Boolean);
    const clean = built.filter((b) => !b.errors.length);
    ok(clean.length >= Math.ceil(built.length * 0.7),
      'clean ' + clean.length + '/' + built.length + ': ' + built.filter((b) => b.errors.length).map((b) => b.errors[0]).join(' / '));
  });

  test('rocks: repaired rock tops can be left', () => {
    for (const b of get600().filter(Boolean)) {
      const world = new SF.World(b.L.grid, CFG600);
      const map = SF.treadIndexMap(b.L);
      for (const rk of b.L.rocks) ok(SF.rockEscapes(b.L, CFG600, rk, world, map), 'seed ' + b.L.seed + ' rock at floor ' + (rk.row + 2));
    }
  });

  test('dirTracker: last pressed wins', () => {
    const d = SF.createDirTracker();
    d.press('k', +1, 1);
    d.press('p1', -1, 2);
    eq(d.getDir(), -1);
  });

  test('dirTracker: release falls back', () => {
    const d = SF.createDirTracker();
    d.press('k', +1, 1);
    d.press('p1', -1, 2);
    d.release('p1');
    eq(d.getDir(), +1, 'back to the key still held');
    d.release('k');
    eq(d.getDir(), 0, 'nothing held');
  });

  test('dirTracker: slide changes direction', () => {
    const d = SF.createDirTracker();
    d.press('p1', -1, 1);
    d.press('p2', +1, 2);
    d.move('p1', +1, 3);
    d.move('p2', -1, 4);
    eq(d.getDir(), -1, 'latest slide wins');
    d.move('p1', +1, 5);
    eq(d.getDir(), -1, 'moving within the same half does not take over');
  });

  test('dirTracker: clear releases everything', () => {
    const d = SF.createDirTracker();
    d.press('a', +1, 1);
    d.press('b', -1, 2);
    d.clear();
    eq(d.getDir(), 0);
  });

  test('dirTracker: release unknown id is harmless', () => {
    const d = SF.createDirTracker();
    d.press('a', +1, 1);
    d.release('nope');
    d.move('ghost', -1, 9);
    eq(d.getDir(), +1);
  });

  test('advanceClock clamps long frames', () => {
    let r = SF.advanceClock(0, 5, 1 / 120);
    eq(r.steps, 30, '5s pause simulates at most 0.25s');
    r = SF.advanceClock(0, 1 / 60, 1 / 120);
    eq(r.steps, 2, '60Hz frame');
    r = SF.advanceClock(0.004, 0.005, 1 / 120);
    eq(r.steps, 1, 'carry-over');
    near(r.acc, 0.009 - 1 / 120, 1e-9, 'remainder kept');
  });

  const VP_CASES = [
    { w: 390, h: 844, dpr: 3, expect: { controlsH: 169, zoom: 6, viewW: 195, worldOffsetX: 1.5 } },
    { w: 360, h: 740, dpr: 2, expect: { controlsH: 148, zoom: 3, viewW: 240 } },
    { w: 412, h: 915, dpr: 2.625, expect: { canvasW: 1082, zoom: 5 } },
    { w: 320, h: 568, dpr: 1, expect: { controlsH: 114, zoom: 1, viewW: 320 } },
  ];
  VP_CASES.forEach((c) => {
    test('computeViewport ' + c.w + 'x' + c.h + '@' + c.dpr, () => {
      const v = SF.computeViewport(c.w, c.h, c.dpr, CFG);
      for (const k in c.expect) near(v[k], c.expect[k], 1e-9, k);
      ok(Number.isInteger(v.zoom) && v.zoom >= 1, 'integer zoom');
      ok(v.zoom * 192 <= v.canvasW, 'whole world width visible');
      ok(v.viewH > 0, 'positive view height');
      ok(v.controlsH >= CFG.ui.controlsMinPx, 'buttons at least ' + CFG.ui.controlsMinPx + 'px');
    });
  });

  test('camera snap uses climb anchor', () => {
    const cam = SF.createCamera(CFG);
    cam.snap(500, 300, { minTop: 284, maxTop: 5000 });
    near((cam.top - 500) / 300, 0.62, 1e-9);
  });

  test('camera keeps player inside margins', () => {
    const cam = SF.createCamera(CFG);
    const bounds = { minTop: 284, maxTop: 5000 };
    cam.snap(1500, 300, bounds);
    cam.update(1000, -420, true, 300, 1 / 60, bounds);
    const frac = (cam.top - 1000) / 300;
    ok(frac >= 0.12 - 1e-9 && frac <= 0.88 + 1e-9, 'player at ' + frac.toFixed(3) + ' of the screen');
  });

  // ---------------------------------------------------------------- Task 8
  test('sprites: frame sizes', () => {
    const S = SF.buildSprites();
    for (const name of ['idle', 'walk', 'step', 'fall', 'land']) {
      ok(S.player.right[name] && S.player.right[name].length > 0, 'frames for ' + name);
      for (const f of S.player.right[name]) { eq(f.width, 16, name + ' width'); eq(f.height, 24, name + ' height'); }
      eq(S.player.left[name].length, S.player.right[name].length, name + ' mirrored');
    }
    for (const st of ['plank', 'brick', 'branch', 'goal']) {
      for (const part of ['left', 'mid', 'right', 'single']) {
        const c = S.slab[st][part];
        eq(c.width + 'x' + c.height, '16x8', st + '.' + part);
      }
    }
    eq(S.rock.width + 'x' + S.rock.height, '16x32', 'rock');
    eq(S.spikeBall.length, 2, 'spike ball frames');
    eq(S.monkey.right.ready.width + 'x' + S.monkey.right.ready.height, '16x16', 'monkey');
    eq(S.monkey.left.throw.width, 16, 'mirrored monkey');
    eq(S.banana.length, 4, 'banana spin frames');
    eq(S.acorn.width + 'x' + S.acorn.height, '6x8', 'acorn');
    eq(S.crack.width + 'x' + S.crack.height, '16x8', 'crack');
    eq(S.sign.ask.width + 'x' + S.sign.ask.height, '12x14', 'quiz sign');
    eq(S.sign.done.width + 'x' + S.sign.done.height, '12x14', 'answered quiz sign');
  });

  test('talk: a line for getting hit', () => {
    ok(SF.createTalk(SF.makeRng(3)).line('hit'), 'hit line');
  });

  test('sprites: bgPalette keyframes', () => {
    const a = SF.bgPalette(0), b = SF.bgPalette(1), m = SF.bgPalette(0.25);
    ok(a.base !== b.base, 'bottom and top differ');
    ok(/^rgb\(/.test(m.base), 'interpolated color string');
  });

  // ---------------------------------------------------------------- 최종 검토 수정 (I1, I2)
  const withPhysics = (over) => Object.assign({}, CFG, { physics: Object.assign({}, CFG.physics, over) });
  const withZones = (edit) => {
    const zones = JSON.parse(JSON.stringify(CFG.zones));
    edit(zones);
    return Object.assign({}, CFG, { zones });
  };

  test('build: every cliff zone keeps a cliff', () => {
    // 600층 기본 맵 하나 + 200층 설정의 시드 10개 (600층을 시드마다 만들면 1분이 넘는다)
    const builds = [[CFG, getB()]].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => {
      const c = Object.assign({}, SMALL, { seed });
      return [c, SF.buildLevel(c)];
    }));
    for (const [c, B] of builds) {
      c.zones.forEach((z, i) => {
        if (z.openTurnChance <= 0 || SF.zoneSpan(c, i) < 20) return; // 짧은 구간은 제외
        const n = B.level.treads.filter((t) => t.turn === 'open' && SF.zoneForFloor(c, t.row + 1).index === i).length;
        ok(n >= 1, 'seed ' + c.seed + ': zone ' + i + ' lost all its cliffs to the fall-depth fixes');
      });
    }
  });

  test('config: default config has no problems', () => {
    eq(SF.checkConfig(CFG).join(' / '), '');
  });

  const withStep = (over) => Object.assign({}, CFG, { step: Object.assign({}, CFG.step, over) });

  test('config: broken hop time is reported', () => {
    ok(SF.checkConfig(withStep({ hopTime: 0 })).some((m) => m.includes('step.hopTime')));
  });

  test('config: too-wide treads and empty flights are reported', () => {
    const msgs = SF.checkConfig(withZones((z) => { z[0].treadWidth = [4, 5]; z[1].flightTreads = [0, 2]; })).join(' / ');
    ok(msgs.includes('treadWidth'), msgs);
    ok(msgs.includes('flightTreads'), msgs);
  });

  test('config: quoted seed is reported', () => {
    ok(SF.checkConfig(Object.assign({}, CFG, { seed: '20261014' })).some((m) => m.includes('seed')));
  });

  test('prepareLevel: default config is clean', () => {
    const r = SF.prepareLevel(CFG);
    ok(!r.fatal && r.level, 'level built');
    eq(r.messages.join(' / '), '');
  });

  test('prepareLevel: unbuildable config is fatal with a readable message', () => {
    const r = SF.prepareLevel(withZones((z) => { z[0].flightTreads = [0, 0]; }));
    ok(r.fatal, 'fatal');
    eq(r.level, null);
    ok(r.messages.some((m) => m.includes('flightTreads')), r.messages.join(' / '));
  });

  test('prepareLevel: config problems are reported quickly', () => {
    const t0 = performance.now();
    const r = SF.prepareLevel(withStep({ hopTime: 0 }));
    const ms = performance.now() - t0;
    ok(!r.fatal && r.level, 'a map is still shown');
    ok(r.messages.some((m) => m.includes('step.hopTime')), r.messages.join(' / '));
    ok(ms < 1500, 'took ' + Math.round(ms) + 'ms');
  });

  // ---------------------------------------------------------------- 1차-B: 탭 한 번 = 한 칸
  function runStepper(st, p, w, seconds) {
    const ev = [];
    const n = Math.ceil(seconds / CFG.physics.fixedStep);
    for (let i = 0; i < n; i++) for (const e of SF.updateStepper(st, p, w, CFG)) ev.push(e);
    return ev;
  }
  const STAIRS = ['#..........#', '#...=......#', '#..=.......#', '#.=........#', '############'];

  test('tap: climb when the next step is up that way', () => {
    const w = W(STAIRS);
    const p = SF.createPlayer(20, 0);
    const st = SF.createStepper();
    SF.stepperPress(st, +1, CFG);
    const ev = runStepper(st, p, w, 0.2);
    eq(p.x, 36, 'one column right');
    eq(p.y, 16, 'one floor up');
    ok(ev.some((e) => e.type === 'climb'), 'climb event');
    ok(!ev.some((e) => e.type === 'stepUp'), 'physics stepUp is reserved for falls');
    eq(st.mode, 'idle');
  });

  test('tap: side step on the same level', () => {
    const p = SF.createPlayer(20, 0);
    const st = SF.createStepper();
    SF.stepperPress(st, +1, CFG);
    const ev = runStepper(st, p, W(FLAT), 0.2);
    eq(p.x, 36);
    eq(p.y, 0);
    ok(ev.some((e) => e.type === 'side'), 'side event');
  });

  test('tap: bump into a 2-high rock', () => {
    const w = W(['#..........#', '#.R........#', '#.R........#', '############']);
    const p = SF.createPlayer(20, 0); // 열 1 가운데, 오른쪽(열 2)에 2칸 바위
    const st = SF.createStepper();
    SF.stepperPress(st, +1, CFG);
    const ev = runStepper(st, p, w, 0.2);
    eq(p.x, 20, 'did not move');
    eq(p.y, 0);
    ok(ev.some((e) => e.type === 'bump'), 'bump event');
  });

  test('tap: bump into the wall', () => {
    const p = SF.createPlayer(20, 0);
    const st = SF.createStepper();
    SF.stepperPress(st, -1, CFG);
    const ev = runStepper(st, p, W(FLAT), 0.2);
    eq(p.x, 20);
    ok(ev.some((e) => e.type === 'bump'), 'bump event');
  });

  test('tap: wrong tap falls with physics and lands centred', () => {
    const w = W(['#..........#', '#..=.......#', '#..........#', '#..........#', '############']);
    const p = SF.createPlayer(52, 48);
    const st = SF.createStepper();
    SF.stepperPress(st, +1, CFG);
    const ev = runStepper(st, p, w, 2);
    ok(ev.some((e) => e.type === 'miss'), 'miss event');
    const land = ev.find((e) => e.type === 'land');
    ok(land, 'landed');
    eq(land.dropFloors, 3);
    eq(p.y, 0);
    eq((p.x - 4) % 16, 0, 'snapped to a column centre, x=' + p.x);
    eq(st.mode, 'idle');
  });

  test('tap: queue keeps at most two taps', () => {
    const p = SF.createPlayer(20, 0);
    const st = SF.createStepper();
    for (let i = 0; i < 3; i++) SF.stepperPress(st, +1, CFG);
    runStepper(st, p, W(STAIRS), 1);
    eq(p.y, 32, 'climbed exactly two floors');
  });

  test('tap: taps during a fall are ignored', () => {
    const w = W(['#..........#', '#..=.......#', '#..........#', '#..........#', '############']);
    const p = SF.createPlayer(52, 48);
    const st = SF.createStepper();
    SF.stepperPress(st, +1, CFG);
    runStepper(st, p, w, 0.05);
    eq(st.mode, 'fall');
    SF.stepperPress(st, -1, CFG);
    SF.stepperPress(st, +1, CFG);
    runStepper(st, p, w, 2);
    eq(st.queue.length, 0, 'nothing queued');
    eq(p.y, 0, 'stayed where it landed');
  });

  test('combo: counts climbs and reports milestones', () => {
    const c = SF.createCombo();
    const hits = [];
    for (let i = 0; i < 10; i++) { const m = SF.comboStep(c, CFG); if (m) hits.push(m); }
    eq(c.count, 10);
    eq(hits.join(), '10');
  });

  test('combo: breaks after the timeout but keeps the best', () => {
    const c = SF.createCombo();
    for (let i = 0; i < 5; i++) SF.comboStep(c, CFG);
    ok(!SF.comboTick(c, 1.0, CFG), 'still alive after 1s');
    eq(c.count, 5);
    ok(SF.comboTick(c, 0.6, CFG), 'broken after 1.6s');
    eq(c.count, 0);
    eq(c.best, 5);
  });

  test('falls: every wrong tap is a bump or a measured fall', () => {
    const B = getB();
    const L = B.level;
    const measured = new Set(B.report.falls.map((f) => f.treadIndex + ':' + f.col + ':' + f.side));
    L.treads.forEach((t, i) => {
      if (t.isGoal) return;
      const exit = t.dirToNext > 0 ? t.c1 : t.c0; // 다음 계단으로 뛰는 칸
      const wrong = -t.dirToNext;
      const o = SF.stepOutcome(L.grid, exit, t.row, wrong);
      ok(o.type === 'bump' || o.type === 'side' || measured.has(i + ':' + exit + ':' + wrong),
        'floor ' + (t.row + 1) + ': wrong tap ' + o.type + ' not measured');
    });
  });

  test('sound: step pitch rises with combo and caps at an octave', () => {
    const a = SF.stepPitch(0), b = SF.stepPitch(12), c = SF.stepPitch(24), d = SF.stepPitch(200);
    ok(a < b && b < c, 'rising');
    near(c, a * 2, 1e-6, 'one octave');
    eq(d, c, 'capped');
  });

  test('sound: works without audio or storage', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    const s = SF.createSound({ storage: broken, AudioContext: null });
    s.unlock();
    s.play('step', { combo: 3 });
    s.setMuted(true);
    ok(s.muted, 'mute still toggles');
  });

  test('talk: science facts do not repeat in a run', () => {
    const t = SF.createTalk(SF.makeRng(1));
    const seen = new Set();
    for (let i = 0; i < 10; i++) seen.add(t.fact());
    eq(seen.size, 10);
  });

  test('talk: lines for each moment', () => {
    const t = SF.createTalk(SF.makeRng(2));
    ok(t.line('start'), 'start');
    ok(t.line('fall'), 'fall');
    ok(t.line('combo', 10) && t.line('combo', 30) && t.line('combo', 50), 'combo milestones');
    ok(t.line('gust') && t.line('gustIntro'), 'gust lines');
  });

  // ---------------------------------------------------------------- 2차: 장애물 (61~120층 시험 구간)
  const O = CFG.obstacles;
  const standBox = (col, row) => SF.playerHazardBox(SF.createPlayer(col * 16 + 4, row * 16));
  const zoneHas = (floor, kind) => {
    const z = SF.zoneForFloor(CFG, floor).zone;
    return !!(z.hazards && z.hazards[kind] !== undefined);
  };

  test('hazards: placed only in zones that ask for them', () => {
    const L = getB().level;
    ok(L.hazards.length > 0, 'some hazards placed');
    for (const h of L.hazards) ok(zoneHas(h.row + 1, h.kind), h.kind + ' at floor ' + (h.row + 1));
    ok(L.crumbles.length > 0, 'some crumbly tiles');
    for (const c of L.crumbles) ok(zoneHas(c.row + 1, 'crumble'), 'crumble at floor ' + (c.row + 1));
  });

  test('hazards: hazard floors are at least 2 apart and their waiting step is solid', () => {
    const L = getB().level;
    const rows = [...new Set(L.hazards.map((h) => h.row))].sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) ok(rows[i] - rows[i - 1] >= 2, 'rows ' + rows[i - 1] + ' and ' + rows[i]);
    const crumbly = new Set(L.crumbles.map((c) => c.col + ',' + c.row));
    for (const h of L.hazards) {
      const below = L.treads.find((t) => t.row === h.row - 1);
      for (let c = below.c0; c <= below.c1; c++) ok(!crumbly.has(c + ',' + below.row), 'crumble under hazard row ' + h.row);
    }
  });

  test('spike ball: rolls within its span', () => {
    const h = { kind: 'spikeBall', row: 10, c0: 3, c1: 5, phase: 0 };
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < O.spikeBall.period; t += 0.02) {
      const s = SF.hazardShapes({ hazards: [h] }, CFG, t)[0];
      lo = Math.min(lo, s.x); hi = Math.max(hi, s.x);
    }
    near(lo, 3 * 16 + 8, 1, 'left end');
    near(hi, 5 * 16 + 8, 1, 'right end');
  });

  test('spike ball: threatens only its own floor', () => {
    const L = { hazards: [{ kind: 'spikeBall', row: 10, c0: 3, c1: 5, phase: 0 }] };
    let hitsOwn = 0;
    for (let t = 0; t < O.spikeBall.period; t += 0.01) {
      for (let c = 2; c <= 6; c++) {
        ok(!SF.hazardHit(L, CFG, t, standBox(c, 9)), 'hit the floor below at col ' + c + ' t=' + t.toFixed(2));
        ok(!SF.hazardHit(L, CFG, t, standBox(c, 11)), 'hit the floor above at col ' + c);
      }
      if (SF.hazardHit(L, CFG, t, standBox(4, 10))) hitsOwn++;
    }
    ok(hitsOwn > 0, 'never hit its own floor');
    ok(hitsOwn < O.spikeBall.period / 0.01 * 0.7, 'leaves gaps');
  });

  test('banana: flies across its floor after the throw', () => {
    const L = { hazards: [{ kind: 'monkey', row: 10, side: 1, phase: 0 }] };
    const at = (t) => SF.hazardShapes(L, CFG, t).filter((s) => s.kind === 'banana');
    eq(at(0.1).length, 1, 'one banana in the air');
    ok(at(0.5)[0].x < at(0.1)[0].x, 'thrown from the right wall toward the left');
    let hit = false;
    for (let t = 0; t < 2; t += 0.01) {
      if (SF.hazardHit(L, CFG, t, standBox(5, 10))) hit = true;
      ok(!SF.hazardHit(L, CFG, t, standBox(5, 9)), 'banana hit the floor below');
    }
    ok(hit, 'banana reaches a player on its floor');
  });

  test('acorn: falls to the first surface below and stops there', () => {
    const L = { hazards: [{ kind: 'acorn', col: 4, row: 10, topRow: 15, phase: 0 }] };
    const ys = [];
    for (let t = 0; t < O.acorn.period; t += 0.05) {
      const s = SF.hazardShapes(L, CFG, t).find((x) => x.kind === 'acorn');
      if (s) ys.push(s.y);
    }
    ok(ys.length > 0, 'acorn visible');
    ok(Math.min(...ys) >= 10 * 16 - 1, 'never below the target step');
    let hit = false;
    for (let t = 0; t < O.acorn.period; t += 0.01) if (SF.hazardHit(L, CFG, t, standBox(4, 10))) hit = true;
    ok(hit, 'hits a player standing on the target step');
  });

  test('knock: a hit launches a fall away from the hazard', () => {
    const w = W(['#..........#', '#..=.......#', '#..........#', '#..........#', '############']);
    const p = SF.createPlayer(52, 48);
    const st = SF.createStepper();
    SF.stepperPress(st, +1, CFG);
    SF.stepperKnock(st, p, -1, CFG);
    eq(st.mode, 'fall');
    eq(st.queue.length, 0, 'queued taps dropped');
    ok(p.vx < 0, 'pushed left');
    const ev = runStepper(st, p, w, 2);
    ok(ev.some((e) => e.type === 'land'), 'landed');
    eq(st.mode, 'idle');
  });

  test('knock: a spike ball throws you back the way you came', () => {
    eq(SF.knockDir({ kind: 'spikeBall', dir: 1 }, { facing: 1 }), -1, 'going right, ball rolling right → pushed left');
    eq(SF.knockDir({ kind: 'spikeBall', dir: -1 }, { facing: 1 }), -1, 'going right, ball rolling left → pushed left');
    eq(SF.knockDir({ kind: 'spikeBall', dir: 1 }, { facing: -1 }), 1, 'going left → pushed right');
    eq(SF.knockDir({ kind: 'banana', dir: -1 }, { facing: 1 }), -1, 'banana keeps its flight direction');
  });

  test('crumble: breaks under a waiting player and grows back', () => {
    const grid = SF.gridFromAscii(['#..........#', '#..........#', '#....=.....#', '#..........#', '############']);
    const L = { grid, crumbles: [{ col: 5, row: 2 }] };
    const w = new SF.World(grid, CFG);
    const p = SF.createPlayer(84, 32);
    const st = SF.createStepper();
    const cs = SF.createCrumbleState(L);
    const events = [];
    const tick = (sec) => {
      for (let i = 0; i < Math.ceil(sec / CFG.physics.fixedStep); i++) {
        for (const e of SF.updateCrumbles(cs, L, p, CFG)) events.push(e);
        SF.updateStepper(st, p, w, CFG);
      }
    };
    tick(O.crumble.delay + 0.1);
    eq(grid.get(5, 2), SF.CELL.EMPTY, 'broken');
    ok(events.some((e) => e.type === 'break'), 'break event');
    tick(1);
    eq(p.y, 0, 'fell to the ground');
    tick(O.crumble.respawn);
    eq(grid.get(5, 2), SF.CELL.SLAB, 'grew back');
  });

  test('crumble: hopping off quickly is safe', () => {
    const grid = SF.gridFromAscii(['#..........#', '#..........#', '#.....=....#', '#....=.....#', '############']);
    const L = { grid, crumbles: [{ col: 5, row: 1 }] };
    const w = new SF.World(grid, CFG);
    const p = SF.createPlayer(84, 16);
    const st = SF.createStepper();
    const cs = SF.createCrumbleState(L);
    SF.stepperPress(st, +1, CFG);
    for (let i = 0; i < 120; i++) { SF.updateCrumbles(cs, L, p, CFG); SF.updateStepper(st, p, w, CFG); }
    eq(p.y, 32, 'made it up before it broke');
  });

  test('fairness: a careful climber passes the obstacle floors without a hit or a push', () => {
    const r = SF.checkHazardFairness(getB().level, CFG);
    ok(r.reached, 'reached the top (max floor ' + r.maxFloor + ')');
    eq(r.hits, 0, 'hits');
    eq(r.pushes, 0, 'pushed by the wind');
  });

  // 금 간 발판 + 장애물 구간에서 봇이 갇히던 문제 (부서진 칸으로 계속 뛰어들어 떨어짐)
  const BOT_STAIRS = () => {
    const grid = SF.gridFromAscii(['#..........#', '#..........#', '#...=......#', '#..=.......#', '#.=........#', '############']);
    const treads = [
      { row: 1, c0: 2, c1: 2, dirIn: 1, dirToNext: 1 },
      { row: 2, c0: 3, c1: 3, dirIn: 1, dirToNext: 1 },
      { row: 3, c0: 4, c1: 4, dirIn: 1, dirToNext: 0, isGoal: true },
    ];
    return { grid, treads, hazards: [], crumbles: [{ col: 3, row: 2 }], rocks: [] };
  };

  test('careful bot: waits for a broken step to grow back', () => {
    const L = BOT_STAIRS();
    const map = SF.treadIndexMap(L);
    const p = SF.createPlayer(2 * 16 + 4, 16);
    eq(SF.carefulBotDir(L, map, p, CFG, 0), 1, 'climbs while the step is there');
    L.grid.set(3, 2, SF.CELL.EMPTY, 0);
    eq(SF.carefulBotDir(L, map, p, CFG, 0), 0, 'waits while the step is broken');
  });

  test('careful bot: waits right below a hazard, not on a cracked step', () => {
    // 3층 계단에 가시공: 2층(바로 아래)이 금 간 발판이면 1층에서 기다리고, 아니면 2층까지 올라가 기다린다
    const L = BOT_STAIRS();
    L.hazards = [{ kind: 'spikeBall', row: 3, c0: 4, c1: 6, phase: 0 }];
    const map = SF.treadIndexMap(L);
    const p = SF.createPlayer(2 * 16 + 4, 16);
    let blockedAt = -1;
    for (let t = 0; t < O.spikeBall.period; t += 0.05) if (SF.carefulBotDir(L, map, p, CFG, t) === 0) { blockedAt = t; break; }
    ok(blockedAt >= 0, 'never waits below a cracked step');
    L.crumbles = [];
    L._crumbleSet = null;
    for (let t = 0; t < O.spikeBall.period; t += 0.05) eq(SF.carefulBotDir(L, map, p, CFG, t), 1, 'steps up to the safe spot at t=' + t.toFixed(2));
  });

  // ---------------------------------------------------------------- 돌풍 (멈추면 밀림)
  const G = O.gust;
  const GUST_CFG = Object.assign({}, CFG, { zones: [
    { untilFloor: 1, treadWidth: [1, 1], flightTreads: [2, 4], openTurnChance: 0, maxFallFloors: 2, style: 'plank' },
    { untilFloor: 50, treadWidth: [1, 1], flightTreads: [2, 4], openTurnChance: 0, maxFallFloors: 2, style: 'plank', hazards: { gust: true } },
  ] });
  const blowStart = (k) => k * G.period + G.warn;
  // grid 위 (col, row)에 선 캐릭터를 바람 속에 seconds초 두고 결과를 본다. tapAt: [시각, 방향] 목록
  function gustRun(lines, col, row, from, seconds, cfg, taps) {
    const grid = SF.gridFromAscii(lines);
    const L = { grid, gustPhase: 0 };
    const w = new SF.World(grid, cfg);
    const p = SF.createPlayer(col * 16 + 4, row * 16);
    const st = SF.createStepper();
    const gs = SF.createGustState();
    const ev = [];
    const dt = cfg.physics.fixedStep;
    const pending = (taps || []).slice();
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      const t = from + i * dt;
      while (pending.length && pending[0][0] <= t) SF.stepperPress(st, pending.shift()[1], cfg);
      for (const e of SF.updateStepper(st, p, w, cfg)) ev.push(e);
      for (const e of SF.updateGust(gs, L, cfg, t, p, st)) ev.push(e);
    }
    return { p, st, ev };
  }
  // 오른쪽으로 오르는 계단: 바람이 왼쪽(첫 바람)으로 불면 계단마다 왼쪽이 허공
  const GUST_STAIRS = ['#..........#', '#..........#', '#....=.....#', '#...=......#', '#..=.......#', '############'];

  test('gust: warns, blows, then calms, alternating direction', () => {
    const L = { gustPhase: 0 };
    eq(SF.gustAt(L, CFG, 0.1).phase, 'warn');
    eq(SF.gustAt(L, CFG, blowStart(0) + 0.1).phase, 'blow');
    eq(SF.gustAt(L, CFG, blowStart(0) + G.blow + 0.1).phase, 'calm');
    eq(SF.gustAt(L, CFG, 0.1).dir, -1, 'first gust blows left');
    eq(SF.gustAt(L, CFG, G.period + 0.1).dir, 1, 'second gust blows right');
    eq(SF.gustAt(L, CFG, 2 * G.period + 0.1).dir, -1, 'third gust blows left again');
  });

  test('gust: standing still in the wind pushes you off the step', () => {
    const r = gustRun(GUST_STAIRS, 4, 2, blowStart(0) - 0.2, 0.2 + G.hold + 0.3, GUST_CFG);
    ok(r.ev.some((e) => e.type === 'gustPush' && e.dir === -1), 'pushed left');
    ok(r.p.y < 2 * 16, 'fell off (y ' + r.p.y + ')');
  });

  test('gust: no push before the hold time, and tapping resets it', () => {
    const early = gustRun(GUST_STAIRS, 3, 1, blowStart(0), G.hold - 0.05, GUST_CFG);
    ok(!early.ev.some((e) => e.type === 'gustPush'), 'pushed too early');
    // 바람 속에서 버티기 시간이 끝나기 전에 한 칸 올라가면 다시 처음부터 센다
    const t0 = blowStart(0);
    const r = gustRun(GUST_STAIRS, 3, 1, t0, G.hold + 0.1, GUST_CFG, [[t0 + G.hold - 0.1, +1]]);
    ok(!r.ev.some((e) => e.type === 'gustPush'), 'a tap should reset the hold timer');
    eq(r.p.y, 2 * 16, 'climbed one step');
  });

  test('gust: a wall on the windward side holds you in place', () => {
    const lines = ['#..........#', '#..........#', '#..........#', '#=.........#', '############'];
    const r = gustRun(lines, 1, 1, blowStart(0), G.blow, GUST_CFG);
    ok(!r.ev.some((e) => e.type === 'gustPush'), 'nothing to push into');
    eq(r.p.y, 16, 'still standing');
  });

  test('gust: quiz floors are sheltered from the wind', () => {
    // GUST_STAIRS의 행 2 = 3층. 3층을 퀴즈 층으로 하면 바람에 서 있어도 안 밀린다
    const c = Object.assign({}, GUST_CFG, { quiz: { firstFloor: 3, every: 20, count: 1 } });
    const r = gustRun(GUST_STAIRS, 4, 2, blowStart(0), G.blow, c);
    ok(!r.ev.some((e) => e.type === 'gustPush'), 'pushed off a quiz floor');
  });

  test('gust: only blows in gust zones', () => {
    const calm = Object.assign({}, CFG, { zones: [GUST_CFG.zones[0], Object.assign({}, GUST_CFG.zones[1], { hazards: undefined })] });
    const r = gustRun(GUST_STAIRS, 4, 2, blowStart(0), G.blow, calm);
    ok(!r.ev.some((e) => e.type === 'gustPush'), 'pushed outside a gust zone');
  });

  test('practice: start floors and names come from the obstacle zones', () => {
    const list = SF.practiceStarts(CFG);
    eq(list.map((s) => s.floor).join(','), '61,101,151,201,281,361,441,501');
    eq(list.map((s) => s.label).join(','), '가시공,원숭이,금 간 발판,도토리,섞어서,겹치기,돌풍,최고 난이도');
  });

  test('config: gust settings are checked', () => {
    const bad = withZones((z) => { z[3].hazards = { gust: 'yes' }; });
    bad.obstacles = Object.assign({}, CFG.obstacles, { gust: { period: 1, warn: 0.7, blow: 1, hold: 0.35 } });
    const msgs = SF.checkConfig(bad).join(' / ');
    ok(msgs.includes('gust'), msgs);
    ok(msgs.includes('obstacles.gust'), msgs);
  });

  test('config: unknown hazard is reported', () => {
    const msgs = SF.checkConfig(withZones((z) => { z[3].hazards = { dragon: [2, 3] }; })).join(' / ');
    ok(msgs.includes('dragon'), msgs);
  });

  // ---------------------------------------------------------------- 최고 난이도 시험 (501~600층)
  test('speed: a faster zone runs the same pattern sooner', () => {
    const base = [
      { kind: 'spikeBall', row: 10, c0: 3, c1: 5, phase: 0.2 },
      { kind: 'monkey', row: 12, side: 1, phase: 0.3 },
      { kind: 'acorn', col: 4, row: 14, topRow: 19, phase: 0.1 },
    ];
    const fast = base.map((h) => Object.assign({}, h, { speed: 1.5 }));
    for (const t of [0.4, 0.9, 1.3, 2.2]) {
      const a = SF.hazardShapes({ hazards: fast }, CFG, t);
      const b = SF.hazardShapes({ hazards: base }, CFG, t * 1.5);
      eq(a.length, b.length, 'same shapes at t=' + t);
      a.forEach((s, i) => { eq(s.kind, b[i].kind); near(s.x, b[i].x, 0.01, s.kind + ' x'); near(s.y, b[i].y, 0.01, s.kind + ' y'); });
    }
    near(SF.hazardTiming(fast[1], CFG).period, O.banana.period / 1.5, 1e-9, 'banana period');
  });

  test('speed: a faster zone crumbles sooner', () => {
    const grid = SF.gridFromAscii(['#..........#', '#..........#', '#....=.....#', '#..........#', '############']);
    const L = { grid, crumbles: [{ col: 5, row: 2, speed: 2 }] };
    const p = SF.createPlayer(84, 32);
    const cs = SF.createCrumbleState(L);
    const n = Math.ceil((O.crumble.delay / 2 + 0.02) / CFG.physics.fixedStep);
    for (let i = 0; i < n; i++) SF.updateCrumbles(cs, L, p, CFG);
    eq(grid.get(5, 2), SF.CELL.EMPTY, 'broken at half the delay');
  });

  test('crumble: a zone can set its own break time', () => {
    const grid = SF.gridFromAscii(['#..........#', '#..........#', '#....=.....#', '#..........#', '############']);
    const L = { grid, crumbles: [{ col: 5, row: 2, speed: 1.5, delay: 0.47 }] };
    const p = SF.createPlayer(84, 32);
    const cs = SF.createCrumbleState(L);
    const tick = (sec) => { for (let i = 0; i < Math.round(sec / CFG.physics.fixedStep); i++) SF.updateCrumbles(cs, L, p, CFG); };
    tick(0.42);
    eq(grid.get(5, 2), SF.CELL.SLAB, 'still there at 0.42s');
    tick(0.08);
    eq(grid.get(5, 2), SF.CELL.EMPTY, 'broken by 0.5s');
  });

  test('hazards: a doubled floor has two different kinds', () => {
    const L = getB().level;
    const perRow = new Map();
    for (const h of L.hazards) perRow.set(h.row, (perRow.get(h.row) || []).concat(h.kind));
    for (const [row, kinds] of perRow) eq(new Set(kinds).size, kinds.length, 'kinds on floor ' + (row + 1));
  });

  test('config: double, speed and crumbleDelay are checked', () => {
    const bad = withZones((z) => { z[3].hazards = { spikeBall: [2, 4], double: 2, speed: 0, crumbleDelay: -1 }; });
    const msgs = SF.checkConfig(bad).join(' / ');
    ok(msgs.includes('double'), msgs);
    ok(msgs.includes('speed'), msgs);
    ok(msgs.includes('crumbleDelay'), msgs);
    const good = withZones((z) => { z[3].hazards = { spikeBall: [2, 4], double: 0.5, speed: 1.2, crumbleDelay: 0.5 }; });
    eq(SF.checkConfig(good).length, 0, SF.checkConfig(good).join(' / '));
  });

  // ---------------------------------------------------------------- 2단계: 학생 정보·선생님·기록
  const fakeStore = () => {
    const m = {};
    return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  };
  const badStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

  test('student: class options', () => {
    eq(SF.classOptions(CFG).join(','), '1,2,3,4,5,6,7,8,9,10');
  });

  test('student: name and class are checked', () => {
    ok(SF.validateStudent({ name: '', classNo: 2 }, CFG).length, 'empty name');
    ok(SF.validateStudent({ name: '   ', classNo: 2 }, CFG).length, 'spaces only');
    ok(SF.validateStudent({ name: '가나다라마바사아자차카', classNo: 2 }, CFG).length, '11 letters');
    ok(SF.validateStudent({ name: '홍길동', classNo: 0 }, CFG).length, 'class 0');
    ok(SF.validateStudent({ name: '홍길동', classNo: 11 }, CFG).length, 'class 11');
    ok(SF.validateStudent({ name: '홍길동', classNo: null }, CFG).length, 'no class picked');
    eq(SF.validateStudent({ name: ' 홍길동 ', classNo: 2 }, CFG).join(' / '), '', 'ok');
  });

  test('student: id', () => {
    eq(SF.studentId({ name: ' 홍길동 ', classNo: 2 }, CFG), '3-2-홍길동');
  });

  test('student: remembered on this device', () => {
    const s = fakeStore();
    eq(SF.loadStudent(s), null, 'nothing yet');
    SF.saveStudent(s, { name: '홍길동', classNo: 2, charId: 'usagi' });
    const back = SF.loadStudent(s);
    eq(back.name, '홍길동');
    eq(back.classNo, 2);
    eq(back.charId, 'usagi');
    SF.saveStudent(badStore, { name: 'x', classNo: 1, charId: 'chiikawa' }); // 저장이 막혀도 던지지 않음
    eq(SF.loadStudent(badStore), null, 'blocked storage');
    eq(SF.loadStudent(null), null, 'no storage');
  });

  test('teacher: password', () => {
    ok(SF.checkTeacherPassword(CFG, '6666'), '6666');
    ok(SF.checkTeacherPassword(CFG, ' 6666 '), 'spaces around');
    ok(!SF.checkTeacherPassword(CFG, '1234'), 'wrong');
    ok(!SF.checkTeacherPassword(CFG, ''), 'empty');
  });

  const RUN = (over) => Object.assign({
    student: { name: '홍길동', classNo: 2 }, charId: 'usagi',
    stats: { bestFloor: 600, climbTime: 600, totalTime: 840, falls: 3, maxCombo: 80 },
    quiz: { correct: 24, wrong: 6 }, finished: true, quit: false, test: false, runId: 'run-1',
  }, over || {});

  test('record: finished run', () => {
    const r = SF.makeRecord(RUN(), CFG, new Date('2026-10-16T09:30:00+09:00'));
    eq(r.id, '3-2-홍길동');
    eq(r.name, '홍길동');
    eq(r.grade, 3);
    eq(r.classNo, 2);
    eq(r.charId, 'usagi');
    eq(r.bestFloor, 600);
    ok(r.finished, 'finished');
    eq(r.climbTime, 600);
    eq(r.totalTime, 840);
    eq(r.correct, 24);
    eq(r.wrong, 6);
    eq(r.falls, 3);
    eq(r.score, 16100);
    eq(r.maxCombo, 80);
    eq(r.runId, 'run-1');
    ok(!r.test && !r.quit, 'not test, not quit');
    eq(r.date, '2026-10-16T00:30:00.000Z');
  });

  test('record: quit run keeps the best floor', () => {
    const r = SF.makeRecord(RUN({ finished: false, quit: true,
      stats: { bestFloor: 420, climbTime: 500, totalTime: 600, falls: 9, maxCombo: 60 }, quiz: { correct: 18, wrong: 3 } }), CFG, new Date());
    eq(r.bestFloor, 420);
    ok(!r.finished && r.quit, 'quit, not finished');
    eq(r.score, 8400);
  });

  test('record: test runs are marked', () => {
    ok(SF.makeRecord(RUN({ test: true }), CFG, new Date()).test);
  });

  test('config: school and teacher are checked', () => {
    const msgs = SF.checkConfig(Object.assign({}, CFG, { school: { grade: 3, classCount: 0 }, teacher: { password: '' } })).join(' / ');
    ok(msgs.includes('school.classCount'), msgs);
    ok(msgs.includes('teacher.password'), msgs);
  });

  test('characters: four friends with full frame sets', () => {
    eq(SF.CHARACTERS.map((c) => c.id).join(','), 'chiikawa,hachiware,usagi,rakko');
    eq(SF.CHARACTERS.map((c) => c.name).join(','), '치이카와,하치와레,우사기,랏코');
    const S = SF.buildSprites();
    const counts = { idle: 2, walk: 4, step: 1, fall: 2, land: 1 };
    for (const c of SF.CHARACTERS) {
      const set = S.characters[c.id];
      ok(set, 'frames for ' + c.id);
      for (const k in counts) {
        eq(set.right[k].length, counts[k], c.id + ' ' + k);
        eq(set.left[k].length, counts[k], c.id + ' ' + k + ' mirrored');
        for (const f of set.right[k]) eq(f.width + 'x' + f.height, '16x24', c.id + ' ' + k + ' size');
      }
    }
  });

  const CERT = { name: '홍길동', grade: 3, classNo: 2, floors: 600, date: new Date('2026-10-16T09:30:00+09:00'),
    climbTime: 552, score: 16100, correct: 24, total: 30, test: false, charId: 'usagi' };

  test('certificate: lines', () => {
    const t = SF.certificateLines(CERT).join('\n');
    for (const want of ['완주 증명서', '600층', '홍길동', '3학년 2반', '2026년 10월 16일', '9:12', '16,100', '24/30']) ok(t.includes(want), want + ' in ' + t);
    ok(!t.includes('테스트'), t);
  });

  test('certificate: test runs say so', () => {
    ok(SF.certificateLines(Object.assign({}, CERT, { test: true })).join(' ').includes('테스트'));
  });

  test('certificate: draws a canvas', () => {
    const c = SF.drawCertificate(CERT, SF.buildSprites());
    eq(c.width + 'x' + c.height, '600x840');
  });

  // ---------------------------------------------------------------- 3단계: Apps Script(서버) 순수 함수
  const goodRec = (over) => Object.assign({
    id: '3-2-홍길동', name: '홍길동', grade: 3, classNo: 2, charId: 'usagi', bestFloor: 600, finished: true,
    climbTime: 600, totalTime: 840, correct: 24, wrong: 6, falls: 3, maxCombo: 80, score: 16100,
    quit: false, test: false, runId: 'r1', date: '2026-10-16T00:30:00.000Z',
  }, over || {});

  test('server: rules match config.js', () => {
    const R = SFS.RULES;
    eq(R.totalFloors, CFG.totalFloors, 'floors');
    eq(R.timeLimitSec, CFG.timeLimitSec, 'time limit');
    eq(JSON.stringify(R.quiz), JSON.stringify(CFG.quiz), 'quiz');
    eq(JSON.stringify(R.score), JSON.stringify(CFG.score), 'score');
  });

  test('server: score is recomputed', () => {
    eq(SFS.scoreOf(goodRec()), 16100);
    eq(SFS.scoreOf(goodRec({ bestFloor: 420, finished: false, climbTime: 900, correct: 18, maxCombo: 60 })), 8400);
  });

  test('server: quizzes up to a floor', () => {
    eq(SFS.quizzesUpTo(9), 0);
    eq(SFS.quizzesUpTo(10), 1);
    eq(SFS.quizzesUpTo(29), 1);
    eq(SFS.quizzesUpTo(600), 30);
  });

  test('server: impossible records are refused', () => {
    eq(SFS.checkRecord(goodRec()), null, 'a good record');
    ok(SFS.checkRecord(goodRec({ climbTime: 30 })), 'finished too fast');
    ok(SFS.checkRecord(goodRec({ bestFloor: 599 })), 'finished below the top');
    ok(SFS.checkRecord(goodRec({ finished: false, bestFloor: 700 })), 'floor too high');
    ok(SFS.checkRecord(goodRec({ finished: false, bestFloor: 100, correct: 6, wrong: 0 })), 'more quizzes than floors allow');
    ok(SFS.checkRecord(goodRec({ climbTime: 2000 })), 'over the time limit');
    ok(SFS.checkRecord(goodRec({ name: '  ' })), 'no name');
    ok(SFS.checkRecord(goodRec({ name: '가나다라마바사아자차카' })), 'name too long');
    ok(SFS.checkRecord(goodRec({ classNo: 0 })), 'bad class');
    ok(SFS.checkRecord(goodRec({ test: true })), 'test record');
    ok(SFS.checkRecord(goodRec({ maxCombo: 9999 })), 'combo too big');
    ok(SFS.checkRecord(goodRec({ runId: '' })), 'no run id');
    eq(SFS.checkRecord(goodRec({ finished: false, quit: true, bestFloor: 420, climbTime: 500, correct: 18, wrong: 3 })), null, 'a quit run');
  });

  test('server: ranking order', () => {
    ok(SFS.better(goodRec(), goodRec({ finished: false, bestFloor: 590, score: 20000 })), 'finished beats unfinished');
    ok(SFS.better(goodRec({ score: 17000 }), goodRec()), 'higher score wins');
    ok(SFS.better(goodRec({ climbTime: 500 }), goodRec({ climbTime: 600 })), 'same score: faster climb wins');
    ok(!SFS.better(goodRec(), goodRec()), 'not better than itself');
  });

  test('server: one-liners are cleaned', () => {
    eq(SFS.cleanMessage('  드디어 완주!  ', []).text, '드디어 완주!');
    ok(!SFS.cleanMessage('   ', []).ok, 'empty');
    ok(!SFS.cleanMessage('가'.repeat(31), []).ok, 'too long');
    ok(SFS.cleanMessage('가'.repeat(30), []).ok, '30 letters is fine');
    ok(!SFS.cleanMessage('너 바 보 야', ['바보']).ok, 'spaced-out bad word');
    ok(!SFS.cleanMessage('바.보', ['바보']).ok, 'bad word with a dot');
    ok(SFS.cleanMessage('바다 보러 가자', ['바보']).ok, 'innocent words around');
  });

  test('server: questions are read from sheet rows', () => {
    const rows = [
      ['번호', '문제', '보기A', '보기B', '보기C', '보기D', '정답', '해설', '사용'],
      ['q1', '물의 화학식은?', 'H2O', 'CO2', 'O2', 'N2', 'A', '수소 2, 산소 1', 'O'],
      ['q2', '안 쓰는 문제', 'a', 'b', 'c', 'd', 'B', 'x', 'X'],
      ['q3', '정답 칸이 이상함', 'a', 'b', 'c', 'd', 'E', 'x', ''],
      ['q4', '보기가 빈칸', 'a', '', 'c', 'd', 'C', 'x', 'O'],
      ['', '번호 없음', 'a', 'b', 'c', 'd', '2', '', ''],
    ];
    const qs = SFS.parseQuestions(rows);
    eq(qs.map((q) => q.id).join(','), 'q1,row6');
    eq(qs[0].choices.join(','), 'H2O,CO2,O2,N2');
    eq(qs[0].answer, 0);
    eq(qs[1].answer, 1, 'number 2 means B');
    eq(qs[1].explain, '', 'empty explanation is fine');
  });

  test('server: speech lines are read from sheet rows', () => {
    const lines = SFS.parseLines([['상황', '문구', '사용'], ['출발', '가자!', 'O'], ['출발', '숨긴 문구', 'X'],
      ['콤보10', '리듬!', ''], ['모르는상황', 'x', 'O'], ['과학상식', '물은 100℃에서 끓어요', '']]);
    eq(lines.start.join('|'), '가자!');
    eq(lines.combo10.join('|'), '리듬!');
    eq(lines.fact.join('|'), '물은 100℃에서 끓어요');
    eq(Object.keys(lines).sort().join(','), 'combo10,fact,start');
  });

  test('server: seed questions are the built-in ones', () => {
    const seed = SFS.parseQuestions([SFS.HEADERS['문제']].concat(SFS.SEED_QUESTIONS));
    const pick = (q) => [q.id, q.q, q.choices, q.answer, q.explain];
    eq(JSON.stringify(seed.map(pick)), JSON.stringify(SF.QUESTIONS.map(pick)));
  });

  // ---------------------------------------------------------------- 3단계: Apps Script 처리기 (가짜 구글로)
  // 실제 Apps Script는 선생님 계정에서만 돌아서, 쓰는 API만 흉내 낸 가짜 시트로 흐름을 검사한다
  function fakeGoogle() {
    const sheets = new Map();
    const mkSheet = (name) => {
      const data = [];
      const fit = (row) => { while (data.length < row) data.push([]); };
      return {
        name, data,
        getLastRow: () => data.length,
        appendRow: (row) => { data.push(row.slice()); },
        setFrozenRows() {},
        getDataRange: () => ({ getValues: () => data.map((r) => r.slice()) }),
        getRange: (row, col, nr, nc) => ({
          setValues: (vals) => {
            for (let i = 0; i < (nr || 1); i++) { fit(row + i); for (let j = 0; j < (nc || 1); j++) data[row - 1 + i][col - 1 + j] = vals[i][j]; }
          },
          setValue: (v) => { fit(row); data[row - 1][col - 1] = v; },
        }),
      };
    };
    const ss = { getSheetByName: (n) => sheets.get(n) || null, insertSheet: (n) => { const s = mkSheet(n); sheets.set(n, s); return s; } };
    const cache = new Map();
    const env = {
      SpreadsheetApp: { getActiveSpreadsheet: () => ss },
      LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
      CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => { cache.set(k, v); } }) },
      ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ text: s, setMimeType() { return this; } }) },
    };
    return { sheets, env };
  }
  function withGoogle(fn) {
    const g = fakeGoogle();
    const keep = {};
    for (const k in g.env) { keep[k] = window[k]; window[k] = g.env[k]; }
    try { setup(); return fn(g); } finally { for (const k in keep) window[k] = keep[k]; }
  }
  const sGet = (action) => JSON.parse(doGet({ parameter: { action } }).text);
  const sPost = (body) => JSON.parse(doPost({ postData: { contents: JSON.stringify(body) } }).text);

  test('sheet server: setup makes the tabs and seeds them once', () => withGoogle((g) => {
    eq([...g.sheets.keys()].join(','), '문제,말풍선,기록,랭킹,한마디,설정');
    eq(g.sheets.get('문제').data[0].join(','), SFS.HEADERS['문제'].join(','), 'header row');
    eq(g.sheets.get('문제').data.length, 41, '40 questions');
    ok(g.sheets.get('설정').data.some((r) => r[0] === '비밀번호' && String(r[1]) === '6666'), 'password row');
    setup();
    eq(g.sheets.get('문제').data.length, 41, 'running setup again adds nothing');
  }));

  test('sheet server: bootstrap returns questions and lines', () => withGoogle(() => {
    const r = sGet('bootstrap');
    ok(r.ok, JSON.stringify(r));
    eq(r.questions.length, 40);
    ok(r.lines.start.length === 3 && r.lines.fact.length === 19, 'lines');
  }));

  test("sheet server: records keep each student's best", () => withGoogle((g) => {
    let r = sPost({ action: 'record', record: goodRec({ finished: false, quit: true, bestFloor: 300, climbTime: 400, correct: 10, wrong: 5, maxCombo: 50, runId: 'a' }) });
    ok(r.ok && r.best, 'first run ranked ' + JSON.stringify(r));
    r = sPost({ action: 'record', record: goodRec({ runId: 'b' }) });
    ok(r.ok && r.best, 'a finished run is the new best');
    eq(r.rank.school, 1);
    eq(r.rank.class, 1);
    r = sPost({ action: 'record', record: goodRec({ finished: false, bestFloor: 500, climbTime: 900, correct: 20, wrong: 5, maxCombo: 90, runId: 'c' }) });
    ok(r.ok && !r.best, 'a worse run is logged but not ranked');
    eq(g.sheets.get('기록').data.length, 4, 'three runs logged');
    const rank = g.sheets.get('랭킹').data;
    eq(rank.length, 2, 'one ranking row');
    eq(rank[1][5], 600, 'best floor');
    eq(rank[1][6], true, 'finished');
    ok(rank[1][10], 'finish date');
  }));

  test('sheet server: the score is recomputed, not trusted', () => withGoogle((g) => {
    sPost({ action: 'record', record: goodRec({ score: 999999, runId: 'z' }) });
    eq(g.sheets.get('랭킹').data[1][8], 16100);
  }));

  test('sheet server: the same run is saved once', () => withGoogle((g) => {
    ok(sPost({ action: 'record', record: goodRec({ runId: 'x' }) }).ok);
    const again = sPost({ action: 'record', record: goodRec({ runId: 'x' }) });
    ok(again.ok && again.duplicate, 'duplicate noticed');
    eq(g.sheets.get('기록').data.length, 2, 'logged once');
  }));

  test('sheet server: impossible records are refused', () => withGoogle((g) => {
    const r = sPost({ action: 'record', record: goodRec({ climbTime: 10, runId: 'fast' }) });
    ok(!r.ok && r.error, 'refused with a reason');
    eq(g.sheets.get('기록').data.length, 1, 'nothing logged');
  }));

  test('sheet server: one-liners only from finishers, cleaned', () => withGoogle((g) => {
    const msg = (text) => sPost({ action: 'message', id: '3-2-홍길동', name: '홍길동', classNo: 2, text });
    ok(!msg('나도 완주!').ok, 'not finished yet');
    sPost({ action: 'record', record: goodRec({ runId: 'm' }) });
    ok(msg('드디어 600층 완주!').ok, 'finisher can write');
    ok(!msg('바 보').ok, 'bad word');
    ok(!msg('가'.repeat(31)).ok, 'too long');
    ok(msg('한 번 더 올라왔다').ok, 'second message replaces the first');
    eq(g.sheets.get('한마디').data.length, 2, 'one message per student');
    const b = sGet('board');
    eq(b.messages.length, 1);
    eq(b.messages[0].text, '한 번 더 올라왔다');
    eq(b.messages[0].name, '홍길동');
  }));

  test('sheet server: board ranks finishers first', () => withGoogle(() => {
    sPost({ action: 'record', record: goodRec({ id: '3-1-김철수', name: '김철수', classNo: 1, finished: false, bestFloor: 590, climbTime: 900, correct: 29, wrong: 0, maxCombo: 300, runId: 'k' }) });
    sPost({ action: 'record', record: goodRec({ runId: 'h' }) });
    const b = sGet('board');
    eq(b.ranking.map((r) => r.name).join(','), '홍길동,김철수');
    eq(b.ranking[0].classNo, 2);
    ok(b.ranking[0].finished && !b.ranking[1].finished, 'finished flags');
  }));

  test('sheet server: teacher actions need the password', () => withGoogle(() => {
    sPost({ action: 'record', record: goodRec({ runId: 't' }) });
    sPost({ action: 'message', id: '3-2-홍길동', name: '홍길동', classNo: 2, text: '완주!' });
    const no = sGet('board').messages[0].no;
    ok(!sPost({ action: 'hide', password: '1234', no }).ok, 'wrong password cannot hide');
    ok(!sPost({ action: 'finishers', password: '' }).ok, 'no password, no list');
    const list = sPost({ action: 'finishers', password: '6666' });
    ok(list.ok && list.finishers.length === 1 && list.finishers[0].name === '홍길동', 'finisher list');
    const all = sPost({ action: 'messages', password: '6666' });
    ok(all.ok && all.messages.length === 1, 'teacher message list');
    ok(sPost({ action: 'hide', password: '6666', no }).ok, 'right password hides');
    eq(sGet('board').messages.length, 0, 'hidden from the board');
    ok(!sPost({ action: 'message', id: '3-2-홍길동', name: '홍길동', classNo: 2, text: '다시 보여줘' }).ok, 'cannot replace a hidden one');
  }));

  // ---------------------------------------------------------------- 3단계: 게임 쪽 시트 연결 (가짜 fetch)
  // handler(url, opt) → 돌려줄 JSON (또는 throw = 연결 실패, 'hang' = 응답 없음)
  function fakeFetch(handler) {
    const f = (url, opt) => {
      f.calls.push({ url, opt: opt || {} });
      let out;
      try { out = handler(url, opt || {}); } catch (e) { return Promise.reject(e); }
      if (out === 'hang') return new Promise(() => {});
      return Promise.resolve({ ok: true, json: () => Promise.resolve(out) });
    };
    f.calls = [];
    return f;
  }
  const URL1 = 'https://script.google.com/macros/s/abc/exec';
  const goodQ = { id: 'q1', q: '물의 화학식은?', choices: ['H2O', 'CO2', 'O2', 'N2'], answer: 0, explain: '' };

  test('sheet client: without a url nothing is sent', async () => {
    const f = fakeFetch(() => ({ ok: true }));
    const c = SF.createSheetClient({ url: '', fetch: f, storage: fakeStore() });
    ok(!c.enabled, 'disabled');
    eq((await c.sendRecord(goodRec())).ok, false);
    eq(f.calls.length, 0, 'no calls');
  });

  test('sheet client: bootstrap keeps only well-formed questions', async () => {
    const f = fakeFetch(() => ({ ok: true, questions: [goodQ, { id: 'bad', q: '', choices: [], answer: 9 }], lines: { start: ['가자!'] } }));
    const c = SF.createSheetClient({ url: URL1, fetch: f, storage: fakeStore() });
    const b = await c.bootstrap();
    eq(b.questions.length, 1);
    eq(b.questions[0].id, 'q1');
    eq(b.lines.start[0], '가자!');
    ok(f.calls[0].url.endsWith('?action=bootstrap'), f.calls[0].url);
  });

  test('sheet client: records go as plain-text JSON posts', async () => {
    const f = fakeFetch(() => ({ ok: true, best: true, rank: { school: 3, class: 1, total: 40 } }));
    const c = SF.createSheetClient({ url: URL1, fetch: f, storage: fakeStore() });
    const r = await c.sendRecord(goodRec());
    ok(r.ok && r.rank.school === 3, JSON.stringify(r));
    const call = f.calls[0];
    eq(call.opt.method, 'POST');
    ok(/text\/plain/.test(call.opt.headers['Content-Type']), 'no CORS preflight');
    const body = JSON.parse(call.opt.body);
    eq(body.action, 'record');
    eq(body.record.runId, 'r1');
  });

  test('sheet client: a failed send waits on the device and goes later', async () => {
    const store = fakeStore();
    let online = false;
    const f = fakeFetch(() => { if (!online) throw new Error('offline'); return { ok: true, best: true }; });
    const c = SF.createSheetClient({ url: URL1, fetch: f, storage: store });
    const r = await c.sendRecord(goodRec({ runId: 'w1' }));
    ok(!r.ok && r.queued, 'queued');
    eq(c.pending(), 1);
    online = true;
    const sent = await c.flush();
    eq(sent, 1, 'sent later');
    eq(c.pending(), 0);
    eq(JSON.parse(f.calls[f.calls.length - 1].opt.body).record.runId, 'w1');
  });

  test('sheet client: refused or test records are not kept', async () => {
    const store = fakeStore();
    const f = fakeFetch(() => ({ ok: false, error: '너무 빨리 완주했어요' }));
    const c = SF.createSheetClient({ url: URL1, fetch: f, storage: store });
    const r = await c.sendRecord(goodRec());
    ok(!r.ok && r.error === '너무 빨리 완주했어요' && !r.queued, 'refused, not queued');
    eq(c.pending(), 0);
    const calls = f.calls.length;
    eq((await c.sendRecord(goodRec({ test: true }))).ok, false);
    eq(f.calls.length, calls, 'test record never sent');
  });

  test('sheet client: a silent server times out', async () => {
    const f = fakeFetch(() => 'hang');
    const c = SF.createSheetClient({ url: URL1, fetch: f, storage: fakeStore(), timeoutMs: 50 });
    const t0 = performance.now();
    let err = null;
    try { await c.board(); } catch (e) { err = e; }
    ok(err && err.message === 'timeout', 'timeout error');
    ok(performance.now() - t0 < 1000, 'gave up quickly');
  });

  test('sheet client: teacher calls send the password in the body', async () => {
    const f = fakeFetch(() => ({ ok: true, finishers: [] }));
    const c = SF.createSheetClient({ url: URL1, fetch: f, storage: fakeStore() });
    await c.finishers('6666');
    ok(!f.calls[0].url.includes('6666'), 'not in the address');
    eq(JSON.parse(f.calls[0].opt.body).password, '6666');
  });

  test('talk: sheet lines replace the built-in ones', () => {
    const before = SF.TALK_DEFAULTS.start.slice();
    SF.applyTalkLines({ start: ['출발!'], fact: ['과학은 재밌어요'], combo10: ['리듬!'] });
    try {
      const t = SF.createTalk(SF.makeRng(1));
      eq(t.line('start'), '출발!');
      eq(t.fact(), '과학은 재밌어요');
      eq(t.line('combo', 10), '리듬!');
      ok(SF.TALK_DEFAULTS.fall.includes(t.line('fall')), 'untouched kinds keep the built-in lines');
    } finally {
      SF.applyTalkLines(null); // 원래대로
    }
    eq(SF.createTalk(SF.makeRng(1)).line('start') && before.length, 3);
  });

  test('talk: sheet seed lines are the built-in ones', () => {
    const seed = SFS.parseLines([SFS.HEADERS['말풍선']].concat(SFS.SEED_LINES));
    const norm = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
    eq(norm(seed), norm(SF.TALK_DEFAULTS));
  });

  // ---------------------------------------------------------------- 3단계: 랭킹 보드·저장 안내 (화면에 쓰는 순수 함수)
  const RANK = [
    { id: '3-1-가', name: '가', classNo: 1, bestFloor: 600, finished: true, score: 9000, climbTime: 400 },
    { id: '3-2-나', name: '나', classNo: 2, bestFloor: 600, finished: true, score: 8000, climbTime: 500 },
    { id: '3-1-다', name: '다', classNo: 1, bestFloor: 320, finished: false, score: 3800, climbTime: 900 },
    { id: '3-2-라', name: '라', classNo: 2, bestFloor: 120, finished: false, score: 1500, climbTime: 900 },
  ];

  test('board: school and class tabs rank and mark me', () => {
    const school = SF.boardRows(RANK, { tab: 'school', classNo: 2, id: '3-2-라' });
    eq(school.map((r) => r.rank + r.name).join(','), '1가,2나,3다,4라');
    eq(school.map((r) => r.label).join(','), '완주,완주,320층,120층');
    eq(school.filter((r) => r.me).map((r) => r.name).join(','), '라');
    const cls = SF.boardRows(RANK, { tab: 'class', classNo: 2, id: '3-2-라' });
    eq(cls.map((r) => r.rank + r.name).join(','), '1나,2라');
    ok(cls[1].me, 'me in class');
    eq(SF.boardRows(RANK, { tab: 'class', classNo: null }).length, 0, 'no class → empty');
  });

  test('board: save status messages', () => {
    const s1 = SF.recordStatus({ ok: true, best: true, rank: { school: 3, class: 1, total: 40 } });
    eq(s1.kind, 'ok');
    ok(s1.text.includes('전교 3등') && s1.text.includes('반 1등'), s1.text);
    ok(SF.recordStatus({ ok: true, best: false, rank: { school: 5, class: 2, total: 40 } }).text.includes('지난 기록'), 'older best');
    eq(SF.recordStatus({ ok: true, duplicate: true }).kind, 'ok');
    const s3 = SF.recordStatus({ ok: false, queued: true });
    eq(s3.kind, 'wait');
    ok(s3.text.includes('보관'), s3.text);
    const s4 = SF.recordStatus({ ok: false, error: '너무 빨리 완주했어요' });
    eq(s4.kind, 'bad');
    ok(s4.text.includes('너무 빨리'), s4.text);
  });

  test('board: finishers grouped by class, first finisher first', () => {
    const g = SF.finishersByClass([
      { name: '나', classNo: 2, finishedAt: '2026-10-20T01:00:00.000Z' },
      { name: '가', classNo: 1, finishedAt: '2026-10-21T01:00:00.000Z' },
      { name: '마', classNo: 2, finishedAt: '2026-10-19T01:00:00.000Z' },
    ]);
    eq(g.map((x) => x.classNo + ':' + x.students.map((s) => s.name).join('')).join(','), '1:가,2:마나');
  });

  test('board: one-liner length is checked before sending', () => {
    eq(SF.MESSAGE_MAX, SFS.RULES.messageMax, 'same limit as the server');
    eq(SF.messageProblem('  '), '한마디를 적어 주세요.');
    eq(SF.messageProblem('가'.repeat(30)), null);
    ok(String(SF.messageProblem('가'.repeat(31))).includes('30'), 'too long');
  });

  // ---------------------------------------------------------------- runner
  // 테스트는 하나씩 차례로 (Promise를 돌려주는 테스트는 끝날 때까지 기다림)
  (async function run() {
    const list = document.getElementById('results');
    const failures = [];
    let passed = 0;
    for (const t of tests) {
      const li = document.createElement('li');
      const t0 = performance.now();
      try {
        await t.fn();
        passed++;
        li.className = 'pass';
        li.textContent = 'PASS  ' + t.name + '  (' + Math.round(performance.now() - t0) + 'ms)';
      } catch (e) {
        failures.push({ name: t.name, message: String(e && e.message || e) });
        li.className = 'fail';
        li.textContent = 'FAIL  ' + t.name;
        const pre = document.createElement('pre');
        pre.textContent = String(e && e.stack || e);
        li.appendChild(pre);
      }
      list.appendChild(li);
    }
    const failed = failures.length;
    window.TEST_RESULTS = { passed, failed, failures };
    document.getElementById('summary').textContent =
      (failed ? 'FAIL' : 'PASS') + ' — ' + passed + '/' + tests.length + ' 통과';
    document.title = (failed ? 'FAIL ' : 'PASS ') + passed + '/' + tests.length;
  })();
})();

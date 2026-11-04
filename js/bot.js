// 경로를 아는 자동 플레이어: 맵 검증과 구경(조정 패널)에 쓴다.
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const GROUND = -2;

  // 발밑 디딤판 번호. 바닥이면 -2, 디딤판이 아니면(바위 윗면 등) -1
  SF.treadUnder = function (level, map, p) {
    const cs = 16;
    const cols = level.grid.cols;
    const row = Math.round(p.y / cs);
    if (row <= 0) return GROUND;
    const a = map[row * cols + Math.floor(p.x / cs)];
    if (a >= 0) return a;
    const b = map[row * cols + Math.floor((p.x + p.w - 0.01) / cs)];
    return b >= 0 ? b : -1;
  };

  SF.botDir = function (level, map, p) {
    if (!p.grounded) return 0;
    const idx = SF.treadUnder(level, map, p);
    if (idx >= 0) return level.treads[idx].dirToNext;
    const center = p.x + p.w / 2;
    if (idx === GROUND) {
      const t = level.treads[0];
      return (t.c0 + t.c1 + 1) * 8 > center ? +1 : -1;
    }
    return center < (level.grid.cols * 16) / 2 ? +1 : -1;
  };

  // 봇으로 정상까지. opts.startTread면 그 디딤판에 들어서는 쪽 칸에서 시작
  // (가운데는 바위가 얹힌 착지판에서 바위 속일 수 있다)
  SF.runBot = function (level, cfg, opts) {
    const o = opts || {};
    const world = new SF.World(level.grid, cfg);
    const map = SF.treadIndexMap(level);
    let p;
    if (o.startTread != null) {
      const t = level.treads[o.startTread];
      const entry = t.dirIn > 0 ? t.c0 : t.c1;
      p = SF.createPlayer(entry * 16 + (16 - cfg.player.width) / 2, t.row * 16);
    } else {
      p = SF.createPlayer(level.spawn.x, level.spawn.y);
    }
    const dt = cfg.physics.fixedStep;
    const maxSeconds = o.maxSeconds || cfg.totalFloors * cfg.bot.maxSecondsPerFloor;
    const maxSteps = Math.ceil(maxSeconds / dt);
    const st = SF.createStepper();
    let maxFloor = SF.floorAt(p.y);
    for (let i = 0; i < maxSteps; i++) {
      // 탭 방식: 서 있을 때마다 다음 계단 쪽을 한 번 누른다
      if (st.mode === 'idle' && st.queue.length === 0 && p.grounded) {
        const d = SF.botDir(level, map, p);
        if (d) SF.stepperPress(st, d, cfg);
      }
      SF.updateStepper(st, p, world, cfg);
      const f = SF.floorAt(p.y);
      if (f > maxFloor) maxFloor = f;
      if (p.grounded && f >= cfg.totalFloors) return { reached: true, seconds: (i + 1) * dt, maxFloor };
    }
    return { reached: false, seconds: maxSeconds, maxFloor };
  };
})(window.SF);

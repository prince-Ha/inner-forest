// 버튼 한 번 = 한 칸 이동 (설계 문서 §12).
// 캐릭터는 늘 칸 가운데(x = 16·열 + 4)에 서고, 누를 때마다 결과가 넷 중 하나:
//   오르기(한 칸 위) > 옆걸음(같은 높이) > 부딪힘(바위·벽) > 놓침(허공 → 실제 물리로 추락)
// 상태: idle(서 있음) → hop(뛰는 중) / fall(떨어지는 중) → snap(착지 후 칸 가운데로) → idle
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const CELL = SF.CELL;
  const CS = 16;

  SF.createStepper = () => ({ mode: 'idle', queue: [], t: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, kind: null, dir: 0 });

  // 떨어지는 중에는 무시, 그 밖에는 queueMax개까지 기억
  SF.stepperPress = function (st, dir, cfg) {
    if (st.mode === 'fall' || st.queue.length >= cfg.step.queueMax) return false;
    st.queue.push(dir);
    return true;
  };

  // 서 있는 칸: 몸 가운데의 열, 발이 딛는 면의 행
  SF.tileOf = (p) => ({ col: Math.floor((p.x + p.w / 2) / CS), row: Math.round(p.y / CS) });

  // (col, row 면)에 서서 dir 쪽을 눌렀을 때의 결과
  SF.stepOutcome = function (grid, col, row, dir) {
    const tc = col + dir;
    const solid = (c, r) => grid.get(c, r) === CELL.SOLID;
    const standable = (c, r) => r >= 0 && grid.get(c, r) !== CELL.EMPTY;
    const bodyFree = (c, r) => !solid(c, r + 1) && !solid(c, r + 2); // 면 r에 섰을 때 몸이 들어갈 두 칸
    if (standable(tc, row + 1) && bodyFree(tc, row + 1)) return { type: 'climb', col: tc, row: row + 1 };
    if (standable(tc, row) && bodyFree(tc, row)) return { type: 'side', col: tc, row };
    if (solid(tc, row + 1) || solid(tc, row + 2)) return { type: 'bump', col, row };
    return { type: 'miss', col: tc, row };
  };

  // 착지한 뒤 발밑 발판의 칸 가운데 x
  function snapX(grid, p) {
    const row = Math.round(p.y / CS);
    const cands = [Math.floor((p.x + p.w / 2) / CS), Math.floor(p.x / CS), Math.floor((p.x + p.w - 0.01) / CS)];
    for (const c of cands) {
      if (grid.get(c, row) !== CELL.EMPTY && grid.get(c, row + 1) !== CELL.SOLID && grid.get(c, row + 2) !== CELL.SOLID) {
        return c * CS + (CS - p.w) / 2;
      }
    }
    return p.x;
  }

  // 고정 간격 한 스텝. 이벤트: hopStart, climb(오르기 끝), side, bump, miss, 그리고 추락 중 물리 이벤트(land 등)
  SF.updateStepper = function (st, p, world, cfg) {
    const S = cfg.step;
    const dt = cfg.physics.fixedStep;
    const events = [];

    if (st.mode === 'idle' && !p.grounded) st.mode = 'fall';

    if (st.mode === 'idle' && st.queue.length) {
      const dir = st.queue.shift();
      p.facing = dir;
      const { col, row } = SF.tileOf(p);
      const o = SF.stepOutcome(world.grid, col, row, dir);
      if (o.type === 'bump') {
        events.push({ type: 'bump', dir });
      } else if (o.type === 'miss') {
        st.queue.length = 0;
        st.mode = 'fall';
        p.grounded = false;
        p.vx = dir * S.missSpeed;
        p.vy = S.missPopVy;
        p.airStartY = p.y;
        events.push({ type: 'miss', dir });
      } else {
        st.mode = 'hop';
        st.kind = o.type;
        st.dir = dir;
        st.t = 0;
        st.fromX = p.x;
        st.fromY = p.y;
        st.toX = o.col * CS + (CS - p.w) / 2;
        st.toY = o.row * CS;
        events.push({ type: 'hopStart', kind: o.type, dir });
      }
    }

    if (st.mode === 'hop') {
      st.t += dt;
      const k = Math.min(1, st.t / Math.max(1e-6, S.hopTime));
      p.x = SF.lerp(st.fromX, st.toX, k);
      p.y = SF.lerp(st.fromY, st.toY, k);
      if (k >= 1) {
        p.x = st.toX;
        p.y = st.toY;
        p.vx = 0;
        p.vy = 0;
        p.grounded = true;
        st.mode = 'idle';
        // 'climb'은 탭으로 오른 것. (물리 엔진의 'stepUp'은 떨어지다 모서리에 걸친 것이라 구분한다)
        events.push(st.kind === 'climb' ? { type: 'climb', dy: st.toY - st.fromY } : { type: 'side' });
      }
    } else if (st.mode === 'fall') {
      for (const e of SF.stepPlayer(p, world, 0, cfg)) events.push(e);
      if (p.grounded) {
        p.vx = 0;
        p.vy = 0;
        st.mode = 'snap';
        st.t = 0;
        st.fromX = p.x;
        st.toX = snapX(world.grid, p);
      }
    } else if (st.mode === 'snap') {
      st.t += dt;
      const k = Math.min(1, st.t / Math.max(1e-6, S.snapTime));
      p.x = SF.lerp(st.fromX, st.toX, k);
      if (k >= 1) {
        p.x = st.toX;
        st.mode = 'idle';
      }
    }
    return events;
  };
})(window.SF);

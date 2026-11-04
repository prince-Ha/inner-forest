// 칸 격자와 충돌 질의.
// 좌표: 논리 px, y는 위쪽이 +. 셀 (c, r)의 윗면 높이 = r * cell. 행 0은 바닥.
//  - 발판(SLAB): 셀 윗부분 두께 slabThickness. 위에서만 밟힘(아래·옆은 통과).
//  - 고체(SOLID): 셀 전체. 벽·바위·바닥. 사방이 막힘.
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.CELL = { EMPTY: 0, SLAB: 1, SOLID: 2 };
  SF.STYLE = { PLANK: 0, BRICK: 1, BRANCH: 2, ROCK: 3, GROUND: 4, GOAL: 5, WALL: 6 };
  const C = SF.CELL;
  const EPS = 0.001;

  SF.createGrid = function (cols, rows) {
    const type = new Uint8Array(cols * rows);
    const style = new Uint8Array(cols * rows);
    const inside = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
    return {
      cols, rows, type, style,
      get(c, r) {
        if (c < 0 || c >= cols || r < 0) return C.SOLID;
        if (r >= rows) return (c === 0 || c === cols - 1) ? C.SOLID : C.EMPTY;
        return type[r * cols + c];
      },
      getStyle(c, r) {
        if (!inside(c, r)) return r < 0 ? SF.STYLE.GROUND : SF.STYLE.WALL;
        return style[r * cols + c];
      },
      set(c, r, t, s) {
        if (!inside(c, r)) return;
        type[r * cols + c] = t;
        style[r * cols + c] = s || 0;
      },
    };
  };

  // 마지막 줄이 행 0. '#' 고체(행 0은 바닥, 그 외 벽), 'R' 바위, '=' 발판, '.' 빈칸
  SF.gridFromAscii = function (lines) {
    const rows = lines.length;
    const cols = lines[0].length;
    const g = SF.createGrid(cols, rows);
    lines.forEach((line, li) => {
      const r = rows - 1 - li;
      for (let c = 0; c < cols; c++) {
        const ch = line[c];
        if (ch === '#') g.set(c, r, C.SOLID, r === 0 ? SF.STYLE.GROUND : SF.STYLE.WALL);
        else if (ch === 'R') g.set(c, r, C.SOLID, SF.STYLE.ROCK);
        else if (ch === '=') g.set(c, r, C.SLAB, SF.STYLE.PLANK);
      }
    });
    return g;
  };

  const overlapX = (r, x, w) => Math.min(r.x1, x + w) - Math.max(r.x0, x);
  const overlapY = (r, y, h) => Math.min(r.y1, y + h) - Math.max(r.y0, y);

  class World {
    constructor(grid, cfg) {
      this.grid = grid;
      this.cell = cfg.world.cell;
      this.slabT = cfg.world.slabThickness;
    }

    // 영역(경계 포함)과 닿는 칸들의 충돌 사각형
    rectsIn(x0, y0, x1, y1) {
      const cs = this.cell;
      const out = [];
      // 경계 포함: x0가 칸 경계에 딱 걸리면 왼쪽 칸도 닿는다
      const c0 = Math.ceil(x0 / cs) - 1, c1 = Math.floor(x1 / cs);
      const r0 = Math.floor(y0 / cs), r1 = Math.floor(y1 / cs) + 1;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const t = this.grid.get(c, r);
          if (t === C.EMPTY) continue;
          const top = r * cs;
          const rect = t === C.SLAB
            ? { x0: c * cs, y0: top - this.slabT, x1: c * cs + cs, y1: top, kind: 'slab', col: c, row: r }
            : { x0: c * cs, y0: top - cs, x1: c * cs + cs, y1: top, kind: 'solid', col: c, row: r };
          if (rect.x1 >= x0 && rect.x0 <= x1 && rect.y1 >= y0 && rect.y0 <= y1) out.push(rect);
        }
      }
      return out;
    }

    // 발(feet) 바로 아래에 몸이 1px이라도 걸친 윗면이 있는가
    hasSupport(x, w, feet) {
      for (const r of this.rectsIn(x, feet - 1, x + w, feet + 1)) {
        if (Math.abs(r.y1 - feet) < 0.01 && overlapX(r, x, w) > EPS) return true;
      }
      return false;
    }

    // yFrom → yTo로 내려가는 동안 지나친 윗면 중 가장 높은 것
    landingTop(x, w, yFrom, yTo) {
      let best = null;
      for (const r of this.rectsIn(x, yTo, x + w, yFrom + 0.01)) {
        if (r.y1 < yTo || r.y1 > yFrom + 0.01 || overlapX(r, x, w) <= EPS) continue;
        if (best === null || r.y1 > best) best = r.y1;
      }
      return best;
    }

    // 자동 계단: 진행 방향 앞쪽 가장자리가 몸 폭 안에 들어온, 발보다 조금(≤tol) 높은 윗면
    findStep(nx, w, feet, tol, d) {
      let best = null;
      for (const r of this.rectsIn(nx - 1, feet + 0.01, nx + w + 1, feet + tol + 0.01)) {
        const rise = r.y1 - feet;
        if (rise <= 0.01 || rise > tol + 0.01) continue;
        const edge = d > 0 ? r.x0 : r.x1;
        if (edge < nx - 1 || edge > nx + w + 1) continue;
        if (best === null || r.y1 > best) best = r.y1;
      }
      return best;
    }

    // 몸이 고체와 겹치지 않는가 (발판은 무시)
    isFree(x, feet, w, h) {
      for (const r of this.rectsIn(x, feet, x + w, feet + h)) {
        if (r.kind === 'solid' && overlapX(r, x, w) > EPS && overlapY(r, feet, h) > EPS) return false;
      }
      return true;
    }

    // 가로로 움직인 새 위치에서 고체와 겹치면, 그 면에 붙는 x
    solidHit(nx, feet, w, h, d) {
      let hit = null;
      for (const r of this.rectsIn(nx, feet, nx + w, feet + h)) {
        if (r.kind !== 'solid' || overlapX(r, nx, w) <= EPS || overlapY(r, feet, h) <= EPS) continue;
        const v = d > 0 ? r.x0 - w : r.x1;
        if (hit === null || (d > 0 ? v < hit : v > hit)) hit = v;
      }
      return hit;
    }

    // 위로 움직이는 동안 머리가 닿는 고체 아랫면 중 가장 낮은 것
    ceilingBottom(x, w, headFrom, headTo) {
      let best = null;
      for (const r of this.rectsIn(x, headFrom - 0.01, x + w, headTo)) {
        if (r.kind !== 'solid' || r.y0 < headFrom - 0.01 || r.y0 > headTo || overlapX(r, x, w) <= EPS) continue;
        if (best === null || r.y0 < best) best = r.y0;
      }
      return best;
    }
  }

  SF.World = World;
})(window.SF);

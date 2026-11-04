// 캐릭터 이동: 좌우 가속, 자동 계단, 중력, 착지.
// 한 번 호출 = 고정 시간 한 스텝(cfg.physics.fixedStep). 순서가 손맛을 결정하니 바꾸지 말 것.
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.createPlayer = function (x, y) {
    const pc = (window.GAME_CONFIG && window.GAME_CONFIG.player) || { width: 8, height: 22 };
    return { x, y, w: pc.width, h: pc.height, vx: 0, vy: 0, grounded: true, facing: 1, airStartY: y };
  };

  function landEvent(p, top) {
    const floor = SF.floorAt(top);
    return { type: 'land', dropFloors: SF.floorAt(p.airStartY) - floor, floor };
  }

  SF.stepPlayer = function (p, world, dir, cfg) {
    const P = cfg.physics;
    const dt = P.fixedStep;
    const events = [];

    // 1. 가로 속도
    if (p.grounded) {
      if (dir !== 0) {
        const reversing = p.vx !== 0 && Math.sign(p.vx) !== dir;
        p.vx += dir * (reversing ? P.turnAccel : P.groundAccel) * dt;
      } else {
        p.vx = SF.approach(p.vx, 0, P.groundDecel * dt);
      }
    } else if (dir !== 0) {
      p.vx += dir * P.airAccel * dt;
    } else {
      p.vx = SF.approach(p.vx, 0, P.airDrag * dt);
    }
    p.vx = SF.clamp(p.vx, -P.walkSpeed, P.walkSpeed);
    if (dir !== 0) p.facing = dir;

    // 2. 중력
    if (!p.grounded) p.vy = Math.max(p.vy - P.gravity * dt, -P.maxFallSpeed);

    // 3. 가로 이동 + 자동 계단 (공중에서는 모서리 여유만큼만)
    const dx = p.vx * dt;
    if (dx !== 0) {
      const nx = p.x + dx;
      const d = Math.sign(dx);
      const tol = p.grounded ? P.stepHeight : P.airStepTolerance;
      const top = world.findStep(nx, p.w, p.y, tol, d);
      // 올라선 자리에 머리 공간이 있고, 실제로 발이 걸칠 때만 오른다 (벽 앞에서 떨림 방지)
      if (top !== null && world.isFree(nx, top, p.w, p.h) && world.hasSupport(nx, p.w, top)) {
        if (!p.grounded) events.push(landEvent(p, top));
        events.push({ type: 'stepUp', dy: top - p.y });
        p.y = top;
        p.vy = 0;
        p.grounded = true;
        p.x = nx;
      } else {
        const hit = world.solidHit(nx, p.y, p.w, p.h, d);
        if (hit !== null) {
          p.x = hit;
          p.vx = 0;
          events.push({ type: 'bump' });
        } else {
          p.x = nx;
        }
      }
    }

    // 4. 세로 이동: 내려가며 윗면을 지나치면 착지, 올라가며 고체 아랫면에 닿으면 멈춤
    if (!p.grounded) {
      const ny = p.y + p.vy * dt;
      if (p.vy < 0) {
        const top = world.landingTop(p.x, p.w, p.y, ny);
        if (top !== null) {
          events.push(landEvent(p, top));
          p.y = top;
          p.vy = 0;
          p.grounded = true;
        } else {
          p.y = ny;
        }
      } else if (p.vy > 0) {
        const ceil = world.ceilingBottom(p.x, p.w, p.y + p.h, ny + p.h);
        if (ceil !== null) {
          p.y = ceil - p.h;
          p.vy = 0;
        } else {
          p.y = ny;
        }
      }
    }

    // 5. 발밑 확인: 아무것도 안 걸치면 떨어지기 시작
    if (p.grounded && !world.hasSupport(p.x, p.w, p.y)) {
      p.grounded = false;
      p.vy = 0;
      p.airStartY = p.y;
      events.push({ type: 'leaveGround' });
    }

    return events;
  };
})(window.SF);

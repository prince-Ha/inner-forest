// 작은 수학 도구 모음
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  SF.lerp = (a, b, t) => a + (b - a) * t;

  // v를 target 쪽으로 최대 delta만큼 옮긴다 (넘치지 않음)
  SF.approach = (v, target, delta) =>
    (v < target ? Math.min(v + delta, target) : Math.max(v - delta, target));

  // 발 높이(px) → 층. 바닥 윗면 y=0이 1층, 한 칸(16px)마다 1층
  SF.floorAt = (y) => Math.floor(y / 16 + 1e-6) + 1;

  // 고정 간격 시계: 이번 프레임에 물리를 몇 스텝 돌릴지. 한 프레임은 최대 maxFrame초까지만 인정
  // (탭 전환·화면 잠금 뒤 돌아와도 물리가 몰아서 돌거나 타이머가 튀지 않게)
  SF.advanceClock = function (acc, realDt, step, maxFrame) {
    let a = acc + Math.min(Math.max(realDt, 0), maxFrame === undefined ? 0.25 : maxFrame);
    let steps = 0;
    while (a >= step - 1e-9) {
      a -= step;
      steps++;
    }
    return { steps, acc: Math.max(a, 0) };
  };

  // 임계 감쇠 스프링으로 부드럽게 따라가기 (Unity SmoothDamp와 같은 식)
  SF.smoothDamp = function (current, target, velRef, smoothTime, dt) {
    const st = Math.max(0.0001, smoothTime);
    const omega = 2 / st;
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (velRef.v + omega * change) * dt;
    velRef.v = (velRef.v - omega * temp) * exp;
    let out = target + (change + temp) * exp;
    if ((target - current > 0) === (out > target)) {
      out = target;
      velRef.v = 0;
    }
    return out;
  };
})(window.SF);
